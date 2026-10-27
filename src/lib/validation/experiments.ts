import { z } from "zod";
import { landingStyleSchema } from "@/lib/landing-themes";

export const EXPERIMENT_TYPES = [
  { value: "interview", label: "Customer interviews" },
  { value: "survey", label: "Survey" },
  { value: "landing_page", label: "Landing page" },
  { value: "waitlist", label: "Waitlist" },
  { value: "demo_request", label: "Demo requests" },
  { value: "outreach", label: "Outreach" },
  { value: "pre_sale", label: "Pre-sale" },
] as const;
export type ExperimentType = (typeof EXPERIMENT_TYPES)[number]["value"];
const typeValues = EXPERIMENT_TYPES.map((t) => t.value) as [ExperimentType, ...ExperimentType[]];

const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.date().nullable(),
);

export const experimentInputSchema = z.object({
  type: z.enum(typeValues),
  title: z.string().trim().min(3, "Give the experiment a title").max(160),
  hypothesis: z.string().trim().min(10, "State what you believe is true").max(1000),
  audience: z.string().trim().max(500).default(""),
  procedure: z.string().trim().max(8000).default(""),
  successCriteria: z.string().trim().min(5, "Define success before you start").max(600),
  startDate: optionalDate.default(null),
  endDate: optionalDate.default(null),
});
export type ExperimentInput = z.input<typeof experimentInputSchema>;

export const resultInputSchema = z.object({
  metric: z.string().trim().min(1, "Name the metric").max(120),
  value: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().finite().nullable()).default(null),
  notes: z.string().trim().max(8000).default(""),
});

export const completeExperimentSchema = z.object({
  passed: z.boolean(),
  learnings: z.string().trim().min(5, "What did you learn?").max(4000),
  nextAction: z.string().trim().max(300).default(""),
});

export const decisionSchema = z.object({
  decision: z.enum(["build", "pivot", "drop"]),
  note: z.string().trim().max(2000).default(""),
});

/* --------------------------------------------------- AI: interview tools */

export const interviewScriptSchema = z.object({
  goal: z.string().max(400),
  intro: z.string().max(800),
  sections: z
    .array(z.object({ title: z.string().max(120), questions: z.array(z.string().max(300)).max(8) }))
    .max(6),
  avoid: z.array(z.string().max(300)).max(6),
  closing: z.string().max(600),
});
export type InterviewScript = z.output<typeof interviewScriptSchema>;

export const notesAnalysisSchema = z.object({
  summary: z.string().max(1200),
  painPoints: z.array(z.object({ point: z.string().max(300), quote: z.string().max(400) })).max(10),
  currentSolutions: z.array(z.string().max(300)).max(8),
  willingnessToPay: z.array(z.object({ signal: z.string().max(300), quote: z.string().max(400) })).max(6),
  hypothesisVerdict: z.enum(["supports", "contradicts", "inconclusive"]),
  verdictReasoning: z.string().max(800),
  followUps: z.array(z.string().max(300)).max(8),
});
export type NotesAnalysis = z.output<typeof notesAnalysisSchema>;

export const notesInputSchema = z.object({ notes: z.string().trim().min(40, "Paste at least a few sentences of notes").max(20000) });

/* ------------------------------------------------------- landing pages */

export const landingContentSchema = z.object({
  headline: z.string().trim().min(5).max(90),
  subheadline: z.string().trim().min(5).max(240),
  bullets: z.array(z.string().trim().min(2).max(140)).min(1).max(5),
  ctaLabel: z.string().trim().min(2).max(30),
  /** Pain-quote ids each block is based on (Gold Mine drafts). Shown as "Based on N quotes". */
  quoteRefs: z
    .object({
      headline: z.array(z.uuid()).max(8),
      subheadline: z.array(z.uuid()).max(8),
      bullets: z.array(z.array(z.uuid()).max(8)).max(5),
    })
    .optional(),
  /** Theme and logo. Missing on older pages, which render with the default theme. */
  style: landingStyleSchema.optional(),
});
export type LandingContent = z.output<typeof landingContentSchema>;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/, "3–48 characters: lowercase letters, numbers and dashes");

const utmTag = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{1,60}$/).optional().catch(undefined);
export const utmTagsSchema = z.object({ medium: utmTag, campaign: utmTag, content: utmTag, term: utmTag });

export const utmVisitSchema = z.object({ source: utmTag, utm: utmTagsSchema.optional().catch(undefined) });

export const waitlistSignupSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  /** Honeypot: real users never fill this hidden field. */
  website: z.string().max(0).optional().default(""),
  /** utm_source from the page URL, used to attribute signups to marketing channels. */
  source: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{1,60}$/).optional().catch(undefined),
  /** Other UTM tags (medium/campaign/content/term) for per-campaign and per-variant attribution. */
  utm: utmTagsSchema.optional().catch(undefined),
  /** Explicit, optional opt-in to pass the email on if the product is sold. */
  consentTransfer: z.boolean().optional().catch(false),
});
