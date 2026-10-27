import { z } from "zod";

export const TECHNICAL_LEVELS = [
  { value: "non_technical", label: "Non-technical" },
  { value: "no_code", label: "No-code / low-code builder" },
  { value: "some_coding", label: "Some coding experience" },
  { value: "developer", label: "Professional developer" },
  { value: "senior_engineer", label: "Senior engineer / architect" },
] as const;

export const BUDGETS = [
  { value: "under_500", label: "Under $500" },
  { value: "500_2k", label: "$500 – $2,000" },
  { value: "2k_10k", label: "$2,000 – $10,000" },
  { value: "over_10k", label: "Over $10,000" },
] as const;

export const TIME_COMMITMENTS = [
  { value: "under_5h", label: "Under 5 hours / week" },
  { value: "5_15h", label: "5 – 15 hours / week" },
  { value: "15_30h", label: "15 – 30 hours / week" },
  { value: "full_time", label: "Full time" },
] as const;

export const BUSINESS_MODELS = [
  { value: "subscription", label: "Subscription SaaS" },
  { value: "usage_based", label: "Usage-based" },
  { value: "one_time", label: "One-time purchase" },
  { value: "marketplace", label: "Marketplace" },
  { value: "service_software", label: "Service + software" },
  { value: "open", label: "Open to anything" },
] as const;

export const GOALS = [
  { value: "side_income", label: "Side income" },
  { value: "full_time_business", label: "Full-time business" },
  { value: "learn", label: "Learn by building" },
  { value: "venture_scale", label: "Venture-scale company" },
] as const;

const values = <T extends readonly { value: string }[]>(list: T) =>
  list.map((o) => o.value) as unknown as [T[number]["value"], ...T[number]["value"][]];

/** Comma/newline separated list → trimmed unique tags. */
const tagList = (label: string, max = 15) =>
  z
    .array(z.string().trim().min(1).max(60))
    .max(max, `Add at most ${max} ${label}`)
    .transform((arr) => [...new Set(arr)]);

export const onboardingSchema = z.object({
  skills: tagList("skills").refine((a) => a.length > 0, "Add at least one skill"),
  technicalLevel: z.enum(values(TECHNICAL_LEVELS), { error: "Choose your technical level" }),
  interests: tagList("interests").refine((a) => a.length > 0, "Add at least one interest"),
  targetMarkets: tagList("markets"),
  budget: z.enum(values(BUDGETS), { error: "Choose a budget range" }),
  timePerWeek: z.enum(values(TIME_COMMITMENTS), { error: "Choose your available time" }),
  businessModels: z.array(z.enum(values(BUSINESS_MODELS))).min(1, "Pick at least one business model"),
  goals: z.array(z.enum(values(GOALS))).min(1, "Pick at least one goal"),
  notes: z.string().trim().max(1000).optional().default(""),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingAnswers = z.output<typeof onboardingSchema>;

export function parseTags(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
