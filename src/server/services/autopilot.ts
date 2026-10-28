import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ConfigError, getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { autopilotStartSchema } from "@/lib/validation/autopilot";
import { refundCredits, reserveCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { UserFacingError } from "@/server/data/errors";
import { requireProject } from "@/server/data/projects";
import type { UserId } from "@/server/data/user-id";
import { autopilotCreditRef } from "@/server/jobs/autopilot/agent";
import { enqueueAutopilot } from "@/server/jobs/queue";
import { enforceAiLimits } from "@/server/rate-limit";

export class AutopilotInProgressError extends UserFacingError {
  constructor() {
    super("Autopilot is already running for this project.");
  }
}

export type AutopilotRun = typeof schema.autopilotRuns.$inferSelect;

/** Creates an Autopilot run, reserves its credits and queues it for the worker. */
export async function startAutopilot(userId: UserId, projectId: string, raw: unknown = {}): Promise<{ runId: string }> {
  const { goal } = autopilotStartSchema.parse(raw);
  const project = await requireProject(userId, projectId);
  for (const name of ["ai", "search", "redis"] as const) {
    const status = getIntegrationStatus(name);
    if (!status.configured) throw new ConfigError(name, status.missing);
  }
  await enforceAiLimits(userId, "research");
  const db = getDb();
  const [active] = await db
    .select({ id: schema.autopilotRuns.id })
    .from(schema.autopilotRuns)
    .where(and(eq(schema.autopilotRuns.projectId, project.id), inArray(schema.autopilotRuns.status, ["queued", "running"])))
    .limit(1);
  if (active) throw new AutopilotInProgressError();

  const credits = CREDIT_COSTS.autopilot;
  const [run] = await db.insert(schema.autopilotRuns).values({ userId, projectId: project.id, goal: goal || null, creditsReserved: credits }).returning({ id: schema.autopilotRuns.id });
  try {
    await reserveCredits(userId, credits, autopilotCreditRef(run.id), "autopilot");
  } catch (err) {
    await db.delete(schema.autopilotRuns).where(eq(schema.autopilotRuns.id, run.id));
    throw err;
  }
  try {
    await enqueueAutopilot({ runId: run.id });
  } catch (err) {
    console.error("[autopilot] enqueue failed", err instanceof Error ? err.message : err);
    await db.update(schema.autopilotRuns).set({ status: "failed", error: "Could not queue the run. Your credits were refunded.", finishedAt: new Date() }).where(eq(schema.autopilotRuns.id, run.id));
    await refundCredits(userId, autopilotCreditRef(run.id), "autopilot could not be queued");
    throw new ConfigError("redis", ["REDIS_URL (queue unavailable — is Redis running?)"]);
  }
  return { runId: run.id };
}

export async function getLatestAutopilotRun(userId: UserId, projectId: string): Promise<AutopilotRun | null> {
  const [run] = await getDb()
    .select()
    .from(schema.autopilotRuns)
    .where(and(eq(schema.autopilotRuns.projectId, projectId), eq(schema.autopilotRuns.userId, userId)))
    .orderBy(desc(schema.autopilotRuns.createdAt))
    .limit(1);
  return run ?? null;
}
