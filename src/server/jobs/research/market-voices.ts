import "server-only";
import { and, eq } from "drizzle-orm";
import { MARKET_PLATFORMS, platformForUrl, themeLabel } from "@/lib/market-platforms";
import { voiceQueriesSchema, voicesSchema, type Voices } from "@/lib/validation/competitors";
import { buildVoiceQueriesPrompt, buildVoicesPrompt, mockVoiceQueries, mockVoices, VOICE_QUERIES_SYSTEM, VOICES_SYSTEM } from "@/server/ai/prompts/market-voices";
import { callStructured } from "@/server/ai/run";
import { refundCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { communityFor } from "@/server/discussions/web";
import { getIdeaForProject } from "@/server/data/ideas";
import { getProject } from "@/server/data/projects";
import { unsafeToUserId } from "@/server/data/user-id";
import { getPageReader, getSearchProvider } from "@/server/search";
import { dedupeResults, mapLimit, researchCreditRef, ResearchError, safeErrorMessage, setStage } from "./pipeline";
import { quoteAppearsIn } from "./verify";

/*
 * Market voices: what people say about the problem on Reddit, Quora, YouTube, Facebook, X, LinkedIn,
 * TikTok, Hacker News, Indie Hackers, Product Hunt, review sites and Stack Exchange.
 * One domain-restricted search per platform, so we only see what is publicly indexed there.
 * Every quote must appear word for word in the stored page (or search snippet) it came from.
 * Quotes go into the project's customer-language library, tagged by platform and theme.
 */

const PER_PLATFORM = 3;
const TEXT_LIMIT = 3_000;

type Job = typeof schema.researchJobs.$inferSelect;

/** Keeps only quotes found verbatim in their source. Pure: unit-tested. */
export function verifyVoices(v: Voices, sourceText: Map<string, string>) {
  const seen = new Set<string>();
  const quotes = v.quotes.filter((q) => {
    const text = sourceText.get(q.source);
    const key = `${q.source}:${q.quote.toLowerCase()}`;
    if (!text || !quoteAppearsIn(q.quote, text) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { quotes, dropped: v.quotes.length - quotes.length };
}

export async function runMarketVoices(job: Job): Promise<void> {
  const db = getDb();
  const userId = unsafeToUserId(job.userId);
  await db.update(schema.researchJobs).set({ status: "running", startedAt: new Date(), currentStage: "planning", error: null }).where(eq(schema.researchJobs.id, job.id));
  try {
    const project = await getProject(userId, job.projectId);
    if (!project) throw new ResearchError("The project no longer exists.");
    const idea = await getIdeaForProject(userId, project.id);
    const ctx = { name: project.name, description: project.description, idea: idea?.content ?? null };
    const ai = { userId, projectId: project.id };

    const plan = await callStructured({ ...ai, operation: "voice_queries", tier: "fast", schema: voiceQueriesSchema, system: VOICE_QUERIES_SYSTEM, prompt: buildVoiceQueriesPrompt(ctx), mock: () => mockVoiceQueries(ctx) });

    // 1. One search per platform (queries rotate so each platform gets a different angle).
    await setStage(job.id, "searching");
    const search = getSearchProvider();
    const perPlatform = await Promise.all(
      MARKET_PLATFORMS.map(async (p, i) => {
        try {
          const results = await search.search(plan.queries[i % plan.queries.length], { maxResults: PER_PLATFORM, includeDomains: [...p.domains] });
          // Providers that ignore domain filters may return other sites; keep only this platform's pages.
          return { platform: p, results: results.filter((r) => platformForUrl(r.url)?.key === p.key), failed: false };
        } catch {
          return { platform: p, results: [], failed: true };
        }
      }),
    );
    if (perPlatform.every((p) => p.failed)) throw new ResearchError("Web search failed. Your credits were refunded — please try again later.");
    const results = dedupeResults(perPlatform.flatMap((p) => p.results), MARKET_PLATFORMS.length * PER_PLATFORM);
    if (!results.length) throw new ResearchError("No public discussions were found on any platform. Try making the project description more specific.");

    // 2. Read (fall back to the search snippet when a page is behind a login, e.g. Facebook).
    await setStage(job.id, "reading");
    const reader = getPageReader();
    const pages = await mapLimit(results, 4, async (r) => ({ r, page: await reader.read(r.url).catch(() => null) }));
    const stored = await db
      .insert(schema.sources)
      .values(pages.map(({ r }) => ({ researchJobId: job.id, url: r.url, title: r.title || null, domain: new URL(r.url).hostname.replace(/^www\./, ""), snippet: r.snippet || null, publishedAt: r.publishedAt })))
      .returning({ id: schema.sources.id });
    const keyed = pages.map(({ r, page }, i) => ({
      key: `S${i + 1}`,
      id: stored[i].id,
      url: r.url,
      platform: platformForUrl(r.url)?.label ?? "Web",
      postedAt: r.publishedAt,
      text: `${page?.text ? page.text.slice(0, TEXT_LIMIT) : ""}\n${r.snippet ?? ""}`.trim(),
    }));
    const sourceText = new Map(keyed.map((s) => [s.key, s.text]));

    // 3. Extract + verify
    await setStage(job.id, "extracting");
    const raw = await callStructured({ ...ai, operation: "voice_extract", tier: "fast", schema: voicesSchema, system: VOICES_SYSTEM, prompt: buildVoicesPrompt(ctx, keyed), mock: () => mockVoices(keyed.map((s) => s.key)) });
    const { quotes, dropped } = verifyVoices(raw, sourceText);

    // 4. Save into the customer-language library (skip quotes already there for this URL).
    await setStage(job.id, "saving");
    const byKey = new Map(keyed.map((s) => [s.key, s]));
    await db.transaction(async (tx) => {
      const existing = await tx.select({ url: schema.customerLanguageQuotes.url, quote: schema.customerLanguageQuotes.quote }).from(schema.customerLanguageQuotes).where(eq(schema.customerLanguageQuotes.projectId, project.id));
      const have = new Set(existing.map((e) => `${e.url}\n${e.quote.toLowerCase()}`));
      const now = new Date();
      const rows = quotes
        .map((q) => ({ q, s: byKey.get(q.source)! }))
        .filter(({ q, s }) => !have.has(`${s.url}\n${q.quote.toLowerCase()}`))
        .map(({ q, s }) => ({
          userId,
          projectId: project.id,
          clusterTitle: themeLabel(q.theme),
          quote: q.quote,
          url: s.url,
          platform: s.platform,
          community: communityFor(new URL(s.url)),
          postedAt: s.postedAt,
          retrievedAt: now,
        }));
      if (rows.length) await tx.insert(schema.customerLanguageQuotes).values(rows);

      const coverage = MARKET_PLATFORMS.map((p) => {
        const found = perPlatform.find((x) => x.platform.key === p.key)!;
        return { key: p.key, found: found.results.length, quotes: quotes.filter((q) => byKey.get(q.source)?.platform === p.label).length, failed: found.failed };
      });
      const themes = Object.fromEntries(["pain", "desire", "alternative", "price", "question", "praise"].map((t) => [t, quotes.filter((q) => q.theme === t).length]));
      const done = await tx
        .update(schema.researchJobs)
        .set({ status: "succeeded", currentStage: null, finishedAt: now, input: { ...job.input, result: { queries: plan.queries, coverage, themes, saved: rows.length, dropped, sources: keyed.length } } })
        .where(and(eq(schema.researchJobs.id, job.id), eq(schema.researchJobs.status, "running")))
        .returning({ id: schema.researchJobs.id });
      if (!done.length) throw new ScanCancelled();
    });
  } catch (err) {
    if (err instanceof ScanCancelled) return;
    console.error(`[market-voices] job ${job.id} failed:`, err instanceof Error ? `${err.name}: ${err.message}` : err);
    await db
      .update(schema.researchJobs)
      .set({ status: "failed", error: safeErrorMessage(err), finishedAt: new Date() })
      .where(and(eq(schema.researchJobs.id, job.id), eq(schema.researchJobs.status, "running")));
    await refundCredits(userId, researchCreditRef(job.id), "market voices scan failed");
  }
}

class ScanCancelled extends Error {}
