import { z } from "zod";

export const MARKET_ROOTS = [
  { id: "health", label: "Health", description: "Fitness, nutrition, mental health, care, wellbeing." },
  { id: "wealth", label: "Wealth", description: "Work, business, money, careers, productivity." },
  { id: "relationships", label: "Relationships", description: "Family, dating, friends, community, communication." },
] as const;
export const MAX_MARKET_DEPTH = 4;

export const marketNodeSchema = z.object({
  id: z.string().max(80),
  parentId: z.string().max(80).nullable(),
  label: z.string().max(80),
  description: z.string().max(240),
  depth: z.number().int().min(0).max(MAX_MARKET_DEPTH),
  expanded: z.boolean(),
});
export type MarketNode = z.output<typeof marketNodeSchema>;
export const marketTreeSchema = z.object({ nodes: z.array(marketNodeSchema).max(500) });
export type MarketTree = z.output<typeof marketTreeSchema>;

export const marketExpansionSchema = z.object({
  children: z.array(z.object({ label: z.string().min(2).max(60), description: z.string().max(200) })).min(3).max(8),
});

export const startIdeaSessionSchema = z.object({
  niche: z.string().trim().min(3, "Describe the niche in a few words").max(120),
  ideaDescription: z.string().trim().max(1000).default(""),
});

export const demandPhrasesSchema = z.object({ phrases: z.array(z.string().min(2).max(80)).min(5).max(10) });

/** The model only returns thread keys + verbatim quotes; metadata comes from the fetched thread. */
export const painExtractionSchema = z.object({
  quotes: z.array(z.object({ threadKey: z.string().max(10), quote: z.string().min(12).max(400) })).max(80),
});

export const painClusteringSchema = z.object({
  clusters: z
    .array(
      z.object({
        title: z.string().min(3).max(100),
        description: z.string().max(400),
        intensity: z.number().int().min(1).max(5),
        quoteKeys: z.array(z.string().max(10)).min(1).max(60),
        bestQuoteKeys: z.array(z.string().max(10)).max(3),
      }),
    )
    .max(8),
});

export const goldIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        name: z.string().min(2).max(80),
        pitch: z.string().min(10).max(300),
        targetCustomer: z.string().min(5).max(300),
        solvedClusterKeys: z.array(z.string().max(10)).max(6),
        differentiation: z.string().max(500),
        monetizationHint: z.string().max(300),
        complexity: z.enum(["low", "medium", "high"]),
        risks: z.array(z.string().max(300)).max(6),
        firstExperiment: z.object({
          type: z.enum(["interview", "survey", "landing_page", "waitlist", "demo_request", "outreach", "pre_sale"]),
          description: z.string().max(600),
          successCriteria: z.string().max(300),
        }),
      }),
    )
    .min(1)
    .max(5),
});

const block = z.object({ text: z.string().min(2).max(240), quoteKeys: z.array(z.string().max(10)).max(8) });
export const goldLandingSchema = z.object({
  headline: block,
  subheadline: block,
  bullets: z.array(block).min(1).max(5),
  ctaLabel: z.string().min(2).max(30),
});

export const GOLD_MINE_STEPS = [
  { key: "market", label: "Market" },
  { key: "demand", label: "Demand" },
  { key: "pains", label: "Pains" },
  { key: "ideas", label: "Ideas" },
  { key: "landing", label: "Landing page" },
] as const;
export type GoldMineStep = (typeof GOLD_MINE_STEPS)[number]["key"];

export const PAIN_STAGES = [
  { key: "queued", label: "Waiting for a worker" },
  { key: "finding_discussions", label: "Finding discussions" },
  { key: "reading", label: "Reading threads" },
  { key: "extracting", label: "Extracting quotes" },
  { key: "clustering", label: "Clustering pains" },
] as const;

/** Below these, the UI says "needs more data" instead of filling gaps. */
export const MIN_QUOTES_FOR_CLUSTERS = 5;
export const MIN_COMMENTS_PER_THREAD = 3;
