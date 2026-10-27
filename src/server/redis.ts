import "server-only";
import { Redis } from "ioredis";
import { getEnv, requireIntegration } from "@/lib/env";

const globalForRedis = globalThis as unknown as { __redis?: Redis };

/** Shared Redis connection (rate limiting). BullMQ creates its own connections. */
export function getRedis(): Redis {
  requireIntegration("redis");
  if (!globalForRedis.__redis) {
    globalForRedis.__redis = new Redis(getEnv().REDIS_URL!, { maxRetriesPerRequest: 2, lazyConnect: false });
  }
  return globalForRedis.__redis;
}
