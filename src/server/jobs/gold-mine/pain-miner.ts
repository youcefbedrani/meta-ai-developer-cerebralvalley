import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { ConfigError } from "@/lib/env";
import { MIN_COMMENTS_PER_THREAD, MIN_QUOTES_FOR_CLUSTERS, painClusteringSchema, painExtractionSchema } from "@/lib/validation/gold-mine";
import { AIInvalidOutputError, AIProviderError } from "@/server/ai/errors";
import { buildClusterPrompt, buildExtractPainPrompt, CLUSTER_SYSTEM, EXTRACT_PAIN_SYSTEM, mockClusters, mockExtractPain } from "@/server/ai/prompts/gold-mine";
import { callStructured } from "@/server/ai/run";
import { refundCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { unsafeToUserId } from "@/server/data/user-id";
import { getDiscussionReaders, readerFor, type Discussion } from "@/server/discussions";
import { MOCK_DISCUSSION_LINES } from "@/server/discussions/mock";
import { quoteAppearsIn } from "@/server/jobs/research/verify";
import { communityFor, platformFor } from "@/server/discussions/web";
import { getSearchProvider, type SearchResult } from "@/server/search";

export const EMOTION_TERMS = ["problem", "struggle", "frustrated", '"I wish"', "hate", '"anyone else"'];
const DISCUSSION_HOSTS = /(^|\.)(reddit\.com|news\.ycombinator\.com|stackexchange\.com|stackoverflow\.com|indiehackers\.com|quora\.com)$/;
const MAX_THREADS = 12;
const THREAD_TEXT_LIMIT = 6_000;

export const miningCreditRef = (sessionId: string, attempt: number) => `pain_mining:${sessionId}:${attempt}`;

class MiningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MiningError";
  }
}

/** Discussion search queries for a niche: site-restricted + emotional keywords. */
export function buildDiscussionQueries(niche: string): string[] {
  const n = niche.replace(/["]/g, "").trim();
  return [...EMOTION_TERMS.map((t) => `site:reddit.com ${n} ${t}`), `site:news.ycombinator.com ${n}`, `${n} forum frustrated`];
}

export function isDiscussionUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return DISCUSSION_HOSTS.test(u.hostname) && (u.hostname.endsWith("reddit.com") ? /\/comments\//.test(u.pathname) : true);
  } catch {
    return false;
  }
}

/** Shortest search excerpt worth mining when the full page text isn't available. */
const MIN_EXCERPT_CHARS = 150;

/**
 * A thread built from what the search provider returned, for sites that block direct reading (Reddit): its full
 * page text, or else its excerpt. Quotes are still verified against this text, so they stay verbatim.
 */
export function fromSearchResult(r: SearchResult): Discussion | null {
  const text = r.rawContent?.trim() || (r.snippet.trim().length >= MIN_EXCERPT_CHARS ? r.snippet.trim() : "");
  if (!text) return null;
  const url = new URL(r.url);
  return { url: r.url, platform: platformFor(url.hostname), community: communityFor(url), title: r.title || null, postedAt: r.publishedAt, engagement: null, text };
}

export function quoteHash(quote: string): string {
  return createHash("sha256").update(quote.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).digest("hex").slice(0, 32);
}

/** Deterministic cluster rank score: frequency, intensity and recency. */
export function clusterScore(c: { frequency: number; intensity: number; recency: number | null }): number {
  return c.frequency * 2 + c.intensity * 3 + (c.recency ?? 0) * 4;
}

async function setStage(sessionId: string, stage: string) {
  await getDb().update(schema.goldMineSessions).set({ miningStage: stage }).where(eq(schema.goldMineSessions.id, sessionId));
}

/**
 * Runs the Pain Miner for a session. Idempotent per attempt; on failure the
 * session is marked failed with a safe message and credits are refunded.
 */
export async function runPainMining(sessionId: string, attempt: number): Promise<void> {
  const db = getDb();
  const [session] = await db.select().from(schema.goldMineSessions).where(eq(schema.goldMineSessions.id, sessionId)).limit(1);
  if (!session || (session.miningStatus !== "queued" && session.miningStatus !== "running")) return;
  const userId = unsafeToUserId(session.userId);
  await db.update(schema.goldMineSessions).set({ miningStatus: "running", miningStage: "finding_discussions", miningStartedAt: new Date(), miningError: null }).where(eq(schema.goldMineSessions.id, sessionId));

  try {
    // 1. Find discussions
    const readers = getDiscussionReaders();
    if (!readers.length) throw new ConfigError("search", ["DISCUSSION_SOURCES (no discussion source enabled)"]);
    const search = getSearchProvider();
    const settled = await Promise.allSettled(buildDiscussionQueries(session.niche).map((q) => search.search(q, { maxResults: 5, rawContent: true })));
    if (settled.every((s) => s.status === "rejected")) throw new MiningError("Web search failed. Your credits were refunded — please try again later.");
    const seen = new Set<string>();
    const candidates = settled
      .flatMap((s) => (s.status === "fulfilled" ? s.value : []))
      .filter((r) => isDiscussionUrl(r.url) || readers.some((rd) => rd.name === "mock"))
      .filter((r) => {
        const key = r.url.replace(/[?#].*$/, "").replace(/\/$/, "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_THREADS * 2);

    // 2. Read threads (skip low-engagement ones; prefer recent + engaged)
    await setStage(sessionId, "reading");
    const threads: Discussion[] = [];
    for (const c of candidates) {
      const reader = readerFor(c.url, readers);
      if (!reader) continue;
      // Sites that block direct fetching (Reddit) fall back to the text the search provider read.
      const d = (await reader.read(c.url)) ?? fromSearchResult(c);
      if (!d || !d.text.trim()) continue;
      if (d.engagement !== null && d.engagement < MIN_COMMENTS_PER_THREAD) continue;
      threads.push({ ...d, postedAt: d.postedAt ?? c.publishedAt, text: d.text.slice(0, THREAD_TEXT_LIMIT) });
    }
    threads.sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0) || (b.engagement ?? 0) - (a.engagement ?? 0));
    const picked = threads.slice(0, MAX_THREADS);

    // 3. Extract verbatim quotes; metadata always comes from the fetched thread
    await setStage(sessionId, "extracting");
    const keyed = picked.map((t, i) => ({ key: `T${i + 1}`, t }));
    const retrievedAt = new Date();
    const ai = { userId, projectId: session.projectId };
    const extraction = keyed.length
      ? await callStructured({
          ...ai,
          operation: "pain_extract",
          tier: "fast",
          schema: painExtractionSchema,
          system: EXTRACT_PAIN_SYSTEM,
          prompt: buildExtractPainPrompt(session.niche, keyed.map(({ key, t }) => ({ key, title: t.title, text: t.text }))),
          mock: () => mockExtractPain(keyed.map((k) => k.key), MOCK_DISCUSSION_LINES),
        })
      : { quotes: [] };
    const byKey = new Map(keyed.map((k) => [k.key, k.t]));
    const hashes = new Set<string>();
    const rows = extraction.quotes.flatMap((q) => {
      const t = byKey.get(q.threadKey);
      const text = q.quote.trim();
      if (!t || !quoteAppearsIn(text, t.text)) return [];
      const h = quoteHash(text);
      if (hashes.has(h)) return [];
      hashes.add(h);
      return [{ userId, sessionId, quote: text.slice(0, 400), url: t.url, platform: t.platform, community: t.community, threadTitle: t.title?.slice(0, 300) ?? null, postedAt: t.postedAt, retrievedAt, engagement: t.engagement, dedupeHash: h }];
    });

    // Replace previous results for this session (re-runs start fresh).
    await db.transaction(async (tx) => {
      await tx.delete(schema.painClusters).where(eq(schema.painClusters.sessionId, sessionId));
      await tx.delete(schema.painQuotes).where(eq(schema.painQuotes.sessionId, sessionId));
    });
    const stored = rows.length ? await db.insert(schema.painQuotes).values(rows).onConflictDoNothing().returning() : [];

    // 4. Cluster (only with enough real quotes)
    await setStage(sessionId, "clustering");
    let clusterCount = 0;
    if (stored.length >= MIN_QUOTES_FOR_CLUSTERS) {
      const qKeyed = stored.map((q, i) => ({ key: `Q${i + 1}`, q }));
      const out = await callStructured({
        ...ai,
        operation: "pain_cluster",
        tier: "fast",
        schema: painClusteringSchema,
        system: CLUSTER_SYSTEM,
        prompt: buildClusterPrompt(session.niche, qKeyed.map(({ key, q }) => ({ key, quote: q.quote }))),
        mock: () => mockClusters(qKeyed.map((k) => k.key)),
      });
      const qByKey = new Map(qKeyed.map((k) => [k.key, k.q]));
      const used = new Set<string>();
      const yearAgo = Date.now() - 365 * 24 * 3600 * 1000;
      const prepared = out.clusters
        .map((c) => {
          const quotes = [...new Set(c.quoteKeys)].filter((k) => qByKey.has(k) && !used.has(k));
          quotes.forEach((k) => used.add(k));
          const dated = quotes.map((k) => qByKey.get(k)!).filter((q) => q.postedAt);
          const recency = dated.length ? dated.filter((q) => q.postedAt!.getTime() >= yearAgo).length / dated.length : null;
          return { c, quotes, best: new Set(c.bestQuoteKeys.filter((k) => quotes.includes(k))), frequency: quotes.length, recency };
        })
        .filter((x) => x.frequency > 0)
        .sort((a, b) => clusterScore({ frequency: b.frequency, intensity: b.c.intensity, recency: b.recency }) - clusterScore({ frequency: a.frequency, intensity: a.c.intensity, recency: a.recency }));
      await db.transaction(async (tx) => {
        for (const [rank, x] of prepared.entries()) {
          const [cluster] = await tx
            .insert(schema.painClusters)
            .values({ userId, sessionId, title: x.c.title, description: x.c.description, frequency: x.frequency, intensity: x.c.intensity, recency: x.recency === null ? null : x.recency.toFixed(3), rank: rank + 1 })
            .returning({ id: schema.painClusters.id });
          await tx.insert(schema.painClusterQuotes).values(x.quotes.map((k) => ({ clusterId: cluster.id, quoteId: qByKey.get(k)!.id, isBest: x.best.has(k) })));
        }
      });
      clusterCount = prepared.length;
    }

    await db
      .update(schema.goldMineSessions)
      .set({
        miningStatus: "succeeded",
        miningStage: null,
        miningFinishedAt: new Date(),
        miningStats: { attempt, threadsFound: candidates.length, threadsRead: picked.length, quotes: stored.length, droppedQuotes: extraction.quotes.length - stored.length, clusters: clusterCount, needsMoreData: stored.length < MIN_QUOTES_FOR_CLUSTERS ? 1 : 0 },
        ...(clusterCount > 0 ? { currentStep: "ideas" as const } : {}),
      })
      .where(and(eq(schema.goldMineSessions.id, sessionId), eq(schema.goldMineSessions.userId, userId)));
  } catch (err) {
    console.error(`[pain-miner] session ${sessionId} failed:`, err instanceof Error ? `${err.name}: ${err.message}` : err);
    const safe = err instanceof MiningError || err instanceof ConfigError || err instanceof AIInvalidOutputError || err instanceof AIProviderError ? err.message : "Pain mining failed unexpectedly. Your credits were refunded — please try again.";
    await db.update(schema.goldMineSessions).set({ miningStatus: "failed", miningError: safe, miningFinishedAt: new Date() }).where(eq(schema.goldMineSessions.id, sessionId));
    await refundCredits(userId, miningCreditRef(sessionId, attempt), "pain mining failed");
  }
}
