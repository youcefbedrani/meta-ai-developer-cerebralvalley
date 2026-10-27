import { z } from "zod";

export const COMPLEXITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

const optionalText = (max = 200) => z.string().trim().max(max).optional().default("");

/** What the founder asks the Idea Finder for. */
export const ideaInputsSchema = z.object({
  niche: optionalText(),
  customer: optionalText(),
  geography: optionalText(100),
  budget: optionalText(100),
  skills: optionalText(300),
  businessModel: optionalText(100),
  complexity: z.enum(["any", "low", "medium", "high"]).default("any"),
  timeAvailable: optionalText(100),
  constraints: optionalText(500),
  count: z.coerce.number().int().min(1).max(6).default(4),
});
export type IdeaInputs = z.output<typeof ideaInputsSchema>;
export type IdeaInputsInput = z.input<typeof ideaInputsSchema>;

/**
 * One generated idea. Everything here is a hypothesis: the Idea Finder does no
 * web research, so it must not state facts, statistics, prices or competitors
 * as known. "evidenceAvailable" lists kinds of evidence that likely exist and
 * where to look — not findings.
 */
export const ideaContentSchema = z.object({
  title: z.string().min(3).max(120),
  oneLiner: z.string().min(5).max(240),
  problem: z.string().min(10).max(1200),
  targetCustomer: z.string().min(5).max(600),
  currentAlternatives: z.array(z.string().max(300)).max(8),
  solution: z.string().min(10).max(1200),
  differentiationHypothesis: z.string().min(5).max(800),
  monetization: z.string().min(5).max(600),
  pricingHypotheses: z.array(z.string().max(300)).max(5),
  complexity: z.enum(["low", "medium", "high"]),
  complexityReason: z.string().max(400),
  risks: z.array(z.string().max(300)).max(8),
  evidenceToLookFor: z.array(z.string().max(300)).max(8),
  evidenceMissing: z.array(z.string().max(300)).max(8),
  firstExperiment: z.object({
    type: z.enum(["interview", "survey", "landing_page", "waitlist", "demo_request", "outreach", "pre_sale"]),
    description: z.string().max(800),
    successCriteria: z.string().max(400),
  }),
});
export type IdeaContent = z.output<typeof ideaContentSchema>;

export const ideasOutputSchema = z.object({ ideas: z.array(ideaContentSchema).min(1).max(6) });

export const ideaListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  status: z.enum(["all", "generated", "saved", "converted", "dismissed"]).catch("all").default("all"),
  complexity: z.enum(["all", "low", "medium", "high"]).catch("all").default("all"),
  sort: z.enum(["newest", "oldest", "complexity"]).catch("newest").default("newest"),
});
export type IdeaListQuery = z.output<typeof ideaListQuerySchema>;
