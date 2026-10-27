import { z } from "zod";

/* ------------------------------------------------------- business model */

export const businessModelSchema = z.object({
  pricingModel: z.object({
    type: z.enum(["per_seat", "flat_subscription", "usage_based", "tiered", "freemium", "one_time", "hybrid"]),
    rationale: z.string().max(800),
  }),
  tiers: z
    .array(
      z.object({
        name: z.string().max(40),
        priceMonthly: z.number().min(0).max(100000).nullable(),
        billingNote: z.string().max(160),
        targetCustomer: z.string().max(300),
        includes: z.array(z.string().max(160)).max(8),
        rationale: z.string().max(500),
      }),
    )
    .min(1)
    .max(4),
  /** Must reference competitors whose pricing was verified from a stored source. */
  competitorAnchors: z.array(z.object({ competitor: z.string().max(120), observation: z.string().max(300) })).max(8),
  revenueStreams: z.array(z.string().max(200)).max(5),
  assumptions: z.array(z.string().max(300)).max(8),
  risks: z.array(z.string().max(300)).max(6),
  pricingExperiments: z
    .array(z.object({ type: z.enum(["pre_sale", "landing_page", "interview", "survey"]), title: z.string().max(160), hypothesis: z.string().max(500), successCriteria: z.string().max(300) }))
    .max(4),
});
export type BusinessModel = z.output<typeof businessModelSchema>;

/* -------------------------------------------------------------- MVP plan */

export const mvpPlanSchema = z.object({
  productSummary: z.string().max(800),
  targetUser: z.string().max(400),
  problemStatement: z.string().max(600),
  mustHave: z
    .array(z.object({ feature: z.string().max(160), why: z.string().max(400), acceptanceCriteria: z.array(z.string().max(240)).min(1).max(6) }))
    .min(1)
    .max(8),
  later: z.array(z.object({ feature: z.string().max(160), reason: z.string().max(300) })).max(12),
  outOfScope: z.array(z.string().max(200)).max(8),
  userJourneys: z.array(z.object({ name: z.string().max(120), steps: z.array(z.string().max(240)).min(1).max(10) })).max(5),
  techNeeds: z.object({
    suggestedStack: z.array(z.string().max(160)).max(8),
    integrations: z.array(z.string().max(160)).max(8),
    dataModel: z.array(z.object({ entity: z.string().max(60), fields: z.array(z.string().max(80)).max(15) })).max(10),
  }),
  milestones: z.array(z.object({ title: z.string().max(120), estimate: z.string().max(60), deliverables: z.array(z.string().max(200)).max(8) })).min(1).max(6),
  launchChecklist: z.array(z.string().max(200)).max(15),
  risks: z.array(z.string().max(300)).max(6),
});
export type MvpPlan = z.output<typeof mvpPlanSchema>;
export const MVP_PLAN_SCHEMA_VERSION = 1;
export const BUSINESS_MODEL_SCHEMA_VERSION = 1;
