import { z } from "zod";

const channelType = z.enum(["organic", "paid"]);

const level = z.enum(["low", "medium", "high"]);
const playbookStep = z.object({
  week: z.number().int().min(1).max(8),
  channel: z.string().max(60),
  type: channelType,
  title: z.string().max(140),
  description: z.string().max(600),
  successMetric: z.string().max(200),
});
const positioning = z.object({
  oneLiner: z.string().max(200),
  idealCustomer: z.string().max(400),
  problemInTheirWords: z.string().max(400),
  keyMessage: z.string().max(300),
  uniqueAngle: z.string().max(300),
});
const contentDraft = z.object({
  channel: z.string().max(60),
  format: z.enum(["post", "thread", "comment", "email", "article", "video_script"]),
  title: z.string().max(140),
  body: z.string().max(2000),
});

/** Every ad platform the plan must assess, so founders see the whole landscape (including where NOT to spend). */
export const AD_PLATFORMS = [
  "Google Search",
  "Microsoft Bing",
  "Meta (Facebook & Instagram)",
  "LinkedIn",
  "Reddit",
  "X (Twitter)",
  "TikTok",
  "YouTube",
  "Quora",
  "Pinterest",
  "Newsletter sponsorships",
  "Podcast ads",
] as const;
export const SEARCH_PLATFORMS: readonly string[] = ["Google Search", "Microsoft Bing"];

const marketingPlanV2Schema = z.object({
  positioning,
  audience: z.object({
    segments: z
      .array(
        z.object({
          name: z.string().max(80),
          who: z.string().max(300),
          trigger: z.string().max(300),
          whereTheyHangOut: z.array(z.string().max(120)).max(6),
          howTheySearch: z.array(z.string().max(120)).max(6),
        }),
      )
      .min(1)
      .max(3),
  }),
  angles: z
    .array(
      z.object({
        name: z.string().max(60),
        hook: z.string().max(160),
        whyItResonates: z.string().max(300),
        basis: z.enum(["customer_quote", "research", "hypothesis"]),
        evidence: z.string().max(400),
      }),
    )
    .min(3)
    .max(6),
  organic: z.object({
    summary: z.string().max(600),
    channels: z
      .array(
        z.object({
          name: z.string().max(60),
          priority: z.number().int().min(1).max(6),
          audienceFit: level,
          why: z.string().max(400),
          whereToFind: z.array(z.string().max(120)).max(6),
          effort: level,
          timeToResults: z.enum(["days", "weeks", "months"]),
          strategy: z.string().max(600),
          tactics: z.array(z.string().max(240)).min(2).max(6),
          contentIdeas: z.array(z.string().max(200)).min(2).max(6),
          cadence: z.string().max(160),
          avoid: z.array(z.string().max(200)).max(4),
          kpi: z.string().max(160),
        }),
      )
      .min(2)
      .max(6),
    content: z.array(contentDraft).min(2).max(10),
  }),
  paid: z.object({
    summary: z.string().max(600),
    platforms: z
      .array(
        z.object({
          platform: z.enum(AD_PLATFORMS),
          fit: z.enum(["recommended", "test_later", "skip"]),
          why: z.string().max(400),
          targeting: z.array(z.string().max(160)).max(8),
          keywords: z.array(z.string().max(80)).max(15),
          negativeKeywords: z.array(z.string().max(80)).max(10),
          formats: z.array(z.string().max(60)).max(4),
          ads: z
            .array(
              z.object({
                angle: z.string().max(60),
                headline: z.string().max(90),
                primaryText: z.string().max(500),
                description: z.string().max(150),
                cta: z.string().max(30),
                creative: z.string().max(300),
              }),
            )
            .max(4),
        }),
      )
      .min(6)
      .max(AD_PLATFORMS.length),
    testBudget: z.object({ amountPerDay: z.number().min(0).max(10000), currency: z.string().max(3), durationDays: z.number().int().min(1).max(60), note: z.string().max(300) }),
    testPlan: z.array(z.string().max(300)).min(2).max(6),
    decisionRules: z.array(z.string().max(240)).max(6),
  }),
  playbook: z.array(playbookStep).min(4).max(30),
  primaryMetric: z.string().max(160),
});
type MarketingPlanV2 = z.output<typeof marketingPlanV2Schema>;

/* ----------------------------------------------------------- v3 (Studio) */

export const CHANNEL_ROLES = ["primary", "test", "later"] as const;
const fitFields = {
  /** 1–10, how well the channel fits THIS project; reasons must cite project data. */
  fitScore: z.number().int().min(1).max(10),
  fitReasons: z.array(z.string().max(240)).min(1).max(4),
  /** Rough cost range, always an assumption to test. */
  costRange: z.string().max(120),
  risks: z.array(z.string().max(200)).max(4),
  role: z.enum(CHANNEL_ROLES),
};
const v2 = marketingPlanV2Schema.shape;
const organicChannelV3 = v2.organic.shape.channels.element.extend(fitFields);
const paidPlatformV3 = v2.paid.shape.platforms.element.extend({ ...fitFields, suggestedMonthlyBudget: z.number().min(0).max(1_000_000) });
const playbookStepV3 = playbookStep.extend({ week: z.number().int().min(1).max(8), expectedOutput: z.string().max(240) });

export const marketingPlanSchema = marketingPlanV2Schema.extend({
  organic: v2.organic.extend({ channels: z.array(organicChannelV3).min(2).max(8) }),
  paid: v2.paid.extend({ platforms: z.array(paidPlatformV3).min(6).max(AD_PLATFORMS.length) }),
  playbook: z.array(playbookStepV3).min(6).max(40),
});
export type MarketingPlan = z.output<typeof marketingPlanSchema>;
export const MARKETING_PLAN_SCHEMA_VERSION = 3;

/** Older plans get neutral defaults for the v3 fields. */
function upgradeV2(p: MarketingPlanV2): MarketingPlan {
  const level = { high: 8, medium: 5, low: 3 } as const;
  return {
    ...p,
    organic: {
      ...p.organic,
      channels: p.organic.channels.map((c) => ({ ...c, fitScore: level[c.audienceFit], fitReasons: [c.why || "From the earlier plan."], costRange: "Free (your time)", risks: [], role: c.priority === 1 ? "primary" : "later" })),
    },
    paid: {
      ...p.paid,
      platforms: p.paid.platforms.map((x) => ({ ...x, fitScore: x.fit === "recommended" ? 7 : x.fit === "test_later" ? 4 : 1, fitReasons: [x.why || "From the earlier plan."], costRange: "Unknown, to be tested", risks: [], role: x.fit === "recommended" ? "test" : "later", suggestedMonthlyBudget: 0 })),
    },
    playbook: p.playbook.map((s) => ({ ...s, week: Math.max(1, s.week), expectedOutput: "" })),
  };
}

/** v1 plans (before the detailed organic/paid sections); upgraded on read so old plans still render. */
const marketingPlanV1Schema = z.object({
  positioning,
  channels: z.array(
    z.object({
      name: z.string(),
      type: channelType,
      why: z.string(),
      whereToFind: z.array(z.string()),
      effort: level,
      cost: z.string(),
      priority: z.number(),
    }),
  ),
  playbook: z.array(playbookStep),
  paidAds: z.object({
    platforms: z.array(z.object({ platform: z.string(), audience: z.array(z.string()), adVariants: z.array(z.object({ headline: z.string(), body: z.string(), cta: z.string() })) })),
    testBudget: marketingPlanV2Schema.shape.paid.shape.testBudget,
    decisionRules: z.array(z.string()),
  }),
  organicContent: z.array(contentDraft),
  primaryMetric: z.string(),
});

export type StoredMarketingPlan = { plan: MarketingPlan; legacy: boolean };

/** Parses a stored plan of any schema version; null if it matches none. */
export function parseStoredPlan(content: unknown): StoredMarketingPlan | null {
  const v3 = marketingPlanSchema.safeParse(content);
  if (v3.success) return { plan: v3.data, legacy: false };
  const v2 = marketingPlanV2Schema.safeParse(content);
  if (v2.success) return { plan: upgradeV2(v2.data), legacy: true };
  const v1 = marketingPlanV1Schema.safeParse(content);
  if (!v1.success) return null;
  const old = v1.data;
  const platformName = (name: string) => AD_PLATFORMS.find((p) => p.toLowerCase().startsWith(name.toLowerCase().split(" ")[0])) ?? "Google Search";
  return {
    legacy: true,
    plan: upgradeV2({
      positioning: old.positioning,
      audience: { segments: [{ name: "Ideal customer", who: old.positioning.idealCustomer, trigger: old.positioning.problemInTheirWords, whereTheyHangOut: [], howTheySearch: [] }] },
      angles: [],
      organic: {
        summary: "",
        channels: old.channels
          .filter((c) => c.type === "organic")
          .map((c) => ({ name: c.name, priority: Math.min(6, Math.max(1, c.priority)), audienceFit: "medium", why: c.why, whereToFind: c.whereToFind, effort: c.effort, timeToResults: "weeks", strategy: "", tactics: [], contentIdeas: [], cadence: "", avoid: [], kpi: "" })),
        content: old.organicContent,
      },
      paid: {
        summary: "",
        platforms: old.paidAds.platforms.map((p) => ({
          platform: platformName(p.platform),
          fit: "recommended",
          why: old.channels.find((c) => c.type === "paid" && c.name.toLowerCase().includes(p.platform.toLowerCase().split(" ")[0]))?.why ?? "",
          targeting: p.audience,
          keywords: [],
          negativeKeywords: [],
          formats: [],
          ads: p.adVariants.map((a) => ({ angle: "", headline: a.headline, primaryText: a.body, description: "", cta: a.cta, creative: "" })),
        })),
        testBudget: old.paidAds.testBudget,
        testPlan: [],
        decisionRules: old.paidAds.decisionRules,
      },
      playbook: old.playbook,
      primaryMetric: old.primaryMetric,
    }),
  };
}

/** The channels a founder tracks: every organic channel plus paid platforms worth running. */
export function planChannels(plan: MarketingPlan): { name: string; type: "organic" | "paid" }[] {
  return [
    ...[...plan.organic.channels].sort((a, b) => a.priority - b.priority).map((c) => ({ name: c.name, type: "organic" as const })),
    ...plan.paid.platforms.filter((p) => p.fit !== "skip").map((p) => ({ name: p.platform, type: "paid" as const })),
  ];
}

export const channelResultSchema = z
  .object({
    channel: z.string().trim().min(1, "Pick a channel").max(60),
    channelType: channelType,
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    channelId: z.uuid().nullable().default(null),
    adExperimentId: z.uuid().nullable().default(null),
    adVariantId: z.uuid().nullable().default(null),
    spend: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).max(10_000_000).nullable()).default(null),
    impressions: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable()).default(null),
    clicks: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable()).default(null),
    revenue: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).max(100_000_000).nullable()).default(null),
    visits: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable()).default(null),
    signups: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable()).default(null),
    customers: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable()).default(null),
    notes: z.string().trim().max(1000).default(""),
  })
  .refine((d) => d.periodEnd >= d.periodStart, { message: "End date must be after start date", path: ["periodEnd"] });

export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);

/** UTM source slug for a channel name, e.g. "Reddit communities" → "reddit-communities". */
export function utmSource(channel: string): string {
  return channel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "other";
}

/* ------------------------------------------------------- Go-to-market setup */

export const GTM_GOALS = [
  { value: "first_10_customers", label: "First 10 customers" },
  { value: "100_signups", label: "100 waitlist signups" },
  { value: "first_1k_mrr", label: "First $1k MRR" },
  { value: "custom", label: "Custom goal" },
] as const;

export const gtmSetupSchema = z
  .object({
    monthlyBudget: z.coerce.number().min(0, "Budget can't be negative").max(1_000_000),
    currency: z.string().trim().toUpperCase().length(3).default("USD"),
    hoursPerWeek: z.coerce.number().int().min(1, "At least 1 hour").max(80),
    goal: z.enum(GTM_GOALS.map((g) => g.value) as ["first_10_customers", "100_signups", "first_1k_mrr", "custom"]),
    customGoal: z.string().trim().max(200).default(""),
    skills: z.array(z.string().trim().min(1).max(60)).max(15).default([]),
    geography: z.string().trim().min(2, "Where are your customers?").max(120),
    audienceType: z.enum(["b2b", "b2c", "both"]),
  })
  .refine((d) => d.goal !== "custom" || d.customGoal.length >= 3, { message: "Describe your goal", path: ["customGoal"] });
export type GtmSetup = z.output<typeof gtmSetupSchema>;

export function goalLabel(s: Pick<GtmSetup, "goal" | "customGoal">): string {
  return s.goal === "custom" ? s.customGoal : GTM_GOALS.find((g) => g.value === s.goal)!.label;
}

/* ------------------------------------------------------------ Channels */

export const channelInputSchema = z.object({
  name: z.string().trim().min(2, "Name the channel").max(60),
  type: channelType,
  role: z.enum(CHANNEL_ROLES).default("later"),
  monthlyBudget: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).max(1_000_000).nullable()).default(null),
  currency: z.string().trim().toUpperCase().length(3).default("USD"),
  notes: z.string().trim().max(500).default(""),
});
export const channelUpdateSchema = z.object({
  role: z.enum(CHANNEL_ROLES).optional(),
  status: z.enum(["planned", "active", "paused", "stopped"]).optional(),
  monthlyBudget: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().min(0).max(1_000_000).nullable()).optional(),
  notes: z.string().trim().max(500).optional(),
});

/* ------------------------------------------------------------------ UTM */

const utmPart = z
  .string()
  .trim()
  .toLowerCase()
  .max(60)
  .transform((v) => utmSource(v))
  .pipe(z.string().min(1));

export const utmLinkSchema = z.object({
  landingPageId: z.uuid(),
  source: utmPart,
  medium: utmPart,
  campaign: utmPart,
  content: z.string().trim().max(60).default("").transform((v) => (v ? utmSource(v) : "")),
});

export function buildUtmUrl(base: string, p: { source: string; medium: string; campaign: string; content?: string }): string {
  const url = new URL(base);
  url.searchParams.set("utm_source", p.source);
  url.searchParams.set("utm_medium", p.medium);
  url.searchParams.set("utm_campaign", p.campaign);
  if (p.content) url.searchParams.set("utm_content", p.content);
  return url.toString();
}

/* ------------------------------------------------------------ Ad tests */

export const adVariantInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  angle: z.string().trim().max(60).default(""),
  headline: z.string().trim().min(2, "Add a headline").max(120),
  primaryText: z.string().trim().min(2, "Add the ad text").max(600),
  cta: z.string().trim().min(2).max(30),
  audienceIdea: z.string().trim().max(200).default(""),
  assetId: z.uuid().nullable().default(null),
});

export const adExperimentInputSchema = z.object({
  channelId: z.uuid().nullable().default(null),
  platform: z.string().trim().min(2).max(60),
  name: z.string().trim().min(3, "Name the test").max(80),
  hypothesis: z.string().trim().min(10, "What do you expect to learn?").max(500),
  audience: z.string().trim().min(3, "Who will see the ads?").max(300),
  budgetTotal: z.coerce.number().min(1, "Set a budget").max(1_000_000),
  currency: z.string().trim().toUpperCase().length(3).default("USD"),
  durationDays: z.coerce.number().int().min(1).max(90),
  maxCostPerSignup: z.coerce.number().min(0.01, "Set your maximum cost per signup").max(100_000),
  minClicks: z.coerce.number().int().min(10).max(100_000).default(100),
  variants: z.array(adVariantInputSchema).min(2, "Add at least 2 variants").max(3, "At most 3 variants"),
});
export type AdExperimentInput = z.input<typeof adExperimentInputSchema>;
