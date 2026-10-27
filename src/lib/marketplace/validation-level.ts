/*
 * Validation level of a project package, computed by the platform. Sellers
 * never declare it. "Verified" metrics are ones we tracked ourselves (our
 * hosted landing pages, our payments); everything entered by users is
 * labelled self-reported.
 */

export const VALIDATION_LEVELS = ["none", "researched", "tested", "validated", "revenue"] as const;
export type ValidationLevel = (typeof VALIDATION_LEVELS)[number];

/** Thresholds for VALIDATED. Any one of them is enough. */
export const VALIDATION_THRESHOLDS = {
  trackedSignups: 50,
  loggedInterviews: 10,
  preSales: 3,
} as const;

export type ProjectStats = {
  researchReports: number;
  reportSources: number;
  completedExperimentsWithResults: number;
  trackedVisits: number;
  trackedSignups: number;
  loggedInterviews: number;
  preSales: number;
  /** Revenue verified through connected Stripe (not available yet). */
  verifiedRevenueCents: number | null;
  selfReported: { signups: number | null; customers: number | null; revenue: number | null };
};

export function computeValidationLevel(s: ProjectStats, t: typeof VALIDATION_THRESHOLDS = VALIDATION_THRESHOLDS): ValidationLevel {
  if (s.verifiedRevenueCents !== null && s.verifiedRevenueCents > 0) return "revenue";
  if (s.trackedSignups >= t.trackedSignups || s.loggedInterviews >= t.loggedInterviews || s.preSales >= t.preSales) return "validated";
  if (s.completedExperimentsWithResults > 0) return "tested";
  if (s.researchReports > 0 && s.reportSources > 0) return "researched";
  return "none";
}

export type PublicMetric = { label: string; value: string; verified: boolean };

/** Metrics shown on the public teaser, each labelled verified or self-reported. */
export function publicMetrics(s: ProjectStats): PublicMetric[] {
  const out: PublicMetric[] = [];
  if (s.trackedVisits > 0) out.push({ label: "Landing page visits", value: s.trackedVisits.toLocaleString("en-US"), verified: true });
  if (s.trackedSignups > 0) out.push({ label: "Waitlist signups", value: s.trackedSignups.toLocaleString("en-US"), verified: true });
  if (s.reportSources > 0) out.push({ label: "Cited research sources", value: String(s.reportSources), verified: true });
  if (s.completedExperimentsWithResults > 0) out.push({ label: "Completed experiments", value: String(s.completedExperimentsWithResults), verified: false });
  if (s.loggedInterviews > 0) out.push({ label: "Logged interviews", value: String(s.loggedInterviews), verified: false });
  if (s.preSales > 0) out.push({ label: "Pre-sales", value: String(s.preSales), verified: false });
  if (s.selfReported.customers) out.push({ label: "Customers", value: String(s.selfReported.customers), verified: false });
  if (s.selfReported.revenue) out.push({ label: "Revenue", value: `$${s.selfReported.revenue.toLocaleString("en-US")}`, verified: false });
  return out;
}

export const LEVEL_INFO: Record<ValidationLevel, { label: string; description: string }> = {
  none: { label: "Idea", description: "No completed research yet." },
  researched: { label: "Researched", description: "Has a completed research report with cited sources." },
  tested: { label: "Tested", description: "At least one completed experiment with recorded results." },
  validated: {
    label: "Validated",
    description: `Met a threshold: ${VALIDATION_THRESHOLDS.trackedSignups}+ tracked waitlist signups, ${VALIDATION_THRESHOLDS.loggedInterviews}+ logged interviews, or ${VALIDATION_THRESHOLDS.preSales}+ pre-sales.`,
  },
  revenue: { label: "Revenue", description: "Revenue verified through a connected Stripe account." },
};

export function levelAtLeast(level: ValidationLevel, min: ValidationLevel): boolean {
  return VALIDATION_LEVELS.indexOf(level) >= VALIDATION_LEVELS.indexOf(min);
}
