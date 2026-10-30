import { z } from "zod";

/*
 * Launch playbook: one plan that takes a validated idea to paying customers — stages with exit gates, a
 * founder-led sales playbook, SaaS metrics, retention and a week-by-week build plan. The revenue maths
 * (customers per MRR milestone, LTV, CAC ceiling) is computed in code from the business model, never by the model.
 */

export const PLAYBOOK_STAGES = ["validate", "build", "pre_launch", "launch", "first_customers", "growth"] as const;
export const PLAYBOOK_STAGE_LABEL: Record<(typeof PLAYBOOK_STAGES)[number], string> = {
  validate: "Validate",
  build: "Build the MVP",
  pre_launch: "Pre-launch",
  launch: "Launch",
  first_customers: "First 10 customers",
  growth: "Grow to $10k MRR",
};

/** Startum features a task can point to, so every step has a "do it here" link. */
export const PLAYBOOK_FEATURES = ["autopilot", "research", "competitors", "market_voices", "validation_lab", "landing_page", "brand", "design", "plan", "marketing", "copilot", "page_review", "none"] as const;

const basis = z.enum(["customer_quote", "research", "hypothesis"]);
const s = (n: number) => z.string().max(n);

export const launchPlaybookSchema = z.object({
  summary: s(700),
  northStar: z.object({ goal: s(160), metric: s(160), why: s(400) }),
  /** The monthly price the maths uses. Replaced by the business model's main tier when there is one. */
  mainPriceMonthly: z.number().min(1).max(100_000),
  stages: z
    .array(
      z.object({
        stage: z.enum(PLAYBOOK_STAGES),
        timeframe: s(40),
        goal: s(300),
        exitCriteria: z.array(s(200)).min(1).max(4),
        tasks: z.array(z.object({ title: s(120), detail: s(500), hours: z.number().int().min(1).max(80), feature: z.enum(PLAYBOOK_FEATURES) })).min(2).max(7),
        risks: z.array(s(240)).max(3),
      }),
    )
    .min(6)
    .max(6),
  sales: z.object({
    motion: z.enum(["self_serve", "founder_led", "sales_assisted"]),
    motionWhy: s(500),
    icp: z.object({ company: s(300), buyer: s(240), user: s(240), triggers: z.array(s(200)).min(1).max(5), disqualifiers: z.array(s(200)).max(5) }),
    prospecting: z.object({ whereToFind: z.array(s(200)).min(1).max(6), listCriteria: z.array(s(200)).min(1).max(6), dailyRoutine: s(400) }),
    outreachSequence: z.array(z.object({ day: z.number().int().min(0).max(30), channel: s(60), goal: s(160), message: s(900) })).min(3).max(6),
    discoveryQuestions: z.array(s(240)).min(5).max(10),
    demoFlow: z.array(z.object({ step: s(80), show: s(240), say: s(300) })).min(3).max(7),
    objections: z.array(z.object({ objection: s(200), response: s(500), basis, evidence: s(400) })).min(3).max(8),
    closing: z.object({ foundingOffer: s(400), ask: s(300), followUp: s(300) }),
    pipeline: z.array(z.object({ stage: s(60), definition: s(240), nextAction: s(240) })).min(4).max(7),
  }),
  metrics: z.object({
    activationMoment: s(300),
    funnel: z.array(z.object({ stage: z.enum(["visitor", "signup", "activated", "paying", "retained"]), definition: s(240), howToMeasure: s(240), targetAssumption: s(160) })).min(5).max(5),
    weeklyDashboard: z.array(s(160)).min(3).max(8),
    /** An assumption to replace with real data after ~3 months of billing. */
    assumedMonthlyChurnPct: z.number().min(0.5).max(30),
    unitEconomicsNotes: s(500),
  }),
  retention: z.object({ onboarding: z.array(s(240)).min(3).max(7), churnSignals: z.array(s(200)).min(2).max(6), saveActions: z.array(s(240)).min(2).max(6) }),
  pricingTactics: z.array(s(240)).min(2).max(5),
  build: z.object({
    sprints: z.array(z.object({ week: z.number().int().min(1).max(12), focus: s(120), deliverables: z.array(s(200)).min(1).max(6), doneWhen: s(240) })).min(2).max(8),
    launchInfra: z.array(s(160)).min(4).max(12),
    aiCodingPrompts: z.array(z.object({ title: s(100), prompt: s(1600) })).min(2).max(5),
  }),
});
export type LaunchPlaybook = z.output<typeof launchPlaybookSchema>;
export const LAUNCH_PLAYBOOK_SCHEMA_VERSION = 1;

export type RevenueMath = {
  priceMonthly: number;
  priceSource: "business_model" | "assumption";
  churnPct: number;
  /** Average revenue over a customer's life at the assumed churn. */
  ltv: number;
  /** A common rule of thumb: spend at most a third of LTV to win a customer. */
  cacCeiling: number;
  milestones: { mrr: number; customers: number }[];
};

export const MRR_MILESTONES = [1_000, 5_000, 10_000] as const;

/** Deterministic maths for the playbook, so the numbers always agree with the pricing. */
export function revenueMath(priceMonthly: number, churnPct: number, priceSource: RevenueMath["priceSource"]): RevenueMath {
  const ltv = Math.round(priceMonthly / (churnPct / 100));
  return {
    priceMonthly,
    priceSource,
    churnPct,
    ltv,
    cacCeiling: Math.round(ltv / 3),
    milestones: MRR_MILESTONES.map((mrr) => ({ mrr, customers: Math.ceil(mrr / priceMonthly) })),
  };
}

/** The tier the maths uses: the middle paid tier (the one most plans steer buyers to). */
export function mainTierPrice(tiers: { priceMonthly: number | null }[]): number | null {
  const paid = tiers.map((t) => t.priceMonthly).filter((p): p is number => p !== null && p > 0);
  if (!paid.length) return null;
  return paid[Math.floor((paid.length - 1) / 2)];
}
