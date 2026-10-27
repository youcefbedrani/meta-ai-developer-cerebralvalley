import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { ConfigError, getIntegrationStatus } from "@/lib/env";
import { classifyTrend, demandVerdict, type DemandVerdict } from "@/lib/gold-mine/trend";
import { CREDIT_COSTS } from "@/lib/plans";
import {
  demandPhrasesSchema,
  goldIdeasSchema,
  goldLandingSchema,
  MAX_MARKET_DEPTH,
  marketExpansionSchema,
  startIdeaSessionSchema,
} from "@/lib/validation/gold-mine";
import type { LandingContent } from "@/lib/validation/experiments";
import type { IdeaContent } from "@/lib/validation/ideas";
import {
  buildGoldIdeasPrompt,
  buildGoldLandingPrompt,
  buildMarketPrompt,
  buildPhrasesPrompt,
  GOLD_IDEAS_SYSTEM,
  GOLD_LANDING_SYSTEM,
  GOLD_MINE_PROMPT_VERSION,
  MARKET_SYSTEM,
  mockGoldIdeas,
  mockGoldLanding,
  mockMarket,
  mockPhrases,
  PHRASES_SYSTEM,
} from "@/server/ai/prompts/gold-mine";
import { AIInvalidOutputError } from "@/server/ai/errors";
import { callStructured, withCredits } from "@/server/ai/run";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError } from "@/server/data/errors";
import { createExperiment } from "@/server/data/experiments";
import {
  createSession,
  getMarketMap,
  listClusters,
  listCustomerLanguage,
  replaceDemandChecks,
  requireSession,
  saveMarketMap,
  updateSession,
  type GoldMineSession,
} from "@/server/data/gold-mine";
import { convertIdeaToProject, getIdea } from "@/server/data/ideas";
import { createLandingPage, suggestSlug } from "@/server/data/landing-pages";
import { getProfile } from "@/server/data/profiles";
import type { UserId } from "@/server/data/user-id";
import { getKeywordProvider } from "@/server/keywords";
import { enforceAiLimits } from "@/server/rate-limit";
import { refundCredits, reserveCredits } from "@/server/billing/credits";
import { enqueuePainMining } from "@/server/jobs/queue";
import { miningCreditRef } from "@/server/jobs/gold-mine/pain-miner";
import { getSearchProvider } from "@/server/search";

/** Raised when there isn't enough real data to continue. Never filled with AI text. */
export class NeedsMoreDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeedsMoreDataError";
  }
}

function requireConfigured(...names: ("ai" | "search" | "redis" | "keywords")[]) {
  for (const n of names) {
    const s = getIntegrationStatus(n);
    if (!s.configured) throw new ConfigError(n, s.missing);
  }
}

/* ============================================================ Market map */

export async function expandMarketNode(userId: UserId, nodeId: string) {
  const tree = await getMarketMap(userId);
  const node = tree.nodes.find((n) => n.id === nodeId);
  if (!node) throw new NotFoundError("Market");
  if (node.expanded) return tree;
  if (node.depth >= MAX_MARKET_DEPTH) throw new NeedsMoreDataError("This is already a specific niche. Choose it to continue.");
  requireConfigured("ai");
  await enforceAiLimits(userId);

  const path: string[] = [];
  for (let cur: typeof node | undefined = node; cur; cur = tree.nodes.find((n) => n.id === cur!.parentId)) path.unshift(cur.label);
  const profile = await getProfile(userId);

  const out = await withCredits(userId, "market_expand", CREDIT_COSTS.market_expand, () =>
    callStructured({ userId, operation: "market_expand", tier: "fast", schema: marketExpansionSchema, system: MARKET_SYSTEM, prompt: buildMarketPrompt(path, profile), mock: () => mockMarket(path) }),
  );
  const fresh = await getMarketMap(userId);
  const target = fresh.nodes.find((n) => n.id === nodeId);
  if (!target || target.expanded) return fresh;
  target.expanded = true;
  out.children.forEach((c, i) => fresh.nodes.push({ id: `${nodeId}.${i + 1}`, parentId: nodeId, label: c.label, description: c.description, depth: node.depth + 1, expanded: false }));
  await saveMarketMap(userId, fresh);
  return fresh;
}

export async function startFromMarket(userId: UserId, nodeId: string): Promise<GoldMineSession> {
  const tree = await getMarketMap(userId);
  const node = tree.nodes.find((n) => n.id === nodeId);
  if (!node) throw new NotFoundError("Market");
  if (node.depth === 0) throw new NeedsMoreDataError("Pick a more specific niche than a top-level market.");
  const path: string[] = [];
  for (let cur: typeof node | undefined = node; cur; cur = tree.nodes.find((n) => n.id === cur!.parentId)) path.unshift(cur.label);
  return createSession(userId, { mode: "market", niche: node.label, marketPath: path });
}

export async function startFromIdea(userId: UserId, input: unknown): Promise<GoldMineSession> {
  const data = startIdeaSessionSchema.parse(input);
  return createSession(userId, { mode: "idea", niche: data.niche, ideaDescription: data.ideaDescription });
}

/* ========================================================== Demand check */

const NOT_COMPETITORS = /(^|\.)(reddit|quora|youtube|wikipedia|medium|linkedin|facebook|twitter|x|pinterest|instagram|tiktok|amazon|github|stackoverflow|stackexchange|google)\.[a-z.]+$/;

export type DemandSummary = {
  verdict: DemandVerdict;
  provider: string;
  competitorCount: number | null;
  competitorDomains: string[];
  totalVolume: number;
  checkedAt: string;
};

/** AI suggests phrases → keyword provider returns volume/trend → deterministic classification and verdict. */
export async function runDemandCheck(userId: UserId, sessionId: string): Promise<DemandSummary> {
  const session = await requireSession(userId, sessionId);
  requireConfigured("ai", "keywords");
  const provider = getKeywordProvider();
  await enforceAiLimits(userId);

  return withCredits(userId, "demand_check", CREDIT_COSTS.demand_check, async () => {
    const { phrases } = await callStructured({
      userId,
      operation: "demand_phrases",
      tier: "fast",
      schema: demandPhrasesSchema,
      system: PHRASES_SYSTEM,
      prompt: buildPhrasesPrompt(session.niche, session.ideaDescription),
      mock: () => mockPhrases(session.niche),
    });
    const keywords = [...new Set(phrases.map((p) => p.toLowerCase().trim()))].slice(0, 10);
    const data = await provider.getKeywordData(keywords);
    const rows = data.map((d) => ({ keyword: d.keyword, volume: d.volume, trend: d.trend, trendClass: classifyTrend(d.trend), provider: provider.name, checkedAt: new Date() }));

    // Competitors found via search are a demand signal (people pay to solve this). Optional.
    let competitorDomains: string[] = [];
    let competitorCount: number | null = null;
    if (getIntegrationStatus("search").configured) {
      const search = getSearchProvider();
      const results = (await Promise.allSettled([search.search(`${session.niche} software`, { maxResults: 10 }), search.search(`best ${session.niche} tool`, { maxResults: 10 })])).flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      const domains = new Set<string>();
      for (const r of results) {
        try {
          const host = new URL(r.url).hostname.replace(/^www\./, "");
          if (!NOT_COMPETITORS.test(host)) domains.add(host);
        } catch {
          /* ignore invalid URL */
        }
      }
      competitorDomains = [...domains].slice(0, 15);
      competitorCount = domains.size;
    }

    await replaceDemandChecks(userId, session.id, rows);
    const summary: DemandSummary = {
      verdict: demandVerdict(rows, competitorCount),
      provider: provider.name,
      competitorCount,
      competitorDomains,
      totalVolume: rows.reduce((s, r) => s + (r.volume ?? 0), 0),
      checkedAt: new Date().toISOString(),
    };
    await updateSession(userId, session.id, { demandSummary: summary, demandAcknowledged: false });
    return summary;
  });
}

/**
 * Checkpoint after demand. Weak or missing demand requires an explicit
 * "continue anyway" from the user.
 */
export async function continueToPains(userId: UserId, sessionId: string, acknowledgeWeak: boolean): Promise<void> {
  const session = await requireSession(userId, sessionId);
  const verdict = (session.demandSummary as DemandSummary | null)?.verdict ?? "needs_more_data";
  if (verdict !== "strong" && !acknowledgeWeak) throw new NeedsMoreDataError("Demand looks weak or unmeasured. Confirm you want to continue anyway, or change the niche.");
  await updateSession(userId, session.id, { demandAcknowledged: true, currentStep: "pains" });
}

/* ============================================================ Pain Miner */

export class MiningInProgressError extends Error {
  constructor() {
    super("Pain mining is already running for this session.");
    this.name = "MiningInProgressError";
  }
}

/** Reserves credits and queues the Pain Miner job for the worker. */
export async function startPainMining(userId: UserId, sessionId: string): Promise<void> {
  const session = await requireSession(userId, sessionId);
  if (session.miningStatus === "queued" || session.miningStatus === "running") throw new MiningInProgressError();
  requireConfigured("ai", "search", "redis");
  await enforceAiLimits(userId, "pain_mining");
  const attempt = ((session.miningStats as { attempt?: number } | null)?.attempt ?? 0) + 1;
  const ref = miningCreditRef(session.id, attempt);
  await reserveCredits(userId, CREDIT_COSTS.pain_mining, ref, "pain_mining");
  const db = getDb();
  await db
    .update(schema.goldMineSessions)
    .set({ miningStatus: "queued", miningStage: "queued", miningError: null, miningStats: { attempt }, currentStep: "pains" })
    .where(and(eq(schema.goldMineSessions.id, session.id), eq(schema.goldMineSessions.userId, userId)));
  try {
    await enqueuePainMining({ sessionId: session.id, attempt });
  } catch (err) {
    console.error("[gold-mine] enqueue failed", err instanceof Error ? err.message : err);
    await db.update(schema.goldMineSessions).set({ miningStatus: "failed", miningError: "Could not queue the job. Your credits were refunded." }).where(eq(schema.goldMineSessions.id, session.id));
    await refundCredits(userId, ref, "pain mining could not be queued");
    throw new ConfigError("redis", ["REDIS_URL (queue unavailable — is Redis running?)"]);
  }
}

/* ================================================================= Ideas */

/** Generates ideas from pain clusters. Ideas without valid cluster links are rejected. */
export async function generateGoldIdeas(userId: UserId, sessionId: string) {
  const session = await requireSession(userId, sessionId);
  const clusters = await listClusters(userId, session.id);
  if (!clusters.length) throw new NeedsMoreDataError("No pain clusters yet. Mine pains first, or broaden the niche to find more discussions.");
  requireConfigured("ai");
  await enforceAiLimits(userId);
  const keyed = clusters.map((c, i) => ({ key: `C${i + 1}`, c }));
  const byKey = new Map(keyed.map((k) => [k.key, k.c]));
  const profile = await getProfile(userId);

  return withCredits(userId, "gold_ideas", CREDIT_COSTS.gold_ideas, async () => {
    const out = await callStructured({
      userId,
      operation: "gold_ideas",
      tier: "smart",
      schema: goldIdeasSchema,
      system: GOLD_IDEAS_SYSTEM,
      prompt: buildGoldIdeasPrompt(
        session.niche,
        keyed.map(({ key, c }) => ({ key, title: c.title, description: c.description, frequency: c.frequency, intensity: c.intensity, quotes: c.quotes.slice(0, 4).map((q) => q.quote) })),
        profile,
      ),
      mock: () => mockGoldIdeas(keyed.map((k) => k.key)),
    });
    const valid = out.ideas
      .map((idea) => ({ idea, clusters: [...new Set(idea.solvedClusterKeys)].map((k) => byKey.get(k)).filter((c): c is NonNullable<typeof c> => !!c) }))
      .filter((x) => x.clusters.length > 0);
    if (!valid.length) throw new AIInvalidOutputError("None of the generated ideas linked to a real pain cluster, so they were rejected. Your credits were refunded — please try again.");

    const db = getDb();
    return db.transaction(async (tx) => {
      const saved = [];
      for (const { idea, clusters: linked } of valid) {
        const content: IdeaContent = {
          title: idea.name,
          oneLiner: idea.pitch,
          problem: linked.map((c) => `${c.title}: ${c.description}`).join(" "),
          targetCustomer: idea.targetCustomer,
          currentAlternatives: [],
          solution: idea.pitch,
          differentiationHypothesis: idea.differentiation || "To be defined.",
          monetization: idea.monetizationHint || "To be defined.",
          pricingHypotheses: [],
          complexity: idea.complexity,
          complexityReason: "",
          risks: idea.risks,
          evidenceToLookFor: [],
          evidenceMissing: ["Willingness to pay has not been tested yet."],
          firstExperiment: idea.firstExperiment,
        };
        const [row] = await tx
          .insert(schema.ideas)
          .values({ userId, title: idea.name, content, inputs: { source: "gold_mine", niche: session.niche }, promptVersion: GOLD_MINE_PROMPT_VERSION, goldMineSessionId: session.id })
          .returning();
        await tx.insert(schema.ideaPainLinks).values(linked.map((c) => ({ ideaId: row.id, clusterId: c.id })));
        saved.push(row);
      }
      await tx.update(schema.goldMineSessions).set({ currentStep: "ideas" }).where(and(eq(schema.goldMineSessions.id, session.id), eq(schema.goldMineSessions.userId, userId)));
      return { saved: saved.length, rejected: out.ideas.length - valid.length };
    });
  });
}

/* ========================================================== Landing draft */

/**
 * Turns the idea into a project (copying quotes into customer language) and
 * drafts landing copy from the linked cluster quotes only. Each block keeps the
 * quote ids it is based on.
 */
export async function createGoldLandingDraft(userId: UserId, sessionId: string, ideaId: string): Promise<{ pageId: string; projectId: string }> {
  const session = await requireSession(userId, sessionId);
  const idea = await getIdea(userId, ideaId);
  if (!idea || idea.goldMineSessionId !== session.id) throw new NotFoundError("Idea");
  const links = await getDb().select({ clusterId: schema.ideaPainLinks.clusterId }).from(schema.ideaPainLinks).where(eq(schema.ideaPainLinks.ideaId, idea.id));
  const clusterIds = new Set(links.map((l) => l.clusterId));
  const quotes = (await listClusters(userId, session.id)).filter((c) => clusterIds.has(c.id)).flatMap((c) => c.quotes);
  if (quotes.length < 2) throw new NeedsMoreDataError("This idea has too few linked quotes to write copy from. Mine more pains first.");
  requireConfigured("ai");
  await enforceAiLimits(userId);

  const keyed = quotes.slice(0, 30).map((q, i) => ({ key: `Q${i + 1}`, q }));
  const idByKey = new Map(keyed.map((k) => [k.key, k.q.id]));
  const toIds = (keys: string[]) => [...new Set(keys.map((k) => idByKey.get(k)).filter((x): x is string => !!x))];

  const content = await withCredits(userId, "gold_landing", CREDIT_COSTS.gold_landing, async () => {
    const out = await callStructured({
      userId,
      projectId: idea.projectId,
      operation: "gold_landing",
      tier: "fast",
      schema: goldLandingSchema,
      system: GOLD_LANDING_SYSTEM,
      prompt: buildGoldLandingPrompt({ name: idea.content.title, pitch: idea.content.oneLiner, targetCustomer: idea.content.targetCustomer }, keyed.map(({ key, q }) => ({ key, quote: q.quote }))),
      mock: () => mockGoldLanding(keyed.map((k) => k.key)),
    });
    const bullets = out.bullets.map((b) => ({ text: b.text.slice(0, 140), ids: toIds(b.quoteKeys) })).filter((b) => b.ids.length > 0);
    const headlineIds = toIds(out.headline.quoteKeys);
    const subIds = toIds(out.subheadline.quoteKeys);
    if (!headlineIds.length || !subIds.length || !bullets.length) {
      throw new AIInvalidOutputError("The draft wasn't grounded in the quotes, so it was discarded. Your credits were refunded — please try again.");
    }
    const c: LandingContent = {
      headline: out.headline.text.slice(0, 90),
      subheadline: out.subheadline.text.slice(0, 240),
      bullets: bullets.map((b) => b.text),
      ctaLabel: out.ctaLabel,
      quoteRefs: { headline: headlineIds, subheadline: subIds, bullets: bullets.map((b) => b.ids) },
    };
    return c;
  });

  const { projectId } = await convertIdeaToProject(userId, idea.id);
  const experiment = await createExperiment(userId, projectId, {
    type: "waitlist",
    title: `Waitlist: ${content.headline}`.slice(0, 160),
    hypothesis: `People who described these pains will join a waitlist for: ${content.subheadline}`.slice(0, 1000),
    successCriteria: "At least 5% of unique visitors join the waitlist",
  });
  const page = await createLandingPage(userId, projectId, { content, slug: suggestSlug(idea.content.title.replace(/^\[Mock\]\s*/, "")), experimentId: experiment.id });
  await updateSession(userId, session.id, { landingPageId: page.id, projectId, currentStep: "landing" });
  return { pageId: page.id, projectId };
}

/* ===================================================== Customer language */

/**
 * The project's customer-language library, grouped by pain cluster.
 * Reusable by landing page, brand and marketing modules.
 */
export async function getProjectCustomerLanguage(userId: UserId, projectId: string) {
  const quotes = await listCustomerLanguage(userId, projectId);
  const groups = new Map<string, typeof quotes>();
  for (const q of quotes) groups.set(q.clusterTitle, [...(groups.get(q.clusterTitle) ?? []), q]);
  return [...groups.entries()].map(([cluster, items]) => ({ cluster, quotes: items }));
}

/** Quote ids → stored quotes the user owns (for "Based on N quotes" details). */
export async function getQuotesByIds(userId: UserId, ids: string[]) {
  if (!ids.length) return [];
  return getDb()
    .select()
    .from(schema.painQuotes)
    .where(and(inArray(schema.painQuotes.id, ids), eq(schema.painQuotes.userId, userId)));
}
