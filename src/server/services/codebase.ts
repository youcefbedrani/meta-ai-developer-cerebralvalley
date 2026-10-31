import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { ConfigError, getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { refundCredits, reserveCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError, UserFacingError } from "@/server/data/errors";
import { requireProject } from "@/server/data/projects";
import type { UserId } from "@/server/data/user-id";
import { enqueueResearch } from "@/server/jobs/queue";
import { enforceAiLimits } from "@/server/rate-limit";
import { withRunnableDefaults } from "@/lib/codebase";
import { isEditablePath } from "@/server/ai/prompts/codebase";
import type { CheckResult } from "@/server/codebase/check";
import { listDesignScreens } from "./design";

/*
 * "Approve the prototype → generate the code": a background job (research queue, input.kind = "codebase")
 * turns the approved screens into a runnable Next.js app with Muse Spark. The result is saved as a report
 * (type "codebase") holding every file, so it can be browsed, downloaded or opened in StackBlitz.
 */

export const CODEBASE_SCHEMA_VERSION = 1;
export const MAX_CODEBASE_SCREENS = 8;
export const codebaseCreditRef = (jobId: string) => `codebase:${jobId}`;

export type CodebaseContent = {
  name: string;
  files: Record<string, string>;
  screens: { name: string; route: string }[];
  entities: string[];
  failedScreens: string[];
  /** 1 for the generated code, +1 for every change (yours or Muse Spark's). */
  version?: number;
  /** What made this version, e.g. "Muse Spark: add a pricing page" or "Edited by you". */
  note?: string;
  /** Muse Spark's own summary of an AI change. */
  summary?: string;
  /** The type-check of this version (null while it's being checked). */
  check?: CheckResult | null;
};

const CODE_JOB_KINDS = sql`${schema.researchJobs.input}->>'kind' in ('codebase', 'codebase_edit')`;

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
    .where(and(eq(schema.researchJobs.projectId, project.id), inArray(schema.researchJobs.status, ["queued", "running"]), sql`${schema.researchJobs.input}->>'kind' in ('codebase', 'codebase_edit', 'design')`))
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
    .select({ id: schema.researchJobs.id, status: schema.researchJobs.status, stage: schema.researchJobs.currentStage, error: schema.researchJobs.error, createdAt: schema.researchJobs.createdAt, input: schema.researchJobs.input })
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.projectId, projectId), eq(schema.researchJobs.userId, userId), CODE_JOB_KINDS))
    .orderBy(desc(schema.researchJobs.createdAt))
    .limit(1);
  const report = await getLatestCodebase(userId, projectId);
  return { job: job ? { ...job, kind: String(job.input?.kind ?? "codebase"), mode: String(job.input?.mode ?? "") } : null, codebase: report };
}

export async function getLatestCodebase(userId: UserId, projectId: string) {
  const project = await requireProject(userId, projectId);
  const [row] = await getDb()
    .select({ id: schema.reports.id, content: schema.reports.content, createdAt: schema.reports.createdAt })
    .from(schema.reports)
    .where(and(eq(schema.reports.projectId, project.id), eq(schema.reports.type, "codebase")))
    .orderBy(desc(schema.reports.createdAt))
    .limit(1);
  if (!row) return null;
  const content = row.content as unknown as CodebaseContent;
  return { ...content, files: withRunnableDefaults(content.files), id: row.id, createdAt: row.createdAt };
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

/* ---------- Versions, edits and Muse Spark changes ---------- */

export const MAX_FILE_BYTES = 60_000;

/** Saves a new version of the codebase; returns its id. */
export async function insertCodebaseVersion(projectId: string, jobId: string | null, input: CodebaseContent & { id?: string; createdAt?: Date }) {
  // Callers often pass a loaded version: its row id and date belong to that row, not to the stored content.
  const content: Record<string, unknown> = { ...input };
  delete content.id;
  delete content.createdAt;
  const db = getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.reports).where(and(eq(schema.reports.projectId, projectId), eq(schema.reports.type, "codebase")));
  const version = n + 1;
  const [row] = await db
    .insert(schema.reports)
    .values({
      projectId,
      researchJobId: jobId,
      type: "codebase",
      schemaVersion: CODEBASE_SCHEMA_VERSION,
      content: { ...content, version },
      summary: `v${version}: ${input.note ?? "update"}`.slice(0, 300),
    })
    .returning({ id: schema.reports.id });
  return { id: row.id, version };
}

export async function getCodebaseVersions(userId: UserId, projectId: string) {
  const project = await requireProject(userId, projectId);
  const rows = await getDb()
    .select({ id: schema.reports.id, createdAt: schema.reports.createdAt, version: sql<number | null>`(${schema.reports.content}->>'version')::int`, note: sql<string | null>`${schema.reports.content}->>'note'`, ok: sql<boolean | null>`(${schema.reports.content}->'check'->>'ok')::boolean` })
    .from(schema.reports)
    .where(and(eq(schema.reports.projectId, project.id), eq(schema.reports.type, "codebase")))
    .orderBy(desc(schema.reports.createdAt))
    .limit(15);
  return rows;
}

async function getCodebaseVersion(projectId: string, reportId: string) {
  if (!/^[0-9a-f-]{36}$/.test(reportId)) return null;
  const [row] = await getDb()
    .select({ id: schema.reports.id, content: schema.reports.content })
    .from(schema.reports)
    .where(and(eq(schema.reports.id, reportId), eq(schema.reports.projectId, projectId), eq(schema.reports.type, "codebase")))
    .limit(1);
  return row ? { ...(row.content as unknown as CodebaseContent), id: row.id } : null;
}

async function assertNoCodeJob(projectId: string) {
  const active = await getDb()
    .select({ id: schema.researchJobs.id })
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.projectId, projectId), inArray(schema.researchJobs.status, ["queued", "running"]), sql`${schema.researchJobs.input}->>'kind' in ('codebase', 'codebase_edit', 'design')`))
    .limit(1);
  if (active.length) throw new UserFacingError("Wait for the current design or code job to finish.");
}

/** Queues a codebase_edit job (check, Muse Spark change or fix), reserving `credits` when it costs any. */
async function queueCodeJob(userId: UserId, projectId: string, input: { mode: "check" | "ai" | "fix"; baseId: string; instruction?: string }, credits: number) {
  const redis = getIntegrationStatus("redis");
  if (!redis.configured) throw new ConfigError("redis", redis.missing);
  const db = getDb();
  const [job] = await db
    .insert(schema.researchJobs)
    .values({ userId, projectId, status: "queued", currentStage: "queued", creditsReserved: credits, input: { kind: "codebase_edit", ...input } })
    .returning({ id: schema.researchJobs.id });
  if (credits) {
    try {
      await reserveCredits(userId, credits, codebaseCreditRef(job.id), input.mode === "ai" ? "codebase_edit" : "codebase_fix");
    } catch (err) {
      await db.delete(schema.researchJobs).where(eq(schema.researchJobs.id, job.id));
      throw err;
    }
  }
  try {
    await enqueueResearch(job.id);
  } catch {
    if (credits) await refundCredits(userId, codebaseCreditRef(job.id), "code job could not be queued");
    await db.update(schema.researchJobs).set({ status: "failed", error: "Could not queue the job.", finishedAt: new Date() }).where(eq(schema.researchJobs.id, job.id));
    throw new ConfigError("redis", ["REDIS_URL (queue unavailable — is Redis running?)"]);
  }
  return { jobId: job.id };
}

/**
 * The founder's own edits: `changes` maps a path to its new content (null deletes it). Saved as a new version
 * right away, then type-checked in the background (free).
 */
export async function saveCodebaseEdits(userId: UserId, projectId: string, baseId: string, changes: Record<string, string | null>) {
  const project = await requireProject(userId, projectId);
  await assertNoCodeJob(project.id);
  const base = await getCodebaseVersion(project.id, baseId);
  if (!base) throw new NotFoundError("Code version");
  const paths = Object.keys(changes);
  if (!paths.length) throw new UserFacingError("Nothing to save.");
  if (paths.length > 40) throw new UserFacingError("Save at most 40 files at a time.");
  const files = { ...base.files };
  for (const [path, content] of Object.entries(changes)) {
    if (!isEditablePath(path)) throw new UserFacingError(`You can edit files in src/ and public/, package.json and README.md (not "${path}").`);
    if (content === null) delete files[path];
    else {
      if (content.length > MAX_FILE_BYTES) throw new UserFacingError(`${path} is too large (max ${MAX_FILE_BYTES / 1000} KB).`);
      files[path] = content;
    }
  }
  const saved = await insertCodebaseVersion(project.id, null, { ...base, files, note: `Edited by you (${paths.length} file${paths.length === 1 ? "" : "s"})`, summary: undefined, check: null });
  await queueCodeJob(userId, project.id, { mode: "check", baseId: saved.id }, 0);
  return saved;
}

/** Muse Spark changes the code from a plain-language request, then makes sure it still type-checks. */
export async function startCodebaseChange(userId: UserId, projectId: string, instruction: string) {
  const text = instruction.trim();
  if (text.length < 4) throw new UserFacingError("Say what to change.");
  if (text.length > 1500) throw new UserFacingError("Keep the request under 1,500 characters.");
  const project = await requireProject(userId, projectId);
  await enforceAiLimits(userId);
  await assertNoCodeJob(project.id);
  const base = await getLatestCodebase(userId, project.id);
  if (!base) throw new UserFacingError("Generate the code first.");
  return queueCodeJob(userId, project.id, { mode: "ai", baseId: base.id, instruction: text }, CREDIT_COSTS.codebase_edit);
}

/** Muse Spark fixes the problems the type-check found in the latest version. */
export async function startCodebaseFix(userId: UserId, projectId: string) {
  const project = await requireProject(userId, projectId);
  await enforceAiLimits(userId);
  await assertNoCodeJob(project.id);
  const base = await getLatestCodebase(userId, project.id);
  if (!base) throw new UserFacingError("Generate the code first.");
  if (base.check?.ok) throw new UserFacingError("The code has no problems to fix.");
  return queueCodeJob(userId, project.id, { mode: "fix", baseId: base.id }, CREDIT_COSTS.codebase_fix);
}

/** Brings back an earlier version (saved as a new version, so nothing is lost). */
export async function restoreCodebaseVersion(userId: UserId, projectId: string, reportId: string) {
  const project = await requireProject(userId, projectId);
  await assertNoCodeJob(project.id);
  const old = await getCodebaseVersion(project.id, reportId);
  if (!old) throw new NotFoundError("Code version");
  return insertCodebaseVersion(project.id, null, { ...old, note: `Restored v${old.version ?? "?"}` });
}
