/**
 * Plan catalogue (prices in USD per month). The amount actually charged comes from the
 * Stripe prices in STRIPE_PRICE_FOUNDER_MONTHLY / STRIPE_PRICE_STUDIO_MONTHLY, so keep them in sync.
 * Every plan has every feature; plans differ in how many AI credits they include.
 */
export const PLANS = [
  {
    id: "free",
    name: "Free",
    tag: "Start here",
    priceMonthly: 0,
    description: "Validate your first idea end to end and see the evidence for yourself.",
    features: ["75 AI credits every month", "Enough for one full validation with a verdict", "Real quotes from Reddit, Quora, YouTube & more", "Competitors with sourced prices", "Shareable report link"],
    excluded: [],
    cta: "Get started free",
  },
  {
    id: "founder",
    name: "Founder",
    tag: "For solo founders",
    priceMonthly: 49,
    highlighted: true,
    description: "For founders validating ideas every week and getting ready to launch.",
    features: [
      "1,500 AI credits every month",
      "About 30 full validations a month",
      "Brand Kit: names, logo, colours & fonts",
      "Landing pages with real waitlists",
      "MVP plan, business model & marketing plan",
      "Buy extra credit packs any time",
    ],
    excluded: [],
    cta: "Start as Founder",
  },
  {
    id: "studio",
    name: "Studio",
    tag: "For studios & small teams",
    priceMonthly: 69,
    description: "For builders running several ideas in parallel.",
    features: ["2,500 AI credits every month", "About 50 full validations a month", "Everything in Founder", "Lowest price per credit"],
    excluded: [],
    cta: "Choose Studio",
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

/** AI credits granted at the start of each calendar month (UTC). Unused credits expire at month end. */
export const MONTHLY_CREDITS: Record<PlanId, number> = {
  free: 75,
  founder: 1500,
  studio: 2500,
};

/** One-time credit packs. Purchased credits never expire (see billing/credits.ts); prices in USD. */
export const CREDIT_PACKS = [
  { id: "pack_300", credits: 300, priceUsd: 15, label: "Top-up" },
  { id: "pack_1000", credits: 1000, priceUsd: 39, label: "Best value" },
] as const;
export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];

/** Credit price of each AI operation. Reserved up front, refunded if the operation fails. */
export const CREDIT_COSTS = {
  idea_generation: 5,
  research_job: 25,
  competitor_scan: 15,
  market_voices: 20,
  /** Research + competitor scan + market voices in one run, cheaper than the three separately (60). */
  full_validation: 50,
  brand_kit: 8,
  /** Brand visuals: a logo (with cut-out), a landing hero and three ad creatives. */
  brand_visuals: 10,
  /** One MVP design screen (or one edit) with Muse Spark or Google Stitch. Stitch quota is shared by all users of one API key. */
  design_screen: 4,
  /** The approved prototype turned into a runnable Next.js codebase (data model + one page per screen, Muse Spark). */
  codebase: 20,
  /** Muse Spark changes the generated code on request (then type-checks and fixes it). */
  codebase_edit: 5,
  /** Muse Spark fixes the problems the type-check found (e.g. after your own edits). */
  codebase_fix: 3,
  /** A launch video for organic social: storyboard + posts (Muse Spark), 3–6 scenes (Muse Image), rendered MP4. */
  launch_video: 12,
  interview_script: 2,
  interview_analysis: 3,
  /** Interview recordings: per started 5 minutes of audio (Meta Muse Voice Transcribe). */
  voice_transcription: 1,
  /** A spoken idea pitch turned into a project. */
  voice_pitch: 2,
  landing_copy: 3,
  /** Screenshot review of a landing page or a competitor's page (Muse Spark vision). */
  page_review: 3,
  business_model: 5,
  mvp_plan: 8,
  /** Launch playbook: stages with gates, sales playbook, SaaS metrics, retention and build sprints. */
  launch_playbook: 10,
  /** Validation Autopilot: the agent's own reasoning. The tools it runs (research, plans…) charge their own price. */
  autopilot: 6,
  // Gold Mine
  market_expand: 1,
  demand_check: 10,
  pain_mining: 30,
  gold_ideas: 8,
  gold_landing: 5,
  // Marketing Studio
  marketing_plan: 10,
  marketing_assets: 3,
  marketing_recommendation: 2,
  // Marketplace
  marketplace_teaser: 3,
  // Help assistant
  help_question: 1,
  // AI Copilot (answers served from the cache are free)
  copilot_message: 1,
} as const;

export type CreditOperation = keyof typeof CREDIT_COSTS;
