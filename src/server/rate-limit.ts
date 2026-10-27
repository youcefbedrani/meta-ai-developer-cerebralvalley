import "server-only";
import { getRedis } from "./redis";

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(`Too many requests. Try again in ${retryAfterSeconds} seconds.`);
    this.name = "RateLimitError";
  }
}

/**
 * Fixed-window limiter: at most `limit` hits per `windowSeconds` for `key`.
 * Throws RateLimitError when exceeded.
 */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const redis = getRedis();
  const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
  const [[, count]] = (await redis.multi().incr(bucket).expire(bucket, windowSeconds).exec()) as [[null, number], unknown];
  if (count > limit) {
    const retryAfter = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
    throw new RateLimitError(retryAfter);
  }
}

/** Limits per operation; tune here. */
export const LIMITS = {
  aiPerMinute: { limit: 6, windowSeconds: 60 },
  aiPerHour: { limit: 60, windowSeconds: 3600 },
  researchPerHour: { limit: 10, windowSeconds: 3600 },
  waitlistPerMinute: { limit: 5, windowSeconds: 60 },
  painMiningPerHour: { limit: 4, windowSeconds: 3600 },
} as const;

export async function enforceAiLimits(userId: string, operation: "ai" | "research" | "pain_mining" = "ai"): Promise<void> {
  await enforceRateLimit(`ai:min:${userId}`, LIMITS.aiPerMinute.limit, LIMITS.aiPerMinute.windowSeconds);
  await enforceRateLimit(`ai:hour:${userId}`, LIMITS.aiPerHour.limit, LIMITS.aiPerHour.windowSeconds);
  if (operation === "pain_mining") {
    await enforceRateLimit(`mining:hour:${userId}`, LIMITS.painMiningPerHour.limit, LIMITS.painMiningPerHour.windowSeconds);
  }
  if (operation === "research") {
    await enforceRateLimit(`research:hour:${userId}`, LIMITS.researchPerHour.limit, LIMITS.researchPerHour.windowSeconds);
  }
}
