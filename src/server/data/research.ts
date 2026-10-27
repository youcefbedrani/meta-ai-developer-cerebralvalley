import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { validationReportSchema, type ValidationReport } from "@/lib/validation/research";
import { getDb, schema } from "@/server/db/client";
import type { UserId } from "./user-id";

/*
 * Read access to research jobs, reports, sources and competitors.
 * Ownership is enforced by joining through projects.user_id.
 */

const isUuid = (id: string) => z.uuid().safeParse(id).success;
const ownsProject = (userId: UserId, projectId: string) => and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId));

export type ResearchJob = typeof schema.researchJobs.$inferSelect;

export async function listResearchJobs(userId: UserId, projectId: string, limit = 10): Promise<ResearchJob[]> {
  if (!isUuid(projectId)) return [];
  return getDb()
    .select()
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.projectId, projectId), eq(schema.researchJobs.userId, userId), notScan))
    .orderBy(desc(schema.researchJobs.createdAt))
    .limit(limit);
}

/** Competitor scans and market-voices scans share the research_jobs table (input.kind). */
const notScan = sql`coalesce(${schema.researchJobs.input}->>'kind', '') not in ('competitor_scan', 'market_voices', 'design')`;

async function latestJobOfKind(userId: UserId, projectId: string, kind: "competitor_scan" | "market_voices"): Promise<ResearchJob | null> {
  if (!isUuid(projectId)) return null;
  const [row] = await getDb()
    .select()
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.projectId, projectId), eq(schema.researchJobs.userId, userId), sql`${schema.researchJobs.input}->>'kind' = ${kind}`))
    .orderBy(desc(schema.researchJobs.createdAt))
    .limit(1);
  return row ?? null;
}

export const getLatestCompetitorScan = (userId: UserId, projectId: string) => latestJobOfKind(userId, projectId, "competitor_scan");
export const getLatestMarketVoices = (userId: UserId, projectId: string) => latestJobOfKind(userId, projectId, "market_voices");

export async function getResearchJob(userId: UserId, jobId: string): Promise<ResearchJob | null> {
  if (!isUuid(jobId)) return null;
  const [row] = await getDb()
    .select()
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.id, jobId), eq(schema.researchJobs.userId, userId)))
    .limit(1);
  return row ?? null;
}

const contentSchema = z.object({
  report: validationReportSchema,
  sourceKeys: z.record(z.string(), z.string()),
  meta: z.object({ promptVersion: z.string(), focus: z.string(), queries: z.array(z.string()), verification: z.record(z.string(), z.number()) }),
});

export type SourceRow = typeof schema.sources.$inferSelect;
export type LoadedReport = {
  id: string;
  createdAt: Date;
  report: ValidationReport;
  meta: z.output<typeof contentSchema>["meta"];
  /** Source key (S1…) → stored source. */
  sources: Map<string, SourceRow>;
};

export async function getLatestValidationReport(userId: UserId, projectId: string): Promise<LoadedReport | null> {
  if (!isUuid(projectId)) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: schema.reports.id, createdAt: schema.reports.createdAt, content: schema.reports.content })
    .from(schema.reports)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.reports.projectId))
    .where(and(ownsProject(userId, projectId), eq(schema.reports.type, "validation")))
    .orderBy(desc(schema.reports.createdAt))
    .limit(1);
  if (!row) return null;
  const content = contentSchema.safeParse(row.content);
  if (!content.success) return null;
  const sourceRows = await db.select().from(schema.sources).where(eq(schema.sources.reportId, row.id));
  const byId = new Map(sourceRows.map((s) => [s.id, s]));
  const sources = new Map<string, SourceRow>();
  for (const [key, id] of Object.entries(content.data.sourceKeys)) {
    const s = byId.get(id);
    if (s) sources.set(key, s);
  }
  return { id: row.id, createdAt: row.createdAt, report: content.data.report, meta: content.data.meta, sources };
}

type SourceRef = { id: string; url: string; title: string | null; domain: string; retrievedAt: Date };
export type CompetitorRow = typeof schema.competitors.$inferSelect & { pricingSource: SourceRef | null; sources: SourceRef[] };

export async function listCompetitors(userId: UserId, projectId: string): Promise<CompetitorRow[]> {
  if (!isUuid(projectId)) return [];
  const db = getDb();
  const rows = await db
    .select({ c: schema.competitors })
    .from(schema.competitors)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.competitors.projectId))
    .where(ownsProject(userId, projectId))
    .orderBy(schema.competitors.type, schema.competitors.name);
  const sourceIds = [...new Set(rows.flatMap((r) => [r.c.pricingSourceId, ...(r.c.sourceIds ?? [])]).filter((x): x is string => !!x && isUuid(x)))];
  const srcs = sourceIds.length
    ? await db.select({ id: schema.sources.id, url: schema.sources.url, title: schema.sources.title, domain: schema.sources.domain, retrievedAt: schema.sources.retrievedAt }).from(schema.sources).where(inArray(schema.sources.id, sourceIds))
    : [];
  const byId = new Map(srcs.map((s) => [s.id, s]));
  return rows.map(({ c }) => ({
    ...c,
    pricingSource: (c.pricingSourceId && byId.get(c.pricingSourceId)) || null,
    sources: (c.sourceIds ?? []).map((id) => byId.get(id)).filter((s): s is SourceRef => !!s),
  }));
}

/** One row per active project with its latest job and report date. */
export async function getResearchOverview(userId: UserId) {
  const db = getDb();
  const projects = await db
    .select({ id: schema.projects.id, name: schema.projects.name, stage: schema.projects.stage })
    .from(schema.projects)
    .where(and(eq(schema.projects.userId, userId), eq(schema.projects.status, "active")))
    .orderBy(desc(schema.projects.updatedAt));
  if (!projects.length) return [];
  const ids = projects.map((p) => p.id);
  const jobs = await db
    .select()
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.userId, userId), inArray(schema.researchJobs.projectId, ids), notScan))
    .orderBy(desc(schema.researchJobs.createdAt));
  const reports = await db
    .select({ projectId: schema.reports.projectId, createdAt: schema.reports.createdAt, summary: schema.reports.summary })
    .from(schema.reports)
    .where(and(inArray(schema.reports.projectId, ids), eq(schema.reports.type, "validation")))
    .orderBy(desc(schema.reports.createdAt));
  return projects.map((p) => ({
    ...p,
    latestJob: jobs.find((j) => j.projectId === p.id) ?? null,
    latestReport: reports.find((r) => r.projectId === p.id) ?? null,
  }));
}
