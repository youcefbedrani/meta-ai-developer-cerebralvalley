import "server-only";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { getDb, schema, type Database } from "@/server/db/client";
import type { UserId } from "@/server/data/user-id";
import type { PlanId } from "@/lib/plans";
import { isAdmin } from "@/server/marketplace/config";
import { assertOperationAllowed, getPlatformSettings } from "@/server/platform/settings";

/*
 * Credit ledger.
 * - Every change is an append-only row (positive = added, negative = consumed).
 * - Each user gets their plan's allowance once per UTC calendar month; unused
 *   monthly credits expire, purchased credits never do.
 * - Work is paid for by a reservation made *before* the job runs. If the job
 *   fails, the reservation is refunded exactly once (enforced by a unique index).
 * - Reservations lock the user row, so concurrent requests can't overspend.
 */

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`This action needs ${required} credits, but you have ${available} left. Upgrade your plan or buy a credit pack in Settings → Plan & billing.`);
    this.name = "InsufficientCreditsError";
  }
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export function periodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

const periodKey = (now = new Date()) => `grant:${now.toISOString().slice(0, 7)}`;

async function balanceIn(tx: Tx | Database, userId: UserId, now = new Date()): Promise<number> {
  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${schema.creditLedger.delta}), 0)` })
    .from(schema.creditLedger)
    .where(
      and(
        eq(schema.creditLedger.userId, userId),
        or(gte(schema.creditLedger.createdAt, periodStart(now)), eq(schema.creditLedger.reason, "purchase")),
      ),
    );
  return Number(row?.total ?? 0);
}

/** This month's allowance for a plan, as set in the admin console (defaults to MONTHLY_CREDITS). */
export async function monthlyAllowance(plan: PlanId): Promise<number> {
  return (await getPlatformSettings()).monthlyCredits[plan];
}

async function grantIfNeeded(tx: Tx | Database, userId: UserId, plan: PlanId, now = new Date()): Promise<void> {
  const delta = await monthlyAllowance(plan);
  await tx
    .insert(schema.creditLedger)
    .values({
      userId,
      delta,
      reason: "monthly_grant",
      referenceId: periodKey(now),
      note: `${plan} plan monthly credits`,
      createdAt: now,
    })
    .onConflictDoNothing();
}

async function lockUser(tx: Tx, userId: UserId): Promise<PlanId> {
  const [user] = await tx
    .select({ plan: schema.users.plan })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .for("update");
  if (!user) throw new Error("User not found");
  return user.plan;
}

/** Ensures this month's grant exists and returns the spendable balance. */
export async function getBalance(userId: UserId, now = new Date()): Promise<number> {
  return getDb().transaction(async (tx) => {
    const plan = await lockUser(tx, userId);
    await grantIfNeeded(tx, userId, plan, now);
    return balanceIn(tx, userId, now);
  });
}

/**
 * Reserves credits for an operation. Throws InsufficientCreditsError if the
 * balance is too low. `referenceId` ties the reservation to its refund.
 */
export async function reserveCredits(
  userId: UserId,
  amount: number,
  referenceId: string,
  note?: string,
): Promise<{ balanceAfter: number }> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Credit amount must be a positive integer");
  // Admin console controls: AI kill switch and per-module on/off. `note` is the operation name.
  const [who] = await getDb().select({ email: schema.users.email, role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  await assertOperationAllowed(note, { isAdmin: !!who && isAdmin(who) });
  return getDb().transaction(async (tx) => {
    const plan = await lockUser(tx, userId);
    await grantIfNeeded(tx, userId, plan);
    const available = await balanceIn(tx, userId);
    if (available < amount) throw new InsufficientCreditsError(amount, available);
    await tx.insert(schema.creditLedger).values({ userId, delta: -amount, reason: "reservation", referenceId, note });
    return { balanceAfter: available - amount };
  });
}

/** Returns a reservation's credits. Safe to call more than once: only the first refund is recorded. */
export async function refundCredits(userId: UserId, referenceId: string, note?: string): Promise<number> {
  return getDb().transaction(async (tx) => {
    await lockUser(tx, userId);
    const [reservation] = await tx
      .select({ delta: schema.creditLedger.delta })
      .from(schema.creditLedger)
      .where(
        and(
          eq(schema.creditLedger.userId, userId),
          eq(schema.creditLedger.referenceId, referenceId),
          eq(schema.creditLedger.reason, "reservation"),
        ),
      )
      .limit(1);
    if (!reservation) return 0;
    const amount = -reservation.delta;
    const inserted = await tx
      .insert(schema.creditLedger)
      .values({ userId, delta: amount, reason: "refund", referenceId, note })
      .onConflictDoNothing()
      .returning({ id: schema.creditLedger.id });
    return inserted.length ? amount : 0;
  });
}

export type CreditSummary = {
  plan: PlanId;
  monthlyAllowance: number;
  balance: number;
  usedThisMonth: number;
  recent: { id: string; delta: number; reason: string; note: string | null; createdAt: Date }[];
};

export async function getCreditSummary(userId: UserId): Promise<CreditSummary> {
  const balance = await getBalance(userId);
  const db = getDb();
  const [user] = await db.select({ plan: schema.users.plan }).from(schema.users).where(eq(schema.users.id, userId));
  const [used] = await db
    .select({ total: sql<string>`coalesce(sum(${schema.creditLedger.delta}), 0)` })
    .from(schema.creditLedger)
    .where(
      and(
        eq(schema.creditLedger.userId, userId),
        gte(schema.creditLedger.createdAt, periodStart()),
        or(eq(schema.creditLedger.reason, "reservation"), eq(schema.creditLedger.reason, "refund"), eq(schema.creditLedger.reason, "usage")),
      ),
    );
  const recent = await db
    .select({
      id: schema.creditLedger.id,
      delta: schema.creditLedger.delta,
      reason: schema.creditLedger.reason,
      note: schema.creditLedger.note,
      createdAt: schema.creditLedger.createdAt,
    })
    .from(schema.creditLedger)
    .where(eq(schema.creditLedger.userId, userId))
    .orderBy(desc(schema.creditLedger.createdAt))
    .limit(20);
  return {
    plan: user.plan,
    monthlyAllowance: await monthlyAllowance(user.plan),
    balance,
    usedThisMonth: Math.max(0, -Number(used?.total ?? 0)),
    recent,
  };
}
