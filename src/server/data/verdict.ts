import "server-only";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { pricingLadder } from "@/lib/competitors";
import { buildVerdict, microSaasFit, type VerdictInput } from "@/lib/verdict";
import { getDb, schema } from "@/server/db/client";
import { listCustomerLanguage } from "./gold-mine";
import { getProfile } from "./profiles";
import { getProjectMapData } from "./project-map";
import { listCompetitors } from "./research";
import { unsafeToUserId, type UserId } from "./user-id";

/** The jobs of the latest one-click validation run, in step order (services/research.ts startFullValidation). */
export async function getLatestValidationRun(userId: UserId, projectId: string) {
  const db = getDb();
  const runOf = sql<string>`${schema.researchJobs.input}->>'run'`;
  const [latest] = await db
    .select({ run: runOf })
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.projectId, projectId), eq(schema.researchJobs.userId, userId), isNotNull(runOf)))
    .orderBy(desc(schema.researchJobs.createdAt))
    .limit(1);
  if (!latest) return null;
  const jobs = await db
    .select({ id: schema.researchJobs.id, status: schema.researchJobs.status, currentStage: schema.researchJobs.currentStage, error: schema.researchJobs.error, finishedAt: schema.researchJobs.finishedAt })
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.projectId, projectId), eq(runOf, latest.run)))
    .orderBy(asc(sql`(${schema.researchJobs.input}->>'step')::int`));
  const active = jobs.some((j) => j.status === "queued" || j.status === "running");
  return { runId: latest.run, jobs, active };
}

/** Everything the verdict scorecard needs. Returns null when the project isn't the user's. */
export async function getVerdictData(userId: UserId, projectId: string) {
  const map = await getProjectMapData(userId, projectId);
  if (!map) return null;
  const [competitors, quotes, profile, run] = await Promise.all([listCompetitors(userId, projectId), listCustomerLanguage(userId, projectId), getProfile(userId), getLatestValidationRun(userId, projectId)]);
  const ladder = pricingLadder(competitors.map((c) => ({ ...c, sources: c.sources })));
  const input: VerdictInput = {
    ratings: map.ratings,
    sources: map.counts.sources,
    facts: map.counts.facts,
    competitors: map.counts.competitors,
    prices: ladder.priced.filter((p) => !p.currency || p.currency.toUpperCase() === "USD").map((p) => p.price),
    quotes: quotes.map((q) => ({ platform: q.platform, theme: q.clusterTitle })),
    signups: map.counts.signups,
    results: map.counts.results,
    profile: profile ? { technicalLevel: profile.technicalLevel, timePerWeek: profile.timePerWeek, budget: profile.budget } : null,
  };
  return { project: map.project, counts: map.counts, ratings: map.ratings, run, verdict: buildVerdict(input), fit: microSaasFit(input), ladder, quotes };
}

/** Public, read-only: a shared verdict report by its token. Only data the owner chose to share. */
export async function getSharedVerdict(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [row] = await getDb()
    .select({ id: schema.projects.id, userId: schema.projects.userId })
    .from(schema.projects)
    .where(and(eq(schema.projects.shareToken, token), eq(schema.projects.status, "active")))
    .limit(1);
  if (!row) return null;
  const owner = unsafeToUserId(row.userId);
  const data = await getVerdictData(owner, row.id);
  if (!data) return null;
  const [report] = await getDb()
    .select({ summary: schema.reports.summary })
    .from(schema.reports)
    .where(and(eq(schema.reports.projectId, row.id), eq(schema.reports.type, "validation")))
    .orderBy(desc(schema.reports.createdAt))
    .limit(1);
  return { ...data, summary: report?.summary ?? null };
}
