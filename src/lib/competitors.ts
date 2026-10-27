/*
 * Competitor analysis helpers (pure, unit-tested). Everything is derived from stored competitor
 * rows; nothing is estimated. Prices come only from plans whose price was matched in a source quote.
 */

export type CompetitorLike = {
  id: string;
  name: string;
  type: "direct" | "indirect" | "alternative";
  origin: "research" | "scan" | "manual";
  website: string | null;
  description: string | null;
  targetCustomer: string | null;
  features: string[] | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  pricingSourceId: string | null;
  pricingPlans: { name: string; priceMonthly: number | null; currency: string; quote: string }[] | null;
  sources: unknown[];
};

const featureKey = (f: string) => f.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/** Features × competitors: which competitor mentions which feature, most-mentioned first. */
export function featureMatrix(list: CompetitorLike[], limit = 12) {
  const byKey = new Map<string, { label: string; ids: Set<string> }>();
  for (const c of list) {
    for (const f of c.features ?? []) {
      const k = featureKey(f);
      if (!k) continue;
      const entry = byKey.get(k) ?? { label: f.trim(), ids: new Set<string>() };
      entry.ids.add(c.id);
      byKey.set(k, entry);
    }
  }
  const features = [...byKey.values()].sort((a, b) => b.ids.size - a.ids.size || a.label.localeCompare(b.label)).slice(0, limit);
  const competitors = list.filter((c) => (c.features ?? []).length > 0);
  return {
    features: features.map((f) => ({ label: f.label, count: f.ids.size, has: (id: string) => f.ids.has(id) })),
    competitors,
    /** Mentioned by most competitors = table stakes; by exactly one = possible differentiator for them. */
    tableStakes: features.filter((f) => competitors.length >= 3 && f.ids.size >= Math.ceil(competitors.length * 0.6)).map((f) => f.label),
    rare: features.filter((f) => f.ids.size === 1 && competitors.length >= 3).map((f) => f.label),
  };
}

/** Lowest sourced monthly price per competitor, cheapest first. Competitors without a sourced price are listed separately. */
export function pricingLadder(list: CompetitorLike[]) {
  const priced: { id: string; name: string; type: CompetitorLike["type"]; price: number; currency: string; plan: string; quote: string; free: boolean }[] = [];
  const unpriced: string[] = [];
  for (const c of list) {
    const plans = (c.pricingPlans ?? []).filter((p): p is typeof p & { priceMonthly: number } => p.priceMonthly !== null);
    if (!c.pricingSourceId || !plans.length) {
      unpriced.push(c.name);
      continue;
    }
    const paid = plans.filter((p) => p.priceMonthly > 0);
    const cheapest = (paid.length ? paid : plans).reduce((a, b) => (b.priceMonthly < a.priceMonthly ? b : a));
    priced.push({ id: c.id, name: c.name, type: c.type, price: cheapest.priceMonthly, currency: cheapest.currency || "USD", plan: cheapest.name, quote: cheapest.quote, free: plans.some((p) => p.priceMonthly === 0) });
  }
  priced.sort((a, b) => a.price - b.price);
  return { priced, unpriced };
}

export const COVERAGE_FIELDS = ["website", "description", "customer", "features", "pricing", "strengths", "weaknesses", "sources"] as const;
export type CoverageField = (typeof COVERAGE_FIELDS)[number];

/** Which facts we have for a competitor, and which are missing. */
export function coverage(c: CompetitorLike): Record<CoverageField, boolean> {
  return {
    website: !!c.website,
    description: !!c.description,
    customer: !!c.targetCustomer,
    features: (c.features ?? []).length > 0,
    pricing: !!c.pricingSourceId,
    strengths: (c.strengths ?? []).length > 0,
    weaknesses: (c.weaknesses ?? []).length > 0,
    sources: c.sources.length > 0,
  };
}

export function coverageSummary(list: CompetitorLike[]) {
  const cells = list.flatMap((c) => Object.values(coverage(c)));
  const filled = cells.filter(Boolean).length;
  return { filled, total: cells.length, gaps: cells.length - filled, percent: cells.length ? Math.round((filled / cells.length) * 100) : 0 };
}

export function byType(list: CompetitorLike[]) {
  return {
    direct: list.filter((c) => c.type === "direct"),
    indirect: list.filter((c) => c.type === "indirect"),
    alternative: list.filter((c) => c.type === "alternative"),
  };
}
