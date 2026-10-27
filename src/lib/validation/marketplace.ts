import { z } from "zod";

export const IN_PLATFORM_ASSETS = ["research_reports", "pain_quotes", "competitors", "experiments", "mvp_plan", "marketing", "landing_page", "waitlist"] as const;
export const EXTERNAL_ASSETS = ["domain", "code_repo", "social_accounts", "stripe_account", "other_external"] as const;
export type InPlatformAsset = (typeof IN_PLATFORM_ASSETS)[number];
export type ExternalAsset = (typeof EXTERNAL_ASSETS)[number];
export type AssetKind = InPlatformAsset | ExternalAsset | "idea";

export const ASSET_LABELS: Record<AssetKind, string> = {
  idea: "Full idea write-up (problem, customer, solution, pricing, risks, first experiment)",
  research_reports: "Research reports + sources",
  pain_quotes: "Customer pain quotes",
  competitors: "Competitor analysis",
  experiments: "Validation experiments + results",
  mvp_plan: "MVP plan & business model",
  marketing: "Marketing plan & assets",
  landing_page: "Hosted landing page + traffic history",
  waitlist: "Waitlist (consented emails only; otherwise counts)",
  domain: "Domain name",
  code_repo: "Code repository",
  social_accounts: "Social media accounts",
  stripe_account: "Stripe / customer accounts",
  other_external: "Other external asset",
};

const cents = z.coerce.number().min(1, "Set a price").max(10_000_000).transform((d) => Math.round(d * 100));

const optionalCents = z.preprocess((v) => (v === "" || v == null ? null : v), cents.nullable()).default(null);
const earning = z.coerce.number().min(0, "Can't be negative").max(10_000_000).transform((d) => Math.round(d * 100));

export const listingInputSchema = z
  .object({
    kind: z.enum(["project", "idea"]).default("project"),
    projectId: z.uuid("Pick a project").nullable().default(null),
    ideaId: z.uuid("Pick an idea").nullable().default(null),
    licenseType: z.enum(["exclusive_transfer", "non_exclusive"]),
    priceType: z.enum(["fixed", "offers"]),
    price: cents,
    minPrice: optionalCents,
    maxPrice: optionalCents,
    currency: z.string().trim().toLowerCase().length(3).default("usd"),
    /** Public. e.g. "Invoicing tools for freelancers". */
    niche: z.string().trim().min(3, "Describe the niche in a few words").max(80, "Keep the niche under 80 characters"),
    /** Seller's estimate of monthly revenue potential, in currency units. Public, labelled as an estimate. */
    earningMin: earning,
    earningMax: earning,
    earningBasis: z.string().trim().min(20, "Explain in a sentence or two how you estimated this").max(600),
    assets: z.array(z.enum([...IN_PLATFORM_ASSETS, ...EXTERNAL_ASSETS])).default([]),
    externalDescriptions: z.record(z.string(), z.string().trim().max(300)).default({}),
    nonCompeteMonths: z.coerce.number().int().min(0).max(60).default(12),
    nonCompeteScope: z.string().trim().max(300).default(""),
  })
  .refine((d) => (d.kind === "project" ? !!d.projectId : !!d.ideaId), { message: "Pick what you're selling", path: ["projectId"] })
  .refine((d) => d.kind === "idea" || d.assets.length > 0, { message: "Include at least one asset", path: ["assets"] })
  .refine((d) => d.earningMin <= d.earningMax, { message: "The low estimate must be at most the high estimate", path: ["earningMin"] })
  .refine((d) => d.earningMax > 0, { message: "Give an estimate of what this could make per month", path: ["earningMax"] })
  .refine((d) => d.minPrice === null || d.maxPrice === null || d.minPrice <= d.maxPrice, { message: "Minimum must be below maximum", path: ["minPrice"] })
  .refine((d) => d.priceType === "fixed" || d.minPrice === null || d.price >= d.minPrice, { message: "Asking price must be at least the minimum", path: ["price"] })
  .refine((d) => d.licenseType === "exclusive_transfer" || !d.assets.some((a) => (EXTERNAL_ASSETS as readonly string[]).includes(a)), {
    message: "External assets (domain, repo, accounts) can only be sold with an exclusive transfer",
    path: ["assets"],
  });
export type ListingInput = z.input<typeof listingInputSchema>;

export const teaserSchema = z.object({
  title: z.string().trim().min(5).max(100),
  problem: z.string().trim().min(10).max(600),
  market: z.string().trim().min(10).max(600),
  solution: z.string().trim().min(10).max(600),
  highlights: z.array(z.string().trim().min(3).max(200)).min(1).max(5),
  idealBuyer: z.string().trim().min(5).max(300),
});
export type Teaser = z.output<typeof teaserSchema>;

export const submitListingSchema = z.object({
  teaser: teaserSchema,
  ownershipConfirmed: z.literal(true, { error: "Confirm that you own these assets" }),
  originalWorkDeclared: z.literal(true, { error: "Declare that this is your original work" }),
});

export const offerInputSchema = z.object({
  amount: cents,
  message: z.string().trim().max(1000).default(""),
});

export const messageSchema = z.object({ body: z.string().trim().min(1, "Write a message").max(4000) });
export const disputeSchema = z.object({ reason: z.string().trim().min(10, "Explain what went wrong").max(2000) });
export const reviewSchema = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(1000).default("") });
export const reportSchema = z.object({ reason: z.string().trim().min(10, "Tell us what's wrong").max(1000) });
export const transferNoteSchema = z.object({ note: z.string().trim().max(500).default("") });

/** Admin edits to a listing's public terms. */
export const adminListingEditSchema = z
  .object({
    niche: z.string().trim().min(3).max(80),
    price: cents,
    earningMin: earning,
    earningMax: earning,
    note: z.string().trim().min(3, "Say why you're changing it (kept in the audit log)").max(500),
  })
  .refine((d) => d.earningMin <= d.earningMax, { message: "The low estimate must be at most the high estimate", path: ["earningMin"] });
