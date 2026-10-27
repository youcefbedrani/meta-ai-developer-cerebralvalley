import "server-only";
import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getAdminAuth } from "@/server/auth/firebase-admin";
import { getBalance } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError, UserFacingError } from "@/server/data/errors";
import { unsafeToUserId } from "@/server/data/user-id";
import { adminEmails } from "@/server/marketplace/config";
import { setMarketplaceBan } from "@/server/marketplace/listings";
import { logAdmin, type AdminActor } from "./audit";

export const PAGE_SIZE = 25;

export const userFilterSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  plan: z.enum(["free", "founder", "studio"]).optional().catch(undefined),
  status: z.enum(["active", "suspended", "not_onboarded", "admin", "banned"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});
export type UserFilter = z.infer<typeof userFilterSchema>;

export async function listUsers(filter: UserFilter) {
  const u = schema.users;
  const where: SQL[] = [];
  if (filter.q) where.push(or(ilike(u.email, `%${filter.q}%`), ilike(u.name, `%${filter.q}%`))!);
  if (filter.plan) where.push(eq(u.plan, filter.plan));
  if (filter.status === "active") where.push(isNull(u.suspendedAt));
  if (filter.status === "suspended") where.push(isNotNull(u.suspendedAt));
  if (filter.status === "not_onboarded") where.push(isNull(u.onboardedAt));
  if (filter.status === "admin") where.push(inArray(sql`lower(${u.email})`, adminEmails().length ? adminEmails() : [""]));
  if (filter.status === "banned") where.push(isNotNull(u.marketplaceBannedAt));
  const page = filter.page ?? 1;
  const db = getDb();
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        role: u.role,
        createdAt: u.createdAt,
        onboardedAt: u.onboardedAt,
        suspendedAt: u.suspendedAt,
        marketplaceBannedAt: u.marketplaceBannedAt,
        projects: sql<number>`(select count(*)::int from projects p where p.user_id = ${u.id})`,
        lastActive: sql<string | null>`(select max(created_at)::text from ai_usage_logs a where a.user_id = ${u.id})`,
      })
      .from(u)
      .where(cond)
      .orderBy(desc(u.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(u).where(cond),
  ]);
  const envAdmins = adminEmails();
  return { rows: rows.map((r) => ({ ...r, envAdmin: envAdmins.includes(r.email.toLowerCase()) })), total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getUserDetail(userId: string) {
  if (!z.uuid().safeParse(userId).success) return null;
  const db = getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return null;
  const [profile, projects, ledger, ai, jobs, subscription, listings, deals, audit] = await Promise.all([
    db.select({ answers: schema.profiles.answers }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1),
    db
      .select({ id: schema.projects.id, name: schema.projects.name, stage: schema.projects.stage, status: schema.projects.status, createdAt: schema.projects.createdAt, updatedAt: schema.projects.updatedAt })
      .from(schema.projects)
      .where(eq(schema.projects.userId, userId))
      .orderBy(desc(schema.projects.updatedAt)),
    db.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId)).orderBy(desc(schema.creditLedger.createdAt)).limit(30),
    db
      .select({
        calls: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) filter (where ${schema.aiUsageLogs.status} <> 'success')::int`,
        cost: sql<string>`coalesce(sum(${schema.aiUsageLogs.estimatedCostUsd}), 0)::text`,
        last: sql<string | null>`max(${schema.aiUsageLogs.createdAt})::text`,
      })
      .from(schema.aiUsageLogs)
      .where(eq(schema.aiUsageLogs.userId, userId)),
    db.select().from(schema.researchJobs).where(eq(schema.researchJobs.userId, userId)).orderBy(desc(schema.researchJobs.createdAt)).limit(10),
    db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)).limit(1),
    db.select({ id: schema.listings.id, title: schema.listings.title, status: schema.listings.status }).from(schema.listings).where(eq(schema.listings.sellerId, userId)),
    db
      .select({ id: schema.deals.id, state: schema.deals.state, amountCents: schema.deals.amountCents, currency: schema.deals.currency, sellerId: schema.deals.sellerId })
      .from(schema.deals)
      .where(or(eq(schema.deals.sellerId, userId), eq(schema.deals.buyerId, userId)))
      .orderBy(desc(schema.deals.createdAt)),
    db.select().from(schema.adminAuditLog).where(and(eq(schema.adminAuditLog.targetType, "user"), eq(schema.adminAuditLog.targetId, userId))).orderBy(desc(schema.adminAuditLog.createdAt)).limit(20),
  ]);
  return {
    user,
    envAdmin: adminEmails().includes(user.email.toLowerCase()),
    profile: profile[0]?.answers ?? null,
    projects,
    ledger,
    balance: await getBalance(unsafeToUserId(userId)),
    ai: ai[0],
    jobs,
    subscription: subscription[0] ?? null,
    listings,
    deals,
    audit,
  };
}

async function requireTarget(userId: string) {
  if (!z.uuid().safeParse(userId).success) throw new NotFoundError("User");
  const [user] = await getDb().select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) throw new NotFoundError("User");
  return user;
}

const reasonSchema = z.string().trim().min(3, "Give a short reason (it's kept in the audit log).").max(500);

export async function adminSetPlan(actor: AdminActor, userId: string, plan: unknown) {
  const target = await requireTarget(userId);
  const next = z.enum(["free", "founder", "studio"]).parse(plan);
  if (next === target.plan) return;
  await getDb().update(schema.users).set({ plan: next }).where(eq(schema.users.id, userId));
  await logAdmin(actor, "user.plan_changed", "user", userId, { from: target.plan, to: next, note: "Manual change; Stripe subscription not modified." });
}

export async function adminAdjustCredits(actor: AdminActor, userId: string, input: unknown) {
  await requireTarget(userId);
  const { delta, reason } = z
    .object({ delta: z.coerce.number().int().min(-100_000).max(100_000).refine((v) => v !== 0, "Enter a non-zero amount."), reason: reasonSchema })
    .parse(input);
  // Gifted credits are recorded as "purchase" so they never expire (see credits.ts); removals as "adjustment".
  await getDb().insert(schema.creditLedger).values({ userId, delta, reason: delta > 0 ? "purchase" : "adjustment", referenceId: `admin:${crypto.randomUUID()}`, note: `Admin: ${reason}` });
  await logAdmin(actor, "user.credits_adjusted", "user", userId, { delta, reason });
}

export async function adminSuspend(actor: AdminActor, userId: string, suspend: boolean, reason?: string) {
  const target = await requireTarget(userId);
  if (target.id === actor.id) throw new UserFacingError("You can't suspend your own account.");
  if (suspend) {
    const why = reasonSchema.parse(reason);
    await getDb().update(schema.users).set({ suspendedAt: new Date(), suspendedReason: why }).where(eq(schema.users.id, userId));
    // End every open session now, not when the cookie expires.
    try {
      await getAdminAuth().revokeRefreshTokens(target.firebaseUid);
    } catch {
      // Firebase unreachable: the suspended flag alone already blocks every request.
    }
    await logAdmin(actor, "user.suspended", "user", userId, { reason: why });
  } else {
    await getDb().update(schema.users).set({ suspendedAt: null, suspendedReason: null }).where(eq(schema.users.id, userId));
    await logAdmin(actor, "user.unsuspended", "user", userId);
  }
}

export async function adminMarketplaceBan(actor: AdminActor, userId: string, banned: boolean) {
  await requireTarget(userId);
  await setMarketplaceBan(actor.id, userId, banned);
  await logAdmin(actor, banned ? "user.marketplace_banned" : "user.marketplace_unbanned", "user", userId);
}

/**
 * Permanently deletes the account: Firebase login plus every row it owns (cascades).
 * Refused while the user has marketplace deals, which are financial records: suspend instead.
 */
export async function adminDeleteUser(actor: AdminActor, userId: string, confirmEmail: string) {
  const target = await requireTarget(userId);
  if (target.id === actor.id) throw new UserFacingError("You can't delete your own account here.");
  if (adminEmails().includes(target.email.toLowerCase())) throw new UserFacingError("This is a platform admin account. Remove it from ADMIN_EMAILS first.");
  if (confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()) throw new UserFacingError("Type the user's email exactly to confirm.");
  const [{ deals }] = await getDb()
    .select({ deals: count() })
    .from(schema.deals)
    .where(or(eq(schema.deals.sellerId, userId), eq(schema.deals.buyerId, userId)));
  if (deals > 0) throw new UserFacingError("This user has marketplace deals (financial records), so the account can't be deleted. Suspend it instead.");
  try {
    await getAdminAuth().deleteUser(target.firebaseUid);
  } catch (err) {
    // Already gone from Firebase is fine; anything else means we stop before deleting data.
    if (!(err && typeof err === "object" && "code" in err && err.code === "auth/user-not-found")) throw new UserFacingError("Couldn't delete the sign-in account. Nothing was deleted; please try again.");
  }
  await getDb().delete(schema.users).where(eq(schema.users.id, userId));
  await logAdmin(actor, "user.deleted", "user", userId, { email: target.email, name: target.name });
}
