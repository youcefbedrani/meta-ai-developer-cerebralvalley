import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { ConfigError, getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { RESEARCH_PROMPT_VERSION } from "@/server/ai/prompts/research";
import { getBalance, InsufficientCreditsError, refundCredits, reserveCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { requireProject } from "@/server/data/projects";
import type { UserId } from "@/server/data/user-id";
import { enqueueResearch } from "@/server/jobs/queue";
import { researchCreditRef } from "@/server/jobs/research/pipeline";
import { enforceAiLimits } from "@/server/rate-limit";

export class ResearchInProgressError extends Error {
  constructor() {
    super("Research is already running for this project.");
    this.name = "ResearchInProgressError";
  }
}

/** Creates a research job, reserves its credits and queues it for the worker. */
export async function startResearch(userId: UserId, projectId: string): Promise<{ jobId: string }> {
  return queueJob(userId, projectId, "research_job", { promptVersion: RESEARCH_PROMPT_VERSION });
}

/** Queues a competitor scan: finds more competitors and fills pricing/feature gaps (see jobs/research/competitor-scan.ts). */
export async function startCompetitorScan(userId: UserId, projectId: string): Promise<{ jobId: string }> {
  return queueJob(userId, projectId, "competitor_scan", { kind: "competitor_scan" });
}

/** Queues a market-voices scan: what people say about the problem across Reddit, Quora, YouTube, Facebook and more. */
export async function startMarketVoices(userId: UserId, projectId: string): Promise<{ jobId: string }> {
  return queueJob(userId, projectId, "market_voices", { kind: "market_voices" });
}

/** Shared pre-flight for every research-queue job: owned project, services configured, rate limit, nothing running. */
async function preflight(userId: UserId, projectId: string) {
  const project = await requireProject(userId, projectId);
  for (const name of ["ai", "search", "redis"] as const) {
    const status = getIntegrationStatus(name);
    if (!status.configured) throw new ConfigError(name, status.missing);
  }
  await enforceAiLimits(userId, "research");
  const active = await getDb()
    .select({ id: schema.researchJobs.id })
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.projectId, project.id), inArray(schema.researchJobs.status, ["queued", "running"])))
    .limit(1);
  if (active.length) throw new ResearchInProgressError();
  return project;
}

async function enqueueOrRefund(userId: UserId, jobIds: string[]) {
  try {
    await enqueueResearch(jobIds[0]);
  } catch (err) {
    console.error("[research] enqueue failed", err instanceof Error ? err.message : err);
    const db = getDb();
    for (const id of jobIds) {
      await db
        .update(schema.researchJobs)
        .set({ status: "failed", error: "Could not queue the research job. Your credits were refunded.", finishedAt: new Date() })
        .where(eq(schema.researchJobs.id, id));
      await refundCredits(userId, researchCreditRef(id), "research job could not be queued");
    }
    throw new ConfigError("redis", ["REDIS_URL (queue unavailable — is Redis running?)"]);
  }
}

async function queueJob(userId: UserId, projectId: string, operation: "research_job" | "competitor_scan" | "market_voices", input: Record<string, unknown>): Promise<{ jobId: string }> {
  const project = await preflight(userId, projectId);
  const db = getDb();
  const credits = CREDIT_COSTS[operation];
  const [job] = await db
    .insert(schema.researchJobs)
    .values({ userId, projectId: project.id, status: "queued", currentStage: "queued", creditsReserved: credits, input })
    .returning({ id: schema.researchJobs.id });

  try {
    await reserveCredits(userId, credits, researchCreditRef(job.id), operation);
  } catch (err) {
    await db.delete(schema.researchJobs).where(eq(schema.researchJobs.id, job.id));
    throw err;
  }
  await enqueueOrRefund(userId, [job.id]);
  return { jobId: job.id };
}

/** The three steps of a full validation, in run order, with their share of the bundle price (sums to CREDIT_COSTS.full_validation). */
export const VALIDATION_STEPS = [
  { operation: "research_job", label: "Market research", credits: 25 },
  { operation: "competitor_scan", label: "Competitors", credits: 10 },
  { operation: "market_voices", label: "Market voices", credits: 15 },
] as const;

/**
 * One click: research, then a competitor scan, then a market-voices scan, for the bundle price.
 * All three jobs are created and paid for up front (each with its own reservation, so a failed step
 * refunds only its share). Only the first is queued; the worker queues each next step when one finishes.
 */
export async function startFullValidation(userId: UserId, projectId: string): Promise<{ runId: string; jobIds: string[] }> {
  const project = await preflight(userId, projectId);
  const total = CREDIT_COSTS.full_validation;
  const balance = await getBalance(userId);
  if (balance < total) throw new InsufficientCreditsError(total, balance);
  const db = getDb();
  const runId = crypto.randomUUID();
  const inputs: Record<string, unknown>[] = [{ promptVersion: RESEARCH_PROMPT_VERSION }, { kind: "competitor_scan" }, { kind: "market_voices" }];
  const jobs = await db
    .insert(schema.researchJobs)
    .values(VALIDATION_STEPS.map((step, i) => ({ userId, projectId: project.id, status: "queued" as const, currentStage: "queued", creditsReserved: step.credits, input: { ...inputs[i], run: runId, step: i } })))
    .returning({ id: schema.researchJobs.id });
  const ids = jobs.map((j) => j.id);
  // Each step knows the steps after it.
  for (let i = 0; i < ids.length - 1; i++) {
    await db.update(schema.researchJobs).set({ input: { ...inputs[i], run: runId, step: i, next: ids.slice(i + 1) } }).where(eq(schema.researchJobs.id, ids[i]));
  }

  const reserved: string[] = [];
  try {
    for (const [i, step] of VALIDATION_STEPS.entries()) {
      await reserveCredits(userId, step.credits, researchCreditRef(ids[i]), i === 0 ? "full_validation" : step.operation);
      reserved.push(ids[i]);
    }
  } catch (err) {
    for (const id of reserved) await refundCredits(userId, researchCreditRef(id), "full validation could not start");
    await db.delete(schema.researchJobs).where(inArray(schema.researchJobs.id, ids));
    throw err;
  }
  await enqueueOrRefund(userId, ids);
  return { runId, jobIds: ids };
}
