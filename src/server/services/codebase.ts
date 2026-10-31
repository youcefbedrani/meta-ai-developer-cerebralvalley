import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { ConfigError, getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { refundCredits, reserveCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { UserFacingError } from "@/server/data/errors";
import { requireProject } from "@/server/data/projects";
import type { UserId } from "@/server/data/user-id";
import { enqueueResearch } from "@/server/jobs/queue";
import { enforceAiLimits } from "@/server/rate-limit";
import { listDesignScreens } from "./design";

/*
 * "Approve the prototype → generate the code": a background job (research queue, input.kind = "codebase")
 * turns the approved screens into a runnable Next.js app with Muse Spark. The result is saved as a report
 * (type "codebase") holding every file, so it can be browsed, downloaded or opened in StackBlitz.
 */

export const CODEBASE_SCHEMA_VERSION = 1;
export const MAX_CODEBASE_SCREENS = 8;
export const codebaseCreditRef = (jobId: string) => `codebase:${jobId}`;

export type CodebaseContent = { name: string; files: Record<string, string>; screens: { name: string; route: string }[]; entities: string[]; failedScreens: string[] };

export async function startCodebase(userId: UserId, projectId: string) {
  const project = await requireProject(userId, projectId);
  const redis = getIntegrationStatus("redis");
  if (!redis.configured) throw new ConfigError("redis", redis.missing);
  await enforceAiLimits(userId);
  const screens = (await listDesignScreens(userId, project.id)).filter((s) => s.status === "succeeded" && s.html);
  if (!screens.length) throw new UserFacingError("Design at least one screen first, then approve the prototype.");
  if (screens.length > MAX_CODEBASE_SCREENS) throw new UserFacingError(`The code generator takes up to ${MAX_CODEBASE_SCREENS} screens. Archive a few first.`);
  const db = getDb();
  const active = await db
    .select({ id: schema.researchJobs.id })
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.projectId, project.id), inArray(schema.researchJobs.status, ["queued", "running"]), sql`${schema.researchJobs.input}->>'kind' in ('codebase', 'design')`))
    .limit(1);
  if (active.length) throw new UserFacingError("Wait for the current design or code job to finish.");

  const [job] = await db
    .insert(schema.researchJobs)
    .values({ userId, projectId: project.id, status: "queued", currentStage: "queued", creditsReserved: CREDIT_COSTS.codebase, input: { kind: "codebase", screenIds: screens.map((s) => s.id) } })
    .returning({ id: schema.researchJobs.id });
  try {
    await reserveCredits(userId, CREDIT_COSTS.codebase, codebaseCreditRef(job.id), "codebase");
  } catch (err) {
    await db.delete(schema.researchJobs).where(eq(schema.researchJobs.id, job.id));
    throw err;
  }
  try {
    await enqueueResearch(job.id);
  } catch {
    await refundCredits(userId, codebaseCreditRef(job.id), "codebase could not be queued");
    await db.update(schema.researchJobs).set({ status: "failed", error: "Could not queue the job. Your credits were refunded.", finishedAt: new Date() }).where(eq(schema.researchJobs.id, job.id));
    throw new ConfigError("redis", ["REDIS_URL (queue unavailable — is Redis running?)"]);
  }
  return { jobId: job.id };
}

/** The latest code job (for progress) and the latest finished codebase. */
export async function getCodebaseState(userId: UserId, projectId: string) {
  const db = getDb();
  const [job] = await db
    .select({ id: schema.researchJobs.id, status: schema.researchJobs.status, stage: schema.researchJobs.currentStage, error: schema.researchJobs.error, createdAt: schema.researchJobs.createdAt })
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.projectId, projectId), eq(schema.researchJobs.userId, userId), sql`${schema.researchJobs.input}->>'kind' = 'codebase'`))
    .orderBy(desc(schema.researchJobs.createdAt))
    .limit(1);
  const report = await getLatestCodebase(userId, projectId);
  return { job: job ?? null, codebase: report };
}

export async function getLatestCodebase(userId: UserId, projectId: string) {
  const project = await requireProject(userId, projectId);
  const [row] = await getDb()
    .select({ id: schema.reports.id, content: schema.reports.content, createdAt: schema.reports.createdAt })
    .from(schema.reports)
    .where(and(eq(schema.reports.projectId, project.id), eq(schema.reports.type, "codebase")))
    .orderBy(desc(schema.reports.createdAt))
    .limit(1);
  return row ? { id: row.id, createdAt: row.createdAt, ...(row.content as unknown as CodebaseContent) } : null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "app";

export async function buildCodebaseZip(userId: UserId, projectId: string): Promise<{ filename: string; zip: Uint8Array } | null> {
  const codebase = await getLatestCodebase(userId, projectId);
  if (!codebase) return null;
  const root = slug(codebase.name);
  const out: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(codebase.files)) out[`${root}/${path}`] = strToU8(content);
  return { filename: `${root}-mvp-code.zip`, zip: zipSync(out, { level: 6 }) };
}
