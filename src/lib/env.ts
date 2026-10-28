import "server-only";
import { z } from "zod";

/**
 * Server environment, validated with Zod.
 *
 * - Core settings (database, app URL) fail fast: the first access throws a
 *   descriptive error instead of letting the app limp along.
 * - Integrations (Firebase, AI, search, Stripe, email) are optional at boot so
 *   the app stays runnable while you collect keys. Code that needs one calls
 *   `requireIntegration()`, which throws a `ConfigError` the UI can render.
 */

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const coreSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3100"),
  DATABASE_URL: z.preprocess(
    emptyToUndefined,
    z.string({ error: "DATABASE_URL is required (e.g. postgres://app:app@localhost:5460/app)" }).url(),
  ),
  REDIS_URL: optionalString,
});

const integrationSchema = z.object({
  FIREBASE_ADMIN_PROJECT_ID: optionalString,
  FIREBASE_ADMIN_CLIENT_EMAIL: optionalString,
  FIREBASE_ADMIN_PRIVATE_KEY: optionalString,
  FIREBASE_AUTH_EMULATOR_HOST: optionalString,
  AI_PROVIDER: optionalString,
  AI_API_KEY: optionalString,
  /** Optional: send AI calls to another endpoint (a gateway/proxy) instead of the provider's own API. */
  AI_BASE_URL: optionalString,
  AI_MODEL_FAST: optionalString,
  AI_MODEL_SMART: optionalString,
  /** openai-compatible only: "json_schema" (the gateway enforces the schema) or "prompt" (schema in the prompt). */
  AI_STRUCTURED_OUTPUT: optionalString,
  SEARCH_PROVIDER: optionalString,
  /** MVP design screens: "stitch" (Google Stitch SDK), "builtin" (no key needed) or "mock" (dev/tests only). */
  DESIGN_PROVIDER: optionalString,
  STITCH_API_KEY: optionalString,
  SEARCH_API_KEY: optionalString,
  KEYWORD_PROVIDER: optionalString,
  DATAFORSEO_LOGIN: optionalString,
  DATAFORSEO_PASSWORD: optionalString,
  KEYWORD_LOCATION_CODE: optionalString,
  KEYWORD_LANGUAGE_CODE: optionalString,
  DISCUSSION_SOURCES: optionalString,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRICE_FOUNDER_MONTHLY: optionalString,
  STRIPE_PRICE_STUDIO_MONTHLY: optionalString,
  RESEND_API_KEY: optionalString,
  SENTRY_DSN: optionalString,
});

export type CoreEnv = z.infer<typeof coreSchema>;
export type IntegrationEnv = z.infer<typeof integrationSchema>;

let cachedCore: CoreEnv | undefined;

export function getEnv(source: NodeJS.ProcessEnv = process.env): CoreEnv {
  if (cachedCore && source === process.env) return cachedCore;
  const parsed = coreSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment:\n${details}\nSee .env.example.`);
  }
  if (source === process.env) cachedCore = parsed.data;
  return parsed.data;
}

export function getIntegrationEnv(source: NodeJS.ProcessEnv = process.env): IntegrationEnv {
  return integrationSchema.parse(source);
}

/** Thrown when a feature needs configuration that is missing. Safe to show in the UI. */
export class ConfigError extends Error {
  constructor(
    public readonly integration: IntegrationName,
    public readonly missing: string[],
  ) {
    super(`${INTEGRATIONS[integration].label} is not configured. Missing: ${missing.join(", ")}`);
    this.name = "ConfigError";
  }
}

export const INTEGRATIONS = {
  firebase: {
    label: "Firebase Auth",
    vars: [
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "FIREBASE_ADMIN_PROJECT_ID",
    ],
    // Service-account credentials are not needed when talking to the local emulator.
    productionVars: ["FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_ADMIN_PRIVATE_KEY"],
  },
  redis: { label: "Redis", vars: ["REDIS_URL"], productionVars: [] },
  ai: { label: "AI provider", vars: ["AI_PROVIDER", "AI_API_KEY", "AI_MODEL_FAST", "AI_MODEL_SMART"], productionVars: [] },
  search: { label: "Web search", vars: ["SEARCH_PROVIDER", "SEARCH_API_KEY"], productionVars: [] },
  keywords: { label: "Keyword data", vars: ["KEYWORD_PROVIDER", "DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"], productionVars: [] },
  stripe: { label: "Stripe", vars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_FOUNDER_MONTHLY", "STRIPE_PRICE_STUDIO_MONTHLY"], productionVars: [] },
  email: { label: "Email (Resend)", vars: ["RESEND_API_KEY"], productionVars: [] },
  design: { label: "MVP design (Google Stitch)", vars: ["DESIGN_PROVIDER", "STITCH_API_KEY"], productionVars: [] },
} as const satisfies Record<string, { label: string; vars: readonly string[]; productionVars: readonly string[] }>;

export type IntegrationName = keyof typeof INTEGRATIONS;

export type IntegrationStatus = {
  name: IntegrationName;
  label: string;
  configured: boolean;
  missing: string[];
};

/** Providers that return canned test data. Never allowed in production. */
export const MOCK_PROVIDER = "mock";

const PROVIDER_VAR = { ai: "AI_PROVIDER", search: "SEARCH_PROVIDER", keywords: "KEYWORD_PROVIDER", design: "DESIGN_PROVIDER" } as const;

export function isMockProvider(name: keyof typeof PROVIDER_VAR, source: NodeJS.ProcessEnv = process.env): boolean {
  const value = source[PROVIDER_VAR[name]];
  return value === MOCK_PROVIDER && source.NODE_ENV !== "production";
}

export function getIntegrationStatus(
  name: IntegrationName,
  source: NodeJS.ProcessEnv = process.env,
): IntegrationStatus {
  const def = INTEGRATIONS[name];
  if (name in PROVIDER_VAR) {
    const varName = PROVIDER_VAR[name as keyof typeof PROVIDER_VAR];
    if (source[varName] === MOCK_PROVIDER) {
      return source.NODE_ENV === "production"
        ? { name, label: def.label, configured: false, missing: [`${varName} (mock is not allowed in production)`] }
        : { name, label: `${def.label} (mock)`, configured: true, missing: [] };
    }
  }
  // The built-in designer needs no key.
  if (name === "design" && source.DESIGN_PROVIDER === "builtin") return { name, label: "MVP design (built-in designer)", configured: true, missing: [] };
  const usesEmulator = name === "firebase" && !!emptyToUndefined(source.FIREBASE_AUTH_EMULATOR_HOST);
  const required = [...def.vars, ...(usesEmulator ? [] : def.productionVars)];
  const missing = required.filter((key) => !emptyToUndefined(source[key]));
  return { name, label: def.label, configured: missing.length === 0, missing };
}

export function getAllIntegrationStatuses(source: NodeJS.ProcessEnv = process.env): IntegrationStatus[] {
  return (Object.keys(INTEGRATIONS) as IntegrationName[]).map((n) => getIntegrationStatus(n, source));
}

export function requireIntegration(name: IntegrationName, source: NodeJS.ProcessEnv = process.env): void {
  const status = getIntegrationStatus(name, source);
  if (!status.configured) throw new ConfigError(name, status.missing);
}
