import "server-only";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { computeValidationLevel, type ProjectStats } from "@/lib/marketplace/validation-level";
import { getDb, schema } from "@/server/db/client";

/** Numbers the validation level is computed from. Tracked counts come from our own tables only. */
export async function getProjectStats(projectId: string): Promise<ProjectStats> {
  const db = getDb();
  const { reports, sources, experiments, experimentResults, landingPages, waitlistSignups, pageEvents, channelResults } = schema;
  const [[r], [src], exps, [visits], [signups], [self]] = await Promise.all([
    db.select({ n: count() }).from(reports).where(and(eq(reports.projectId, projectId), eq(reports.type, "validation"))),
    db.select({ n: count() }).from(sources).innerJoin(reports, eq(reports.id, sources.reportId)).where(eq(reports.projectId, projectId)),
    db
      .select({ id: experiments.id, type: experiments.type, passed: experiments.passed, results: sql<number>`(select count(*) from ${experimentResults} where ${experimentResults.experimentId} = ${experiments.id})`.mapWith(Number) })
      .from(experiments)
      .where(and(eq(experiments.projectId, projectId), eq(experiments.status, "completed"))),
    db.select({ n: count() }).from(pageEvents).innerJoin(landingPages, eq(landingPages.id, pageEvents.landingPageId)).where(and(eq(landingPages.projectId, projectId), eq(pageEvents.type, "visit"))),
    db.select({ n: count() }).from(waitlistSignups).innerJoin(landingPages, eq(landingPages.id, waitlistSignups.landingPageId)).where(eq(landingPages.projectId, projectId)),
    db
      .select({ signups: sql<number | null>`sum(${channelResults.signups})`.mapWith((v) => (v === null ? null : Number(v))), customers: sql<number | null>`sum(${channelResults.customers})`.mapWith((v) => (v === null ? null : Number(v))), revenue: sql<number | null>`sum(${channelResults.revenue})`.mapWith((v) => (v === null ? null : Number(v))) })
      .from(channelResults)
      .where(eq(channelResults.projectId, projectId)),
  ]);
  const withResults = exps.filter((e) => e.results > 0);
  const interviewIds = exps.filter((e) => e.type === "interview").map((e) => e.id);
  const [interviews] = interviewIds.length ? await db.select({ n: count() }).from(experimentResults).where(inArray(experimentResults.experimentId, interviewIds)) : [{ n: 0 }];
  return {
    researchReports: r.n,
    reportSources: src.n,
    completedExperimentsWithResults: withResults.length,
    trackedVisits: visits.n,
    trackedSignups: signups.n,
    loggedInterviews: interviews.n,
    preSales: exps.filter((e) => e.type === "pre_sale" && e.passed && e.results > 0).length,
    verifiedRevenueCents: null,
    selfReported: { signups: self?.signups ?? null, customers: self?.customers ?? null, revenue: self?.revenue ?? null },
  };
}

export async function getProjectValidation(projectId: string) {
  const stats = await getProjectStats(projectId);
  return { stats, level: computeValidationLevel(stats) };
}
