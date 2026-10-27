import { z } from "zod";

/* ------------------------------------------------------------------------ */
/* AI step outputs                                                          */
/* ------------------------------------------------------------------------ */

export const researchPlanSchema = z.object({
  focus: z.string().max(600),
  queries: z.array(z.string().min(3).max(200)).min(1).max(8),
});

/** Evidence extracted from stored sources. `quote` must appear verbatim in the source text. */
export const extractionSchema = z.object({
  evidence: z
    .array(
      z.object({
        sourceKey: z.string().max(10),
        quote: z.string().max(600),
        claim: z.string().max(500),
        topic: z.enum(["problem", "demand", "customer", "competitor", "pricing", "market", "risk", "other"]),
      }),
    )
    .max(60),
  competitors: z
    .array(
      z.object({
        name: z.string().max(120),
        website: z.string().max(300).nullable(),
        type: z.enum(["direct", "indirect", "alternative"]),
        sourceKeys: z.array(z.string().max(10)).max(10),
        pricingQuote: z.string().max(400).nullable(),
        pricingSourceKey: z.string().max(10).nullable(),
      }),
    )
    .max(15),
});

export const statementSchema = z.object({
  text: z.string().min(1).max(1200),
  kind: z.enum(["FACT", "ANALYSIS", "ASSUMPTION"]),
  sources: z.array(z.string().max(10)).max(8),
});
export type Statement = z.output<typeof statementSchema>;

const statements = z.array(statementSchema).max(12);

const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
  label: z.string().max(40),
  justification: z.string().max(800),
});
export type Rating = z.output<typeof ratingSchema>;

export const RATING_KEYS = ["demandEvidence", "competitivePressure", "feasibility", "monetization"] as const;
export type RatingKey = (typeof RATING_KEYS)[number];

export const REPORT_SECTIONS = [
  { key: "executiveSummary", title: "Executive summary" },
  { key: "problem", title: "Problem" },
  { key: "targetCustomer", title: "Target customer" },
  { key: "demandEvidence", title: "Demand evidence" },
  { key: "marketAnalysis", title: "Market analysis" },
  { key: "marketLimitations", title: "Limitations of this analysis" },
  { key: "competitorLandscape", title: "Competitors" },
  { key: "differentiation", title: "Differentiation" },
  { key: "monetization", title: "Monetization" },
  { key: "pricingHypotheses", title: "Pricing hypotheses" },
  { key: "feasibility", title: "Feasibility" },
  { key: "acquisitionChallenges", title: "Acquisition challenges" },
  { key: "risks", title: "Risks" },
] as const;
export type SectionKey = (typeof REPORT_SECTIONS)[number]["key"];

export const validationReportSchema = z.object({
  summary: z.string().max(800),
  sections: z.object(Object.fromEntries(REPORT_SECTIONS.map((s) => [s.key, statements])) as Record<SectionKey, typeof statements>),
  ratings: z.object(Object.fromEntries(RATING_KEYS.map((k) => [k, ratingSchema])) as Record<RatingKey, typeof ratingSchema>),
  openQuestions: z.array(z.string().max(400)).max(12),
  recommendedExperiments: z
    .array(
      z.object({
        type: z.enum(["interview", "survey", "landing_page", "waitlist", "demo_request", "outreach", "pre_sale"]),
        title: z.string().max(160),
        hypothesis: z.string().max(600),
        successCriteria: z.string().max(400),
      }),
    )
    .max(6),
  mvpScope: z.object({ mustHave: z.array(z.string().max(300)).max(10), later: z.array(z.string().max(300)).max(10) }),
  nextAction: z.string().max(300),
  competitors: z
    .array(
      z.object({
        name: z.string().max(120),
        website: z.string().max(300).nullable(),
        type: z.enum(["direct", "indirect", "alternative"]),
        features: z.array(z.string().max(200)).max(10),
        strengths: z.array(z.string().max(300)).max(6),
        weaknesses: z.array(z.string().max(300)).max(6),
        sources: z.array(z.string().max(10)).max(10),
        pricing: z.object({ summary: z.string().max(300), source: z.string().max(10) }).nullable(),
      }),
    )
    .max(15),
});
export type ValidationReport = z.output<typeof validationReportSchema>;

export const REPORT_SCHEMA_VERSION = 1;

export const RESEARCH_STAGES = [
  { key: "queued", label: "Waiting for a worker" },
  { key: "planning", label: "Planning research" },
  { key: "searching", label: "Searching the web" },
  { key: "reading", label: "Reading sources" },
  { key: "extracting", label: "Extracting evidence" },
  { key: "synthesizing", label: "Writing the report" },
  { key: "verifying", label: "Verifying citations" },
  { key: "saving", label: "Saving" },
] as const;
export type ResearchStage = (typeof RESEARCH_STAGES)[number]["key"];
