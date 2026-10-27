import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import type { PlanId } from "@/lib/plans";
import { getDb, schema } from "@/server/db/client";
import { UserFacingError } from "@/server/data/errors";
import type { UserId } from "@/server/data/user-id";
import { getPlatformSettings } from "@/server/platform/settings";
import { getRedis } from "@/server/redis";

/*
 * Fair-use AI budget, enforced before every AI call (on top of credits):
 * - per client: tokens per UTC day and per UTC month, by plan (admin-editable in platform settings);
 * - per platform: AI spend per UTC day in USD, so one client (or a bug) can't drain the provider account.
 * Counters live in Redis and are reserved atomically before the call with an estimate, then corrected to
 * the real usage afterwards. A missing counter (Redis restarted) is rebuilt from ai_usage_logs first.
 */

export class AiLimitError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "AiLimitError";
  }
}

const DAY_SECONDS = 86_400;
const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
const utcMonth = (d = new Date()) => d.toISOString().slice(0, 7);
const dayKey = (userId: string, d?: Date) => `ai:tok:d:${userId}:${utcDay(d)}`;
const monthKey = (userId: string, d?: Date) => `ai:tok:m:${userId}:${utcMonth(d)}`;
const spendKey = (d?: Date) => `ai:usd:${utcDay(d)}`;

/** Rough token count for budgeting before a call (about 4 characters per token for English, rounded up). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3.6);

async function usedFromLogs(userId: string, since: Date): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`coalesce(sum(${schema.aiUsageLogs.tokensIn} + ${schema.aiUsageLogs.tokensOut}), 0)::int` })
    .from(schema.aiUsageLogs)
    .where(and(eq(schema.aiUsageLogs.userId, userId), gte(schema.aiUsageLogs.createdAt, since)));
  return row?.n ?? 0;
}

async function spendFromLogs(since: Date): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<string>`coalesce(sum(${schema.aiUsageLogs.estimatedCostUsd}), 0)` })
    .from(schema.aiUsageLogs)
    .where(gte(schema.aiUsageLogs.createdAt, since));
  return Number(row?.n ?? 0);
}

const startOfUtcDay = (d = new Date()) => new Date(`${utcDay(d)}T00:00:00.000Z`);
const startOfUtcMonth = (d = new Date()) => new Date(`${utcMonth(d)}-01T00:00:00.000Z`);

/** Makes sure the counters exist; a missing one is seeded from the usage log so a Redis restart can't reset limits. */
async function ensureCounters(userId: string) {
  const redis = getRedis();
  const [d, m] = [dayKey(userId), monthKey(userId)];
  const [hasD, hasM] = await Promise.all([redis.exists(d), redis.exists(m)]);
  if (!hasD) await redis.set(d, String(await usedFromLogs(userId, startOfUtcDay())), "EX", DAY_SECONDS * 2, "NX");
  if (!hasM) await redis.set(m, String(await usedFromLogs(userId, startOfUtcMonth())), "EX", DAY_SECONDS * 32, "NX");
}

export type AiUsage = { day: { used: number; limit: number }; month: { used: number; limit: number } };

/** The client's token usage and limits right now (for the usage meter). */
export async function getAiUsage(userId: UserId, plan: PlanId): Promise<AiUsage> {
  const limits = (await getPlatformSettings()).aiLimits;
  await ensureCounters(userId);
  const redis = getRedis();
  const [d, m] = await Promise.all([redis.get(dayKey(userId)), redis.get(monthKey(userId))]);
  return { day: { used: Number(d ?? 0), limit: limits.dailyTokens[plan] }, month: { used: Number(m ?? 0), limit: limits.monthlyTokens[plan] } };
}

export type TokenReservation = { userId: string; reserved: number; day: string; month: string };

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

/**
 * Reserves `estimate` tokens for one AI call, or throws AiLimitError when the client's daily or monthly
 * limit (or the platform's daily spend cap) would be passed. Call `settleTokens` afterwards with the real usage.
 */
export async function reserveTokens(userId: UserId, plan: PlanId, estimate: number): Promise<TokenReservation> {
  const settings = await getPlatformSettings();
  const { dailyTokens, monthlyTokens, platformDailyUsd } = settings.aiLimits;
  if (platformDailyUsd > 0) {
    const redis = getRedis();
    let spent = await redis.get(spendKey());
    if (spent === null) {
      await redis.set(spendKey(), String(await spendFromLogs(startOfUtcDay())), "EX", DAY_SECONDS * 2, "NX");
      spent = await redis.get(spendKey());
    }
    if (Number(spent ?? 0) >= platformDailyUsd) throw new AiLimitError("AI is resting until tomorrow (00:00 UTC) because today's platform AI budget is used up. Nothing was charged.");
  }

  await ensureCounters(userId);
  const redis = getRedis();
  const n = Math.max(1, Math.ceil(estimate));
  const [d, m] = [dayKey(userId), monthKey(userId)];
  const res = (await redis.multi().incrby(d, n).incrby(m, n).exec()) as [[null, number], [null, number]];
  const day = res[0][1];
  const month = res[1][1];
  const dayLimit = dailyTokens[plan];
  const monthLimit = monthlyTokens[plan];
  if (day > dayLimit || month > monthLimit) {
    await redis.multi().decrby(d, n).decrby(m, n).exec();
    const monthly = month > monthLimit;
    const limit = monthly ? monthLimit : dayLimit;
    throw new AiLimitError(
      monthly
        ? `You've used this month's AI allowance (${fmt(limit)} tokens on your plan). It resets on the 1st${plan === "studio" ? "" : ", or upgrade in Settings → Plan & billing for more"}. Nothing was charged.`
        : `You've used today's AI allowance (${fmt(limit)} tokens on your plan). It resets at 00:00 UTC${plan === "studio" ? "" : ", or upgrade in Settings → Plan & billing for more"}. Nothing was charged.`,
    );
  }
  return { userId, reserved: n, day: d, month: m };
}

/** Replaces the reserved estimate with the real token count (0 when the call failed before using any). */
export async function settleTokens(r: TokenReservation, actualTokens: number): Promise<void> {
  const delta = Math.max(0, Math.round(actualTokens)) - r.reserved;
  if (!delta) return;
  try {
    await getRedis().multi().incrby(r.day, delta).incrby(r.month, delta).exec();
  } catch (err) {
    console.error("[ai] could not settle token budget", err instanceof Error ? err.message : err);
  }
}

/** Adds a call's estimated cost to today's platform spend. */
export async function recordSpend(usd: number | null): Promise<void> {
  if (!usd || usd <= 0) return;
  try {
    const redis = getRedis();
    await redis.multi().incrbyfloat(spendKey(), usd).expire(spendKey(), DAY_SECONDS * 2).exec();
  } catch (err) {
    console.error("[ai] could not record spend", err instanceof Error ? err.message : err);
  }
}

/** Today's platform AI spend in USD (for the admin console). */
export async function platformSpendToday(): Promise<number> {
  const v = await getRedis().get(spendKey());
  return v === null ? spendFromLogs(startOfUtcDay()) : Number(v);
}
