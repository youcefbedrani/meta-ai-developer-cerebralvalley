import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db/client";
import type { UserId } from "./user-id";

export async function listAiUsage(userId: UserId, limit = 20) {
  return getDb()
    .select({
      id: schema.aiUsageLogs.id,
      operation: schema.aiUsageLogs.operation,
      provider: schema.aiUsageLogs.provider,
      model: schema.aiUsageLogs.model,
      tokensIn: schema.aiUsageLogs.tokensIn,
      tokensOut: schema.aiUsageLogs.tokensOut,
      estimatedCostUsd: schema.aiUsageLogs.estimatedCostUsd,
      status: schema.aiUsageLogs.status,
      durationMs: schema.aiUsageLogs.durationMs,
      createdAt: schema.aiUsageLogs.createdAt,
    })
    .from(schema.aiUsageLogs)
    .where(eq(schema.aiUsageLogs.userId, userId))
    .orderBy(desc(schema.aiUsageLogs.createdAt))
    .limit(limit);
}
