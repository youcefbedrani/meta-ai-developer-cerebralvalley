import "server-only";
import { and, eq } from "drizzle-orm";
import { competitorQueriesSchema, competitorScanSchema, priceAppearsIn, type CompetitorScan } from "@/lib/validation/competitors";
import { buildCompetitorExtractPrompt, buildCompetitorQueriesPrompt, COMPETITOR_EXTRACT_SYSTEM, COMPETITOR_QUERIES_SYSTEM, mockCompetitorQueries, mockCompetitorScan } from "@/server/ai/prompts/competitors";
import { callStructured } from "@/server/ai/run";
import { refundCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { getIdeaForProject } from "@/server/data/ideas";
import { getProject } from "@/server/data/projects";
import { unsafeToUserId } from "@/server/data/user-id";
import { getPageReader, getSearchProvider } from "@/server/search";
import { competitorKey, dedupeResults, mapLimit, researchCreditRef, ResearchError, safeErrorMessage, setStage } from "./pipeline";
import { quoteAppearsIn } from "./verify";

/*
 * Competitor scan: finds more competitors and fills gaps (pricing, features, strengths) for the
 * ones already known. Runs on the research queue. Same trust rules as research: every competitor
 * must appear in a stored source, and pricing is kept only when the quote and each price are
 * found verbatim in that source's text. Results are merged in; nothing the user has is deleted.
 */

const MAX_SOURCES = 12;
const PRICING_LOOKUPS = 4;
const SOURCE_TEXT_LIMIT = 4_000;

type Job = typeof schema.researchJobs.$inferSelect;

/** Drops anything not backed by the sources. Pure: unit-tested. */
export function verifyCompetitorScan(scan: CompetitorScan, sourceText: Map<string, string>) {
  const stats = { found: scan.competitors.length, kept: 0, pricingKept: 0, pricingDropped: 0 };
  const competitors = scan.competitors.flatMap((c) => {
    const sources = c.sources.filter((k) => sourceText.has(k));
    if (!sources.length) return [];
    let pricing = c.pricing;
    if (pricing) {
      const text = sourceText.get(pricing.source);
      const quoteOk = !!text && quoteAppearsIn(pricing.quote, text);
      const plans = quoteOk ? pricing.plans.filter((p) => p.priceMonthly === null || priceAppearsIn(p.priceMonthly, pricing!.quote)) : [];
      if (!quoteOk || (pricing.plans.length && !plans.length)) {
        pricing = null;
        stats.pricingDropped++;
      } else {
        pricing = { ...pricing, plans };
        stats.pricingKept++;
      }
    }
    stats.kept++;
    return [
      {
        ...c,
        sources,
        pricing,
        strengths: c.strengths.filter((s) => sourceText.has(s.source)),
        weaknesses: c.weaknesses.filter((s) => sourceText.has(s.source)),
      },
    ];
  });
  return { competitors, stats };
}

const domainOf = (url: string | null | undefined) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
};
const union = (a: string[] | null | undefined, b: string[], max = 20) => [...new Map([...(a ?? []), ...b].map((x) => [x.toLowerCase(), x])).values()].slice(0, max);

export async function runCompetitorScan(job: Job): Promise<void> {
  const db = getDb();
  const userId = unsafeToUserId(job.userId);
  await db.update(schema.researchJobs).set({ status: "running", startedAt: new Date(), currentStage: "planning", error: null }).where(eq(schema.researchJobs.id, job.id));
  try {
    const project = await getProject(userId, job.projectId);
    if (!project) throw new ResearchError("The project no longer exists.");
    const idea = await getIdeaForProject(userId, project.id);
    const ctx = { name: project.name, description: project.description, idea: idea?.content ?? null };
    const ai = { userId, projectId: project.id };
    const existing = await db.select().from(schema.competitors).where(eq(schema.competitors.projectId, project.id));

    // 1. Queries: AI-planned discovery searches + a pricing lookup for known competitors without pricing.
    const plan = await callStructured({ ...ai, operation: "competitor_queries", tier: "fast", schema: competitorQueriesSchema, system: COMPETITOR_QUERIES_SYSTEM, prompt: buildCompetitorQueriesPrompt(ctx, existing.map((c) => c.name)), mock: () => mockCompetitorQueries(ctx) });
    const pricingQueries = existing.filter((c) => !c.pricingSourceId).slice(0, PRICING_LOOKUPS).map((c) => `${c.name} pricing`);
    const queries = [...plan.queries, ...pricingQueries];

    // 2. Search + read
    await setStage(job.id, "searching");
    const search = getSearchProvider();
    const settled = await Promise.allSettled(queries.map((q) => search.search(q, { maxResults: 4 })));
    if (settled.every((s) => s.status === "rejected")) throw new ResearchError("Web search failed. Your credits were refunded — please try again later.");
    const results = dedupeResults(settled.flatMap((s) => (s.status === "fulfilled" ? s.value : [])), MAX_SOURCES);
    if (!results.length) throw new ResearchError("No web sources were found. Try making the project description more specific.");

    await setStage(job.id, "reading");
    const reader = getPageReader();
    const pages = await mapLimit(results, 4, async (r) => ({ r, page: await reader.read(r.url) }));
    const stored = await db
      .insert(schema.sources)
      .values(pages.map(({ r }) => ({ researchJobId: job.id, url: r.url, title: r.title || null, domain: new URL(r.url).hostname.replace(/^www\./, ""), snippet: r.snippet || null, publishedAt: r.publishedAt })))
      .returning({ id: schema.sources.id });
    const keyed = pages.map(({ r, page }, i) => ({ key: `S${i + 1}`, id: stored[i].id, url: r.url, title: r.title || page?.title || r.url, text: (page?.text || r.snippet || "").slice(0, SOURCE_TEXT_LIMIT) }));
    const sourceText = new Map(keyed.map((s) => [s.key, s.text]));
    const idByKey = new Map(keyed.map((s) => [s.key, s.id]));

    // 3. Extract + verify
    await setStage(job.id, "extracting");
    const raw = await callStructured({ ...ai, operation: "competitor_extract", tier: "fast", schema: competitorScanSchema, system: COMPETITOR_EXTRACT_SYSTEM, prompt: buildCompetitorExtractPrompt(ctx, keyed), mock: () => mockCompetitorScan(keyed.map((s) => s.key)) });
    const { competitors, stats } = verifyCompetitorScan(raw, sourceText);

    // 4. Merge: fill gaps on known competitors, add new ones. Never deletes.
    await setStage(job.id, "saving");
    let added = 0;
    let updated = 0;
    await db.transaction(async (tx) => {
      const now = new Date();
      for (const c of competitors) {
        const match = existing.find((e) => competitorKey(e.name) === competitorKey(c.name) || (!!domainOf(c.website) && domainOf(e.website) === domainOf(c.website)));
        const sourceIds = c.sources.map((k) => idByKey.get(k)!).filter(Boolean);
        const pricing = c.pricing
          ? { pricing: { summary: c.pricing.summary, sources: [c.pricing.source] }, pricingSourceId: idByKey.get(c.pricing.source) ?? null, pricingPlans: c.pricing.plans.map((p) => ({ ...p, quote: c.pricing!.quote })) }
          : {};
        const strengths = c.strengths.map((s) => s.text);
        const weaknesses = c.weaknesses.map((s) => s.text);
        if (match) {
          await tx
            .update(schema.competitors)
            .set({
              website: match.website ?? c.website,
              description: match.description ?? c.description,
              targetCustomer: match.targetCustomer ?? c.targetCustomer,
              features: union(match.features, c.features),
              strengths: union(match.strengths, strengths, 10),
              weaknesses: union(match.weaknesses, weaknesses, 10),
              sourceIds: union(match.sourceIds, sourceIds, 30),
              ...pricing,
              lastScannedAt: now,
            })
            .where(and(eq(schema.competitors.id, match.id), eq(schema.competitors.projectId, project.id)));
          updated++;
        } else {
          await tx.insert(schema.competitors).values({
            projectId: project.id,
            origin: "scan",
            name: c.name,
            website: c.website,
            type: c.type,
            description: c.description,
            targetCustomer: c.targetCustomer,
            features: c.features,
            strengths,
            weaknesses,
            sourceIds,
            ...pricing,
            retrievedAt: now,
            lastScannedAt: now,
          });
          added++;
        }
      }
      const done = await tx
        .update(schema.researchJobs)
        .set({ status: "succeeded", currentStage: null, finishedAt: now, input: { ...job.input, result: { ...stats, added, updated, sources: keyed.length } } })
        .where(and(eq(schema.researchJobs.id, job.id), eq(schema.researchJobs.status, "running")))
        .returning({ id: schema.researchJobs.id });
      if (!done.length) throw new ScanCancelled();
    });
  } catch (err) {
    if (err instanceof ScanCancelled) return;
    console.error(`[competitor-scan] job ${job.id} failed:`, err instanceof Error ? `${err.name}: ${err.message}` : err);
    await db
      .update(schema.researchJobs)
      .set({ status: "failed", error: safeErrorMessage(err), finishedAt: new Date() })
      .where(and(eq(schema.researchJobs.id, job.id), eq(schema.researchJobs.status, "running")));
    await refundCredits(userId, researchCreditRef(job.id), "competitor scan failed");
  }
}

class ScanCancelled extends Error {}
