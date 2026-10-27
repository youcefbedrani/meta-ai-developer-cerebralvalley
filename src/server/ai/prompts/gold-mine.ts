import type { z } from "zod";
import type { demandPhrasesSchema, goldIdeasSchema, goldLandingSchema, marketExpansionSchema, painClusteringSchema, painExtractionSchema } from "@/lib/validation/gold-mine";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const GOLD_MINE_PROMPT_VERSION = "gold-mine.v1";

/* ------------------------------------------------------------ market map */

export const MARKET_SYSTEM = `You map markets for founders looking for SaaS opportunities.
Given a path in a market tree (e.g. Wealth > Freelancing), return the next level of more specific sub-markets or niches.
- 4 to 8 children, mutually distinct, each narrower than the parent. Deeper levels should name specific customer groups with specific jobs (e.g. "Freelance video editors managing client revisions").
- Use the founder profile to favour niches matching their skills and interests, but keep variety.
- Never state market sizes, statistics or trends. Descriptions say who it is and what they do.
- ${UNTRUSTED_DATA_RULE}`;

export const buildMarketPrompt = (path: string[], profile: unknown) =>
  `Expand this market path one level deeper.\n\n${asData("path", path.join(" > "))}\n\n${asData("founder_profile", profile ?? {})}`;

export const mockMarket = (path: string[]): z.input<typeof marketExpansionSchema> => ({
  children: ["Small agencies", "Freelancers", "Solo consultants", "Local businesses"].map((l) => ({
    label: `${l} in ${path[path.length - 1]}`.slice(0, 60),
    description: `[Mock] ${l} working in ${path.join(" > ")}.`,
  })),
});

/* ---------------------------------------------------------------- demand */

export const PHRASES_SYSTEM = `You suggest search phrases that real people type into Google when they have a problem in a niche or want a tool for it.
- 5 to 10 short phrases (2–6 words), mixing problem phrases ("how to track client hours") and solution phrases ("client hours tracking app").
- Lowercase, no brand names, no quotes.
- ${UNTRUSTED_DATA_RULE}`;

export const buildPhrasesPrompt = (niche: string, idea: string | null) =>
  `${asData("niche", niche)}${idea ? `\n\n${asData("idea", idea)}` : ""}`;

export const mockPhrases = (niche: string): z.input<typeof demandPhrasesSchema> => ({
  phrases: [`${niche} software`, `${niche} tool`, `how to manage ${niche}`, `${niche} template`, `best ${niche} app`].map((p) => p.toLowerCase().slice(0, 80)),
});

/* --------------------------------------------------------- pain extraction */

export const EXTRACT_PAIN_SYSTEM = `You extract customer pain quotes from public discussion threads.
- Return only short, verbatim excerpts (one or two sentences, max ~250 characters) copied exactly from the thread text, where someone expresses a problem, frustration, wish, workaround or cost.
- Each quote must include the threadKey (e.g. T3) of the thread it came from.
- Do not paraphrase, merge or fix typos. Quotes not found verbatim will be discarded.
- Skip promotional posts, jokes and off-topic text. Prefer specific pains over vague complaints.
- ${UNTRUSTED_DATA_RULE}`;

export const buildExtractPainPrompt = (niche: string, threads: { key: string; title: string | null; text: string }[]) =>
  `${asData("niche", niche)}\n\n${threads.map((t) => asData("thread", `key: ${t.key}\ntitle: ${t.title ?? ""}\n\n${t.text}`)).join("\n\n")}`;

export const mockExtractPain = (threadKeys: string[], lines: string[]): z.input<typeof painExtractionSchema> => ({
  quotes: threadKeys.slice(0, 3).flatMap((threadKey, i) => lines.slice(i, i + 4).map((quote) => ({ threadKey, quote }))),
});

/* --------------------------------------------------------------- clustering */

export const CLUSTER_SYSTEM = `You group customer pain quotes into distinct pain categories.
- 2 to 8 clusters. Each quote key (Q1, Q2…) belongs to at most one cluster; omit quotes that fit nowhere.
- Title: the pain in plain customer language. Description: one or two sentences describing the pain, based only on the quotes.
- intensity 1–5 from the wording (5 = costly, urgent, emotional; 1 = mild annoyance).
- bestQuoteKeys: up to 3 of the cluster's most specific, vivid quotes.
- Do not add facts that are not in the quotes.
- ${UNTRUSTED_DATA_RULE}`;

export const buildClusterPrompt = (niche: string, quotes: { key: string; quote: string }[]) =>
  `${asData("niche", niche)}\n\n${asData("quotes", quotes)}`;

export const mockClusters = (keys: string[]): z.input<typeof painClusteringSchema> => {
  const half = Math.ceil(keys.length / 2);
  return {
    clusters: [
      { title: "[Mock] Too much manual work", description: "[Mock] People repeat the same task by hand every week.", intensity: 4, quoteKeys: keys.slice(0, half), bestQuoteKeys: keys.slice(0, 2) },
      { title: "[Mock] Tools are too complex or expensive", description: "[Mock] Existing tools cost too much or take too long to set up.", intensity: 3, quoteKeys: keys.slice(half), bestQuoteKeys: keys.slice(half, half + 2) },
    ].filter((c) => c.quoteKeys.length > 0),
  };
};

/* ------------------------------------------------------------------- ideas */

export const GOLD_IDEAS_SYSTEM = `You turn clustered customer pains into SaaS / micro-SaaS ideas.
- 3 to 5 ideas. Every idea MUST list solvedClusterKeys (e.g. ["C1"]) referencing the provided clusters it addresses. Ideas without valid cluster keys are rejected.
- Ground the pitch and differentiation in the quotes; use the customers' own words where natural.
- Never invent statistics, prices of competitors, or claims about the market.
- Size ideas for a solo founder or small team; prefer narrow wedges.
- ${UNTRUSTED_DATA_RULE}`;

export const buildGoldIdeasPrompt = (niche: string, clusters: unknown, profile: unknown) =>
  `${asData("niche", niche)}\n\n${asData("pain_clusters", clusters)}\n\n${asData("founder_profile", profile ?? {})}`;

export const mockGoldIdeas = (clusterKeys: string[]): z.input<typeof goldIdeasSchema> => ({
  ideas: ["Autopilot", "Simple Kit", "Report Robot"].map((name, i) => ({
    name: `[Mock] ${name}`,
    pitch: "[Mock] Removes the repetitive manual work customers complain about.",
    targetCustomer: "[Mock] Small teams who do this by hand today.",
    solvedClusterKeys: [clusterKeys[i % clusterKeys.length]],
    differentiation: "[Mock] Set up in minutes instead of hours.",
    monetizationHint: "[Mock] Monthly subscription per workspace.",
    complexity: (["low", "medium", "low"] as const)[i],
    risks: ["[Mock] Customers may tolerate the manual work."],
    firstExperiment: { type: "interview" as const, description: "[Mock] Interview 10 people from the quoted communities.", successCriteria: "6 of 10 confirm the pain" },
  })),
});

/* ----------------------------------------------------------- landing copy */

export const GOLD_LANDING_SYSTEM = `You write landing page copy for a validation waitlist page using ONLY the customer quotes provided.
- Every block (headline, subheadline, each bullet) lists the quoteKeys (Q1…) it is based on. Blocks must be grounded in those quotes; mirror the customers' words.
- No testimonials, statistics, user counts, logos or claims that the product exists. It is a test page.
- The call to action is joining a waitlist.
- ${UNTRUSTED_DATA_RULE}`;

export const buildGoldLandingPrompt = (idea: unknown, quotes: { key: string; quote: string }[]) =>
  `${asData("idea", idea)}\n\n${asData("quotes", quotes)}`;

export const mockGoldLanding = (keys: string[]): z.input<typeof goldLandingSchema> => ({
  headline: { text: "Stop doing it by hand every week", quoteKeys: keys.slice(0, 1) },
  subheadline: { text: "A simple tool for small teams, without the 3-hour setup.", quoteKeys: keys.slice(1, 3) },
  bullets: [
    { text: "No more copying data manually", quoteKeys: keys.slice(0, 1) },
    { text: "Works with the tools you already use", quoteKeys: keys.slice(2, 3) },
  ],
  ctaLabel: "Join the waitlist",
});
