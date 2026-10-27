/*
 * Deterministic marketing math. Every ratio is computed only from numbers
 * that were tracked or entered; a missing or zero denominator gives null
 * ("—" in the UI), never an estimate.
 */

export type FunnelInput = {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  visits: number | null;
  signups: number | null;
  customers: number | null;
  revenue: number | null;
};

export type FunnelMetrics = {
  ctr: number | null;
  costPerClick: number | null;
  signupRate: number | null;
  costPerSignup: number | null;
  customerRate: number | null;
  costPerCustomer: number | null;
  roas: number | null;
};

const ratio = (a: number | null, b: number | null) => (a === null || b === null || b <= 0 ? null : a / b);

export function funnelMetrics(f: FunnelInput): FunnelMetrics {
  // Cost metrics need a recorded spend; with no spend entered, they're unknown rather than free.
  return {
    ctr: ratio(f.clicks, f.impressions),
    costPerClick: ratio(f.spend, f.clicks),
    signupRate: ratio(f.signups, f.visits ?? f.clicks),
    costPerSignup: ratio(f.spend, f.signups),
    customerRate: ratio(f.customers, f.signups),
    costPerCustomer: ratio(f.spend, f.customers),
    roas: ratio(f.revenue, f.spend),
  };
}

/** Sums nullable numbers: null only if every value is null. */
export function sumNullable(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

export type ChannelFunnel = FunnelInput & {
  channel: string;
  /** Where visits/signups came from: our own tracking beats self-reported numbers. */
  visitsSource: "tracked" | "self_reported" | null;
  signupsSource: "tracked" | "self_reported" | null;
  metrics: FunnelMetrics;
};

/**
 * Merges self-reported results with visits/signups we tracked on hosted
 * landing pages (matched by UTM source). Tracked numbers win when present.
 */
export function mergeChannelFunnel(
  channel: string,
  manual: Omit<FunnelInput, never>,
  tracked: { visits: number; signups: number } | undefined,
): ChannelFunnel {
  const visits = tracked && tracked.visits > 0 ? tracked.visits : manual.visits;
  const signups = tracked && tracked.signups > 0 ? tracked.signups : manual.signups;
  const merged = { ...manual, visits, signups };
  return {
    channel,
    ...merged,
    visitsSource: tracked && tracked.visits > 0 ? "tracked" : manual.visits !== null ? "self_reported" : null,
    signupsSource: tracked && tracked.signups > 0 ? "tracked" : manual.signups !== null ? "self_reported" : null,
    metrics: funnelMetrics(merged),
  };
}

export type VariantDecision = { decision: "keep_running" | "continue" | "stop"; costPerSignup: number | null; reason: string };

/**
 * The stop/continue rule the founder set before spending: after `minClicks`
 * clicks, a variant whose cost per signup is above the threshold stops.
 */
export function decideVariant(r: { spend: number | null; clicks: number | null; signups: number | null }, rule: { maxCostPerSignup: number; minClicks: number }): VariantDecision {
  const clicks = r.clicks ?? 0;
  const spend = r.spend ?? 0;
  const signups = r.signups ?? 0;
  const cps = signups > 0 ? spend / signups : null;
  if (clicks < rule.minClicks) return { decision: "keep_running", costPerSignup: cps, reason: `${clicks} of ${rule.minClicks} clicks recorded. Not enough data to decide yet.` };
  if (signups === 0) return { decision: "stop", costPerSignup: null, reason: `${clicks} clicks and no signups. Stop or change the ad.` };
  if (cps !== null && cps <= rule.maxCostPerSignup) return { decision: "continue", costPerSignup: cps, reason: `Cost per signup ${cps.toFixed(2)} is within your limit of ${rule.maxCostPerSignup.toFixed(2)}.` };
  return { decision: "stop", costPerSignup: cps, reason: `Cost per signup ${cps!.toFixed(2)} is above your limit of ${rule.maxCostPerSignup.toFixed(2)}.` };
}

/** Enough data to judge a channel at all? Below this the recommendation is forced to "need more data". */
export function hasEnoughData(f: Pick<FunnelInput, "visits" | "clicks" | "signups" | "customers">): boolean {
  return (f.visits ?? 0) + (f.clicks ?? 0) >= 30 || (f.signups ?? 0) >= 3 || (f.customers ?? 0) >= 1;
}
