/*
 * Verdict scorecard and micro-SaaS fit check. Pure (no DB, no AI) so every rule is unit-tested.
 * It reads evidence the project already has: the report's four ratings, sourced competitor prices,
 * verified customer quotes, waitlist signups and experiment results, plus the founder's profile.
 * The result is a reading of that evidence (ANALYSIS), never a prediction or a probability of success.
 */

import type { RatingKey } from "@/lib/validation/research";

export type VerdictInput = {
  ratings: Partial<Record<RatingKey, { score: number; label?: string; justification: string }>> | null;
  sources: number;
  facts: number;
  competitors: number;
  /** Cheapest paid monthly price per competitor, only where the price was matched in a source. */
  prices: number[];
  /** Verified customer quotes: platform label and theme/cluster label. */
  quotes: { platform: string; theme: string }[];
  signups: number;
  results: number;
  profile: { technicalLevel: string; timePerWeek: string; budget: string } | null;
};

export type SignalStatus = "strong" | "mixed" | "weak";
export type Signal = { key: "demand" | "money" | "build" | "competition"; label: string; points: number; status: SignalStatus; detail: string };
export type Decision = "go" | "pivot" | "drop" | "incomplete";

export type Verdict = {
  decision: Decision;
  /** 0–100 evidence score; null until there is a research report. */
  score: number | null;
  confidence: "low" | "medium" | "high";
  headline: string;
  signals: Signal[];
  strongest: Signal | null;
  weakest: Signal | null;
  nextSteps: string[];
};

const WEIGHTS = { demand: 0.35, money: 0.25, build: 0.2, competition: 0.2 } as const;
const PRAISE = "Praise for an existing tool";
const unit = (score: number | undefined) => (score ? Math.min(1, Math.max(0, (score - 1) / 4)) : 0);
const status = (p: number): SignalStatus => (p >= 0.65 ? "strong" : p >= 0.4 ? "mixed" : "weak");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function buildVerdict(v: VerdictInput): Verdict {
  const r = v.ratings;
  if (!r || !r.demandEvidence) {
    return {
      decision: "incomplete",
      score: null,
      confidence: "low",
      headline: "Not enough evidence yet. Run the validation to get a verdict.",
      signals: [],
      strongest: null,
      weakest: null,
      nextSteps: ["Click “Validate my idea” to research the market, competitors and what people say."],
    };
  }

  const demandQuotes = v.quotes.filter((q) => q.theme !== PRAISE).length;
  const quoteScore = Math.min(1, demandQuotes / 15);
  const demand = v.quotes.length ? 0.6 * unit(r.demandEvidence.score) + 0.4 * quoteScore : unit(r.demandEvidence.score);

  const priceScore = v.prices.length >= 2 ? 1 : v.prices.length === 1 ? 0.6 : 0.2;
  const money = 0.7 * unit(r.monetization?.score) + 0.3 * priceScore;

  let build = unit(r.feasibility?.score);
  if (v.profile?.technicalLevel === "non_technical" && (r.feasibility?.score ?? 0) <= 3) build = Math.max(0, build - 0.15);
  if (v.profile?.timePerWeek === "under_5h") build = Math.max(0, build - 0.1);

  // Higher pressure is worse for a small team; no competitors at all is a mild warning too (is there a market?).
  const competition = v.competitors === 0 ? 0.5 : 1 - unit(r.competitivePressure?.score) * 0.8;

  const signals: Signal[] = [
    { key: "demand", label: "Demand", points: demand, status: status(demand), detail: `${r.demandEvidence.label ?? ""} evidence (${r.demandEvidence.score}/5)${v.quotes.length ? ` · ${plural(demandQuotes, "real quote")} about the problem` : " · no customer quotes yet"}` },
    { key: "money", label: "Willingness to pay", points: money, status: status(money), detail: `${r.monetization?.label ?? "Unclear"} (${r.monetization?.score ?? "?"}/5) · ${v.prices.length ? `${plural(v.prices.length, "competitor")} with sourced prices` : "no sourced competitor prices"}` },
    { key: "build", label: "Can you build it", points: build, status: status(build), detail: `${r.feasibility?.label ?? "Unknown"} feasibility (${r.feasibility?.score ?? "?"}/5)${v.profile ? " for your skills and time" : ""}` },
    { key: "competition", label: "Room to compete", points: competition, status: status(competition), detail: v.competitors ? `${r.competitivePressure?.label ?? ""} pressure (${r.competitivePressure?.score ?? "?"}/5) · ${plural(v.competitors, "competitor")}` : "No competitors found: check the market exists" },
  ];

  const bonus = Math.min(10, (v.signups >= 10 ? 5 : 0) + (v.results > 0 ? 5 : 0));
  const score = Math.round(Math.min(100, (WEIGHTS.demand * demand + WEIGHTS.money * money + WEIGHTS.build * build + WEIGHTS.competition * competition) * 100 + bonus));
  const decision: Decision = score >= 68 ? "go" : score >= 45 ? "pivot" : "drop";

  const evidencePoints = (v.sources >= 5 ? 1 : 0) + (v.quotes.length >= 10 ? 1 : 0) + (v.prices.length >= 2 ? 1 : 0) + (v.signups > 0 || v.results > 0 ? 1 : 0);
  const confidence = evidencePoints >= 3 ? "high" : evidencePoints >= 2 ? "medium" : "low";

  const sorted = [...signals].sort((a, b) => b.points - a.points);
  const weakest = sorted[sorted.length - 1];
  const headline = {
    go: "Go: the evidence supports building a first version.",
    pivot: `Pivot or sharpen: promising, but ${weakest.label.toLowerCase()} is the weak spot.`,
    drop: "Drop or rethink: the evidence is weak on several fronts.",
  }[decision];

  return { decision, score, confidence, headline, signals, strongest: sorted[0], weakest, nextSteps: nextSteps(v, weakest) };
}

function nextSteps(v: VerdictInput, weakest: Signal): string[] {
  const steps: string[] = [];
  const byWeakness: Record<Signal["key"], string> = {
    demand: v.quotes.length ? "Talk to 5 people from the quotes below and confirm the problem in their words." : "Run Market voices to find real people describing this problem.",
    money: "Ask 5 potential customers to pre-order or join a paid waitlist. A price they accept is the strongest proof.",
    build: "Cut the first version down to one core workflow you can ship in a few weekends.",
    competition: "Pick a narrower niche the big competitors serve badly, and say so on your landing page.",
  };
  steps.push(byWeakness[weakest.key]);
  if (v.signups === 0) steps.push("Publish a waitlist page and share it where your customers talk. Aim for 20 signups.");
  if (v.results === 0) steps.push("Record at least one real experiment result before deciding to build.");
  return steps.slice(0, 3);
}

/* ------------------------------------------------------------------------ */
/* Micro-SaaS fit                                                            */
/* ------------------------------------------------------------------------ */

export type Fit = {
  solo: { level: "likely" | "stretch" | "hard"; detail: string };
  channels: { platform: string; quotes: number }[];
  price: { suggested: number; low: number; high: number; median: number; count: number } | null;
  /** Paying customers needed for each monthly revenue target at the suggested price. */
  revenue: { target: number; customers: number }[];
  budgetNote: string | null;
};

const TECH_RANK: Record<string, number> = { non_technical: 0, no_code: 1, some_coding: 2, developer: 3, senior_engineer: 4 };

export function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function microSaasFit(v: VerdictInput): Fit {
  const feas = v.ratings?.feasibility?.score ?? 0;
  const tech = v.profile ? (TECH_RANK[v.profile.technicalLevel] ?? 2) : 2;
  const time = v.profile?.timePerWeek;
  const points = feas + (tech >= 3 ? 1 : tech <= 0 ? -1 : 0) + (time === "under_5h" ? -1 : time === "15_30h" || time === "full_time" ? 1 : 0);
  const level = points >= 5 ? "likely" : points >= 3 ? "stretch" : "hard";
  const solo = {
    level,
    detail: {
      likely: "A solo founder with your skills and time can likely ship a first version.",
      stretch: "Doable solo if you keep the first version to one workflow, or use no-code tools.",
      hard: "Hard to build alone with your current skills and time. Consider no-code, a technical partner or a smaller scope.",
    }[level],
  } as const;

  const counts = new Map<string, number>();
  for (const q of v.quotes) if (q.platform && q.platform !== "Web") counts.set(q.platform, (counts.get(q.platform) ?? 0) + 1);
  const channels = [...counts.entries()].map(([platform, quotes]) => ({ platform, quotes })).sort((a, b) => b.quotes - a.quotes).slice(0, 4);

  const prices = v.prices.filter((p) => p > 0);
  let price: Fit["price"] = null;
  if (prices.length) {
    const med = median(prices);
    // A newcomer usually enters at or a little under the typical price; never below $5.
    const suggested = Math.max(5, Math.round(med * 0.9));
    price = { suggested, low: Math.min(...prices), high: Math.max(...prices), median: med, count: prices.length };
  }
  const revenue = price ? [1000, 5000, 10000].map((target) => ({ target, customers: Math.ceil(target / price.suggested) })) : [];

  const budgetNote = v.profile?.budget === "under_500" ? "With a budget under $500, start with free channels (communities, content, outreach) before paid ads." : null;
  return { solo, channels, price, revenue, budgetNote };
}
