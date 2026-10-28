import { z } from "zod";
import { MONTHLY_CREDITS } from "@/lib/plans";

/*
 * Runtime platform settings, edited by admins in /app/admin/settings.
 * Stored as one JSON row; anything missing or invalid falls back to the defaults below,
 * so a fresh install behaves exactly like before the admin console existed.
 */

export const MODULES = [
  { key: "goldMine", label: "Gold Mine", href: "/app/gold-mine" },
  { key: "ideas", label: "Discover Ideas", href: "/app/ideas" },
  { key: "research", label: "Research & Validate", href: "/app/research" },
  { key: "lab", label: "Validation Lab", href: "/app/lab" },
  { key: "marketing", label: "Marketing Studio", href: "/app/marketing" },
  { key: "design", label: "MVP design", href: null },
  { key: "marketplace", label: "Marketplace", href: "/app/marketplace" },
  { key: "resources", label: "Resources", href: "/app/resources" },
  { key: "help", label: "Help assistant", href: null },
  { key: "copilot", label: "AI Copilot", href: "/app/copilot" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
const MODULE_KEYS = MODULES.map((m) => m.key) as [ModuleKey, ...ModuleKey[]];

/** Which module each paid AI operation belongs to (the `note` passed to reserveCredits). */
export const OPERATION_MODULE: Record<string, ModuleKey> = {
  idea_generation: "ideas",
  research_job: "research",
  competitor_scan: "research",
  market_voices: "research",
  full_validation: "research",
  brand_kit: "marketing",
  brand_visuals: "marketing",
  design_screen: "design",
  interview_script: "lab",
  interview_analysis: "lab",
  voice_transcription: "lab",
  voice_pitch: "ideas",
  landing_copy: "lab",
  page_review: "lab",
  business_model: "research",
  mvp_plan: "research",
  autopilot: "research",
  market_expand: "goldMine",
  demand_check: "goldMine",
  pain_mining: "goldMine",
  gold_ideas: "goldMine",
  gold_landing: "goldMine",
  marketing_plan: "marketing",
  marketing_assets: "marketing",
  marketing_recommendation: "marketing",
  marketplace_teaser: "marketplace",
  help_question: "help",
  copilot_message: "copilot",
};

export const SIGNUP_MODES = ["open", "invite_only", "closed"] as const;
export type SignupMode = (typeof SIGNUP_MODES)[number];

const emailList = z.array(z.string().trim().toLowerCase().email()).max(500);
const domainList = z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter a domain like company.com")).max(100);
const credits = z.number().int().min(0).max(1_000_000);
const tokens = z.number().int().min(0).max(1_000_000_000);

/**
 * Fair-use AI limits, on top of credits. Tokens are counted per client per UTC day and month and checked
 * before every AI call, so no single client can use up the platform's AI budget.
 */
export const DEFAULT_AI_LIMITS = {
  dailyTokens: { free: 100_000, founder: 400_000, studio: 800_000 },
  monthlyTokens: { free: 1_000_000, founder: 6_000_000, studio: 12_000_000 },
  /** Longest Copilot reply (output tokens). */
  maxReplyTokens: 1_500,
  /** Platform-wide AI spend per UTC day in USD; 0 = no cap. When reached, AI pauses for everyone until midnight UTC. */
  platformDailyUsd: 25,
};

export const platformSettingsSchema = z.object({
  signups: z.object({
    mode: z.enum(SIGNUP_MODES),
    /** Invite-only: these exact emails may create an account. */
    allowedEmails: emailList,
    /** Invite-only: anyone with an email at these domains may create an account. */
    allowedDomains: domainList,
    /** Shown on the sign-up page while sign-ups are closed or invite-only. */
    message: z.string().trim().max(300),
  }),
  modules: z.record(z.enum(MODULE_KEYS), z.boolean()),
  maintenance: z.object({ enabled: z.boolean(), message: z.string().trim().max(500) }),
  announcement: z.object({ enabled: z.boolean(), message: z.string().trim().max(300), tone: z.enum(["info", "warning"]) }),
  /** Kill switch: blocks every paid AI operation for non-admins. */
  aiPaused: z.boolean(),
  monthlyCredits: z.object({ free: credits, founder: credits, studio: credits }),
  aiLimits: z.object({
    dailyTokens: z.object({ free: tokens, founder: tokens, studio: tokens }),
    monthlyTokens: z.object({ free: tokens, founder: tokens, studio: tokens }),
    maxReplyTokens: z.number().int().min(200).max(16_000),
    platformDailyUsd: z.number().min(0).max(100_000),
  }),
  marketplace: z.object({
    feePercent: z.number().min(0).max(50),
    autoConfirmDays: z.number().int().min(1).max(60),
    /** "auto": listings that pass every automatic check go live at once (near-duplicates still wait for review). "manual": an admin approves every listing. */
    reviewMode: z.enum(["auto", "manual"]),
  }),
});

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

export function defaultSettings(env: NodeJS.ProcessEnv = process.env): PlatformSettings {
  const fee = Number(env.MARKETPLACE_FEE_PERCENT ?? 10);
  const days = Number(env.MARKETPLACE_AUTO_CONFIRM_DAYS ?? 7);
  return {
    signups: { mode: "open", allowedEmails: [], allowedDomains: [], message: "" },
    modules: Object.fromEntries(MODULE_KEYS.map((k) => [k, true])) as Record<ModuleKey, boolean>,
    maintenance: { enabled: false, message: "" },
    announcement: { enabled: false, message: "", tone: "info" },
    aiPaused: false,
    monthlyCredits: { ...MONTHLY_CREDITS },
    aiLimits: { dailyTokens: { ...DEFAULT_AI_LIMITS.dailyTokens }, monthlyTokens: { ...DEFAULT_AI_LIMITS.monthlyTokens }, maxReplyTokens: DEFAULT_AI_LIMITS.maxReplyTokens, platformDailyUsd: DEFAULT_AI_LIMITS.platformDailyUsd },
    marketplace: {
      feePercent: Number.isFinite(fee) && fee >= 0 && fee <= 50 ? fee : 10,
      autoConfirmDays: Number.isInteger(days) && days >= 1 && days <= 60 ? days : 7,
      reviewMode: "auto",
    },
  };
}

/** Merges a stored value over the defaults section by section; an invalid section falls back to its default. */
export function parseSettings(stored: unknown, env: NodeJS.ProcessEnv = process.env): PlatformSettings {
  const base = defaultSettings(env);
  if (!stored || typeof stored !== "object") return base;
  const raw = stored as Record<string, unknown>;
  const shape = platformSettingsSchema.shape;
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(shape) as (keyof PlatformSettings)[]) {
    if (!(key in raw)) continue;
    const value = raw[key];
    const defaults = base[key];
    // Object sections are merged over their defaults, so a newly added field never wipes a saved section.
    const candidate = value && typeof value === "object" && !Array.isArray(value) && typeof defaults === "object" ? { ...defaults, ...value } : value;
    const parsed = (shape[key] as z.ZodType).safeParse(candidate);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as PlatformSettings;
}

export type SignupDecision = { allowed: true } | { allowed: false; reason: string };

/** Whether a brand-new account with this email may be created under the current sign-up settings. */
export function signupDecision(settings: PlatformSettings["signups"], email: string): SignupDecision {
  if (settings.mode === "open") return { allowed: true };
  const custom = settings.message.trim();
  if (settings.mode === "closed") return { allowed: false, reason: custom || "Sign-ups are closed right now. Please check back later." };
  const lower = email.trim().toLowerCase();
  const domain = lower.split("@")[1] ?? "";
  if (settings.allowedEmails.includes(lower) || settings.allowedDomains.includes(domain)) return { allowed: true };
  return { allowed: false, reason: custom || "Startum is invite-only right now. This email isn't on the invite list." };
}

export function isModuleOn(settings: PlatformSettings, key: ModuleKey): boolean {
  return settings.modules[key] !== false;
}
