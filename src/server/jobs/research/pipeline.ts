import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { ConfigError } from "@/lib/env";
import {
  extractionSchema,
  REPORT_SCHEMA_VERSION,
  researchPlanSchema,
  validationReportSchema,
  type ResearchStage,
} from "@/lib/validation/research";
import { AIInvalidOutputError, AIProviderError } from "@/server/ai/errors";
import {
  buildExtractPrompt,
  buildPlanPrompt,
  buildSynthPrompt,
  EXTRACT_SYSTEM,
  mockExtraction,
  mockPlan,
  mockReport,
  PLAN_SYSTEM,
  RESEARCH_PROMPT_VERSION,
  SYNTH_SYSTEM,
  type ProjectContext,
} from "@/server/ai/prompts/research";
import { callStructured } from "@/server/ai/run";
import { refundCredits } from "@/server/billing/credits";
import { runCompetitorScan } from "./competitor-scan";
import { runMarketVoices } from "./market-voices";
import { runDesignJob } from "@/server/jobs/design";
import { designCreditRef } from "@/server/services/design";
import { getDb, schema } from "@/server/db/client";
import { getIdeaForProject } from "@/server/data/ideas";
import { getProject } from "@/server/data/projects";
import { unsafeToUserId, type UserId } from "@/server/data/user-id";
import { getPageReader, getSearchProvider, type SearchResult } from "@/server/search";
import { enqueueResearch } from "@/server/jobs/queue";
import { verifyExtraction, verifyReport } from "./verify";

const MAX_QUERIES = 6;
const RESULTS_PER_QUERY = 5;
const MAX_SOURCES = 10;
const SOURCE_TEXT_LIMIT = 4_000;
const READ_CONCURRENCY = 4;

class JobCancelledError extends Error {}

/** Normalised name for matching the same competitor across research, scans and manual entries. */
export const competitorKey = (name: string) => name.toLowerCase().replace(/\b(inc|llc|ltd|app|hq|io)\b/g, "").replace(/[^a-z0-9]/g, "");

export const researchCreditRef = (jobId: string) => `research_job:${jobId}`;

export class ResearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchError";
  }
}

export async function setStage(jobId: string, stage: ResearchStage) {
  await getDb().update(schema.researchJobs).set({ currentStage: stage }).where(eq(schema.researchJobs.id, jobId));
}

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) if (p.startsWith("utm_") || p === "ref" || p === "fbclid" || p === "gclid") u.searchParams.delete(p);
    u.hostname = u.hostname.replace(/^www\./, "");
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function dedupeResults(results: SearchResult[], max: number): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    const key = normalizeUrl(r.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export function safeErrorMessage(err: unknown): string {
  if (err instanceof ResearchError || err instanceof ConfigError || err instanceof AIInvalidOutputError || err instanceof AIProviderError) return err.message;
  return "Research failed unexpectedly. Your credits were refunded — please try again.";
}

/**
 * Runs one research job end to end. Idempotent: jobs that are already finished are skipped.
 * On any failure the job is marked failed with a safe message and its credits are refunded.
 */
export async function runResearchJob(jobId: string): Promise<void> {
  const [job] = await getDb().select().from(schema.researchJobs).where(eq(schema.researchJobs.id, jobId)).limit(1);
  if (!job) return;
  try {
    if (job.status !== "queued" && job.status !== "running") return;
    // Competitor and market-voices scans share the research queue, credits and job tracking.
    if (job.input?.kind === "competitor_scan") await runCompetitorScan(job);
    else if (job.input?.kind === "market_voices") await runMarketVoices(job);
    else if (job.input?.kind === "design") await runDesignJob(job);
    else await runValidationResearch(job);
  } finally {
    await queueNextStep(job);
  }
}

/**
 * Full validation runs (services/research.ts startFullValidation) chain their jobs: whatever happened
 * to this step, queue the next one. A step that can't be queued stays "queued" and is failed and
 * refunded by recoverStaleJobs.
 */
async function queueNextStep(job: typeof schema.researchJobs.$inferSelect) {
  const next = Array.isArray(job.input?.next) ? (job.input.next as string[]) : [];
  if (!next.length) return;
  await enqueueResearch(next[0]).catch((err) => console.error(`[research] could not queue next step ${next[0]}:`, err instanceof Error ? err.message : err));
}

async function runValidationResearch(job: typeof schema.researchJobs.$inferSelect): Promise<void> {
  const db = getDb();
  const jobId = job.id;
  const userId: UserId = unsafeToUserId(job.userId);

  await db.update(schema.researchJobs).set({ status: "running", startedAt: new Date(), currentStage: "planning", error: null }).where(eq(schema.researchJobs.id, jobId));

  try {
    const project = await getProject(userId, job.projectId);
    if (!project) throw new ResearchError("The project no longer exists.");
    const idea = await getIdeaForProject(userId, project.id);
    const ctx: ProjectContext = { name: project.name, description: project.description, idea: idea?.content ?? null };
    const ai = { userId, projectId: project.id };

    // 1. Plan
    const plan = await callStructured({ ...ai, operation: "research_plan", tier: "fast", schema: researchPlanSchema, system: PLAN_SYSTEM, prompt: buildPlanPrompt(ctx), mock: () => mockPlan(ctx) });

    // 2. Search
    await setStage(jobId, "searching");
    const search = getSearchProvider();
    const settled = await Promise.allSettled(plan.queries.slice(0, MAX_QUERIES).map((q) => search.search(q, { maxResults: RESULTS_PER_QUERY })));
    if (settled.every((s) => s.status === "rejected")) throw new ResearchError("Web search failed. Your credits were refunded — please try again later.");
    const results = dedupeResults(settled.flatMap((s) => (s.status === "fulfilled" ? s.value : [])), MAX_SOURCES);
    if (!results.length) throw new ResearchError("No web sources were found for this idea. Try making the project description more specific.");

    // 3. Read + store sources
    await setStage(jobId, "reading");
    const reader = getPageReader();
    const pages = await mapLimit(results, READ_CONCURRENCY, async (r) => ({ r, page: await reader.read(r.url) }));
    const stored = await db
      .insert(schema.sources)
      .values(
        pages.map(({ r }) => ({
          researchJobId: jobId,
          url: r.url,
          title: r.title || null,
          domain: new URL(r.url).hostname.replace(/^www\./, ""),
          snippet: r.snippet || null,
          publishedAt: r.publishedAt,
        })),
      )
      .returning({ id: schema.sources.id, url: schema.sources.url });
    const keyed = pages.map(({ r, page }, i) => ({
      key: `S${i + 1}`,
      id: stored[i].id,
      url: r.url,
      title: r.title || page?.title || r.url,
      text: (page?.text || r.snippet || "").slice(0, SOURCE_TEXT_LIMIT),
    }));
    const sourceText = new Map(keyed.map((s) => [s.key, s.text]));

    // 4. Extract evidence (quotes verified against stored text)
    await setStage(jobId, "extracting");
    const rawExtraction = await callStructured({
      ...ai,
      operation: "research_extract",
      tier: "fast",
      schema: extractionSchema,
      system: EXTRACT_SYSTEM,
      prompt: buildExtractPrompt(ctx, keyed),
      mock: () => mockExtraction(keyed.map((s) => s.key)),
    });
    const { extraction, stats: extractionStats } = verifyExtraction(rawExtraction, sourceText);

    // 5. Synthesize the report (smart model)
    await setStage(jobId, "synthesizing");
    const rawReport = await callStructured({
      ...ai,
      operation: "research_synthesize",
      tier: "smart",
      schema: validationReportSchema,
      system: SYNTH_SYSTEM,
      prompt: buildSynthPrompt(ctx, keyed.map(({ key, url, title }) => ({ key, url, title })), extraction),
      mock: () => mockReport(keyed.map((s) => s.key)),
    });

    // 6. Verify every citation references a stored source
    await setStage(jobId, "verifying");
    const validKeys = new Set(keyed.map((s) => s.key));
    const pricingKeys = new Set(extraction.competitors.map((c) => c.pricingSourceKey).filter((k): k is string => !!k));
    const { report, stats: reportStats } = verifyReport(rawReport, validKeys, pricingKeys);
    const idByKey = new Map(keyed.map((s) => [s.key, s.id]));

    // 7. Save
    await setStage(jobId, "saving");
    await db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(schema.reports)
        .values({
          projectId: project.id,
          researchJobId: jobId,
          type: "validation",
          schemaVersion: REPORT_SCHEMA_VERSION,
          content: {
            report,
            sourceKeys: Object.fromEntries(idByKey),
            meta: { promptVersion: RESEARCH_PROMPT_VERSION, focus: plan.focus, queries: plan.queries, verification: { ...extractionStats, ...reportStats } },
          },
          summary: report.summary,
          ratings: report.ratings,
        })
        .returning({ id: schema.reports.id });

      await tx.update(schema.sources).set({ reportId: saved.id }).where(eq(schema.sources.researchJobId, jobId));

      const evidenceRows = Object.entries(report.sections).flatMap(([section, list]) =>
        list.map((st) => ({ reportId: saved.id, sourceId: st.sources.map((k) => idByKey.get(k)).find(Boolean) ?? null, claim: st.text, kind: st.kind, section })),
      );
      if (evidenceRows.length) await tx.insert(schema.evidence).values(evidenceRows);

      // Research competitors reflect the latest research; scanned and user-added ones are kept,
      // and a research competitor that's already in the list isn't added twice.
      await tx.delete(schema.competitors).where(and(eq(schema.competitors.projectId, project.id), eq(schema.competitors.origin, "research")));
      const kept = new Set((await tx.select({ name: schema.competitors.name }).from(schema.competitors).where(eq(schema.competitors.projectId, project.id))).map((c) => competitorKey(c.name)));
      const fresh = report.competitors.filter((c) => !kept.has(competitorKey(c.name)));
      if (fresh.length) {
        await tx.insert(schema.competitors).values(
          fresh.map((c) => ({
            projectId: project.id,
            name: c.name,
            website: c.website,
            type: c.type,
            features: c.features,
            strengths: c.strengths,
            weaknesses: c.weaknesses,
            pricing: c.pricing ? { summary: c.pricing.summary, sources: c.sources } : null,
            pricingSourceId: c.pricing ? (idByKey.get(c.pricing.source) ?? null) : null,
            sourceIds: c.sources.map((k) => idByKey.get(k)).filter((x): x is string => !!x),
            retrievedAt: new Date(),
          })),
        );
      }

      await tx
        .update(schema.projects)
        .set({ nextAction: report.nextAction.slice(0, 300), ...(project.stage === "idea" ? { stage: "research" as const } : {}) })
        .where(and(eq(schema.projects.id, project.id), eq(schema.projects.userId, userId)));

      const updated = await tx
        .update(schema.researchJobs)
        .set({ status: "succeeded", currentStage: null, finishedAt: new Date() })
        .where(and(eq(schema.researchJobs.id, jobId), eq(schema.researchJobs.status, "running")))
        .returning({ id: schema.researchJobs.id });
      // Cancelled by an admin while running: throw to roll back the report.
      if (!updated.length) throw new JobCancelledError();
    });
  } catch (err) {
    if (err instanceof JobCancelledError) return;
    console.error(`[research] job ${jobId} failed:`, err instanceof Error ? `${err.name}: ${err.message}` : err);
    await db
      .update(schema.researchJobs)
      .set({ status: "failed", error: safeErrorMessage(err), finishedAt: new Date() })
      .where(and(eq(schema.researchJobs.id, jobId), eq(schema.researchJobs.status, "running")));
    await refundCredits(userId, researchCreditRef(jobId), "research job failed");
  }
}

/** Fails jobs stuck in queued/running (e.g. after a worker crash) and refunds them. */
export async function recoverStaleJobs(olderThanMinutes = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const stale = await getDb()
    .update(schema.researchJobs)
    .set({ status: "failed", error: "The job timed out. Your credits were refunded — please try again.", finishedAt: new Date() })
    .where(and(inArray(schema.researchJobs.status, ["queued", "running"]), lt(schema.researchJobs.updatedAt, cutoff)))
    .returning({ id: schema.researchJobs.id, userId: schema.researchJobs.userId });
  for (const job of stale) {
    const userId = unsafeToUserId(job.userId);
    await refundCredits(userId, researchCreditRef(job.id), "research job timed out");
    // Design jobs reserve credits per screen.
    const unfinished = await getDb()
      .update(schema.designScreens)
      .set({ status: "failed", error: "Timed out. Your credits were refunded." })
      .where(and(eq(schema.designScreens.jobId, job.id), inArray(schema.designScreens.status, ["queued", "running"])))
      .returning({ id: schema.designScreens.id });
    for (const s of unfinished) await refundCredits(userId, designCreditRef(s.id), "design screen timed out");
  }
  return stale.length;
}
