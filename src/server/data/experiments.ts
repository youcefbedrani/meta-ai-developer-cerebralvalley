import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/server/db/client";
import {
  completeExperimentSchema,
  decisionSchema,
  experimentInputSchema,
  resultInputSchema,
  type ExperimentInput,
} from "@/lib/validation/experiments";
import { NotFoundError } from "./errors";
import { requireProject } from "./projects";
import type { UserId } from "./user-id";

/*
 * Experiments, results and decisions. Ownership is enforced through the
 * parent project (projects.user_id). Only the user can mark an experiment as
 * passed — AI output never changes validation status.
 */

const isUuid = (id: string) => z.uuid().safeParse(id).success;

export type Experiment = typeof schema.experiments.$inferSelect;
export type ExperimentWithProject = Experiment & { projectName: string };
export type ExperimentResult = typeof schema.experimentResults.$inferSelect;

export class DecisionNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionNotAllowedError";
  }
}

export async function listExperiments(userId: UserId, opts: { projectId?: string; status?: Experiment["status"] } = {}): Promise<ExperimentWithProject[]> {
  if (opts.projectId && !isUuid(opts.projectId)) return [];
  const where = [eq(schema.projects.userId, userId)];
  if (opts.projectId) where.push(eq(schema.experiments.projectId, opts.projectId));
  if (opts.status) where.push(eq(schema.experiments.status, opts.status));
  const rows = await getDb()
    .select({ e: schema.experiments, projectName: schema.projects.name })
    .from(schema.experiments)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.experiments.projectId))
    .where(and(...where))
    .orderBy(sql`case ${schema.experiments.status} when 'running' then 0 when 'planned' then 1 when 'completed' then 2 else 3 end`, desc(schema.experiments.updatedAt));
  return rows.map((r) => ({ ...r.e, projectName: r.projectName }));
}

export async function getExperiment(userId: UserId, experimentId: string): Promise<ExperimentWithProject | null> {
  if (!isUuid(experimentId)) return null;
  const [row] = await getDb()
    .select({ e: schema.experiments, projectName: schema.projects.name })
    .from(schema.experiments)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.experiments.projectId))
    .where(and(eq(schema.experiments.id, experimentId), eq(schema.projects.userId, userId)))
    .limit(1);
  return row ? { ...row.e, projectName: row.projectName } : null;
}

async function requireExperiment(userId: UserId, experimentId: string): Promise<ExperimentWithProject> {
  const e = await getExperiment(userId, experimentId);
  if (!e) throw new NotFoundError("Experiment");
  return e;
}

export async function createExperiment(userId: UserId, projectId: string, input: ExperimentInput): Promise<Experiment> {
  const project = await requireProject(userId, projectId);
  const data = experimentInputSchema.parse(input);
  const [row] = await getDb().insert(schema.experiments).values({ ...data, projectId: project.id }).returning();
  if (project.stage === "idea" || project.stage === "research") {
    await getDb().update(schema.projects).set({ stage: "validation" }).where(eq(schema.projects.id, project.id));
  }
  return row;
}

export async function updateExperiment(userId: UserId, experimentId: string, input: ExperimentInput): Promise<Experiment> {
  const existing = await requireExperiment(userId, experimentId);
  const data = experimentInputSchema.parse(input);
  const [row] = await getDb().update(schema.experiments).set(data).where(eq(schema.experiments.id, existing.id)).returning();
  return row;
}

/** Saves only the procedure (e.g. a generated interview script). */
export async function setExperimentProcedure(userId: UserId, experimentId: string, procedure: string): Promise<void> {
  const existing = await requireExperiment(userId, experimentId);
  await getDb().update(schema.experiments).set({ procedure: procedure.slice(0, 8000) }).where(eq(schema.experiments.id, existing.id));
}

export async function startExperiment(userId: UserId, experimentId: string): Promise<void> {
  const e = await requireExperiment(userId, experimentId);
  if (e.status !== "planned") return;
  await getDb().update(schema.experiments).set({ status: "running", startDate: e.startDate ?? new Date() }).where(eq(schema.experiments.id, e.id));
}

export async function cancelExperiment(userId: UserId, experimentId: string): Promise<void> {
  const e = await requireExperiment(userId, experimentId);
  if (e.status === "completed") return;
  await getDb().update(schema.experiments).set({ status: "cancelled" }).where(eq(schema.experiments.id, e.id));
}

export async function reopenExperiment(userId: UserId, experimentId: string): Promise<void> {
  const e = await requireExperiment(userId, experimentId);
  await getDb().update(schema.experiments).set({ status: "running", passed: null, endDate: null }).where(eq(schema.experiments.id, e.id));
}

/** The user records the outcome. `passed` is set only here, by the user. */
export async function completeExperiment(userId: UserId, experimentId: string, input: z.input<typeof completeExperimentSchema>): Promise<void> {
  const e = await requireExperiment(userId, experimentId);
  const data = completeExperimentSchema.parse(input);
  await getDb()
    .update(schema.experiments)
    .set({ status: "completed", passed: data.passed, learnings: data.learnings, nextAction: data.nextAction || null, endDate: new Date(), startDate: e.startDate ?? new Date() })
    .where(eq(schema.experiments.id, e.id));
}

export async function deleteExperiment(userId: UserId, experimentId: string): Promise<{ projectId: string }> {
  const e = await requireExperiment(userId, experimentId);
  await getDb().delete(schema.experiments).where(eq(schema.experiments.id, e.id));
  return { projectId: e.projectId };
}

export async function addResult(
  userId: UserId,
  experimentId: string,
  input: z.input<typeof resultInputSchema>,
  data?: Record<string, unknown>,
): Promise<ExperimentResult> {
  const e = await requireExperiment(userId, experimentId);
  const parsed = resultInputSchema.parse(input);
  const [row] = await getDb()
    .insert(schema.experimentResults)
    .values({ experimentId: e.id, metric: parsed.metric, value: parsed.value === null ? null : String(parsed.value), notes: parsed.notes || null, data: data ?? null })
    .returning();
  if (e.status === "planned") await startExperiment(userId, e.id);
  return row;
}

export async function listResults(userId: UserId, experimentId: string): Promise<ExperimentResult[]> {
  const e = await getExperiment(userId, experimentId);
  if (!e) return [];
  return getDb().select().from(schema.experimentResults).where(eq(schema.experimentResults.experimentId, e.id)).orderBy(asc(schema.experimentResults.recordedAt));
}

export async function deleteResult(userId: UserId, resultId: string): Promise<void> {
  if (!isUuid(resultId)) throw new NotFoundError("Result");
  const [row] = await getDb()
    .select({ id: schema.experimentResults.id })
    .from(schema.experimentResults)
    .innerJoin(schema.experiments, eq(schema.experiments.id, schema.experimentResults.experimentId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.experiments.projectId))
    .where(and(eq(schema.experimentResults.id, resultId), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!row) throw new NotFoundError("Result");
  await getDb().delete(schema.experimentResults).where(eq(schema.experimentResults.id, row.id));
}

/** Validation evidence for a project: completed experiments and how many passed. */
export async function getValidationSummary(userId: UserId, projectId: string) {
  const experiments = await listExperiments(userId, { projectId });
  const completed = experiments.filter((e) => e.status === "completed");
  return {
    total: experiments.length,
    running: experiments.filter((e) => e.status === "running").length,
    completed: completed.length,
    passed: completed.filter((e) => e.passed === true).length,
    failed: completed.filter((e) => e.passed === false).length,
  };
}

/**
 * Records the Build / Pivot / Drop decision.
 * "Build" requires at least one completed experiment that the user marked as passed.
 */
export async function setDecision(userId: UserId, projectId: string, input: z.input<typeof decisionSchema>): Promise<void> {
  const project = await requireProject(userId, projectId);
  const data = decisionSchema.parse(input);
  if (data.decision === "build") {
    const summary = await getValidationSummary(userId, project.id);
    if (summary.passed === 0) {
      throw new DecisionNotAllowedError("Build needs at least one completed experiment that you marked as passed. Run and record an experiment first.");
    }
  }
  await getDb()
    .update(schema.projects)
    .set({
      decision: data.decision,
      decisionNote: data.note || null,
      ...(data.decision === "build" ? { stage: "planning" as const } : {}),
      ...(data.decision === "drop" ? { status: "archived" as const } : {}),
    })
    .where(and(eq(schema.projects.id, project.id), eq(schema.projects.userId, userId)));
}
