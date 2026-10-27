/**
 * Deterministic demand rules — no AI involved.
 *
 * Trend classification on a monthly interest series (oldest first, ~60 points for 5 years):
 *  - unknown:   fewer than 12 points, or no signal at all
 *  - fad:       a sharp spike (peak ≥ 3× the series median) that has since collapsed
 *               (last-6-month average ≤ 40% of the peak), with the peak not in the last 6 months
 *  - growing:   last-12-month average ≥ 125% of the first-12-month average
 *  - declining: last-12-month average ≤ 75% of the first-12-month average
 *  - stable:    everything else
 */
export type TrendClass = "growing" | "stable" | "fad" | "declining" | "unknown";
export type TrendPoint = { month: string; value: number };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const TREND_RULES = {
  minPoints: 12,
  fadSpikeOverMedian: 3,
  fadCollapseRatio: 0.4,
  growthRatio: 1.25,
  declineRatio: 0.75,
} as const;

export function classifyTrend(series: TrendPoint[] | null | undefined): TrendClass {
  if (!series || series.length < TREND_RULES.minPoints) return "unknown";
  const values = series.map((p) => (Number.isFinite(p.value) && p.value > 0 ? p.value : 0));
  if (values.every((v) => v === 0)) return "unknown";

  const peak = Math.max(...values);
  const peakIndex = values.indexOf(peak);
  const med = median(values);
  const last6 = avg(values.slice(-6));
  const spiked = med === 0 ? peak > 0 && values.filter((v) => v > 0).length <= values.length / 4 : peak >= TREND_RULES.fadSpikeOverMedian * med;
  if (spiked && last6 <= TREND_RULES.fadCollapseRatio * peak && peakIndex < values.length - 6) return "fad";

  const first = avg(values.slice(0, 12));
  const last = avg(values.slice(-12));
  if (first === 0) return last > 0 ? "growing" : "unknown";
  if (last >= TREND_RULES.growthRatio * first) return "growing";
  if (last <= TREND_RULES.declineRatio * first) return "declining";
  return "stable";
}

export type DemandVerdict = "strong" | "weak" | "needs_more_data";

export const DEMAND_RULES = {
  strongVolume: 1000,
  weakTotalVolume: 300,
  competitorSignal: 3,
} as const;

/**
 * Overall demand verdict from keyword rows + competitor count.
 *  - needs_more_data: no keyword has volume data
 *  - strong: some keyword has ≥ 1000 searches/month and is not declining/fad, or total volume ≥ 300 with ≥ 3 competitors
 *  - weak: otherwise
 */
export function demandVerdict(rows: { volume: number | null; trendClass: TrendClass }[], competitorCount: number | null): DemandVerdict {
  const withData = rows.filter((r) => r.volume !== null);
  if (!withData.length) return "needs_more_data";
  const total = withData.reduce((sum, r) => sum + (r.volume ?? 0), 0);
  const healthy = (r: { trendClass: TrendClass }) => r.trendClass !== "declining" && r.trendClass !== "fad";
  if (withData.some((r) => (r.volume ?? 0) >= DEMAND_RULES.strongVolume && healthy(r))) return "strong";
  if (total >= DEMAND_RULES.weakTotalVolume && (competitorCount ?? 0) >= DEMAND_RULES.competitorSignal && withData.some(healthy)) return "strong";
  return "weak";
}
