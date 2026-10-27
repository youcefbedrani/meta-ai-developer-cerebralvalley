import "server-only";
import { ConfigError } from "@/lib/env";

/*
 * Marketplace settings, all from the environment:
 *   MARKETPLACE_ENABLED=true            feature flag (off by default)
 *   MARKETPLACE_PAYMENTS=stripe|mock    mock = simulated test-mode payments, never in production
 *   MARKETPLACE_FEE_PERCENT=10          default platform fee (admins can change it in /app/admin/settings)
 *   MARKETPLACE_AUTO_CONFIRM_DAYS=7     default buyer confirmation window (same)
 *   ADMIN_EMAILS=a@x.com,b@y.com        the platform team: the ONLY accounts with admin access
 */

const truthy = (v: string | undefined) => v === "true" || v === "1";

export function isMarketplaceEnabled(source: NodeJS.ProcessEnv = process.env): boolean {
  return truthy(source.MARKETPLACE_ENABLED);
}

export type PaymentsMode = "stripe" | "mock";

export function paymentsMode(source: NodeJS.ProcessEnv = process.env): PaymentsMode {
  const mode = source.MARKETPLACE_PAYMENTS ?? "stripe";
  if (mode === "mock") {
    if (source.NODE_ENV === "production") throw new ConfigError("stripe", ["MARKETPLACE_PAYMENTS (mock is not allowed in production)"]);
    return "mock";
  }
  const missing = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"].filter((k) => !source[k]?.trim());
  if (missing.length) throw new ConfigError("stripe", missing);
  return "stripe";
}

export function adminEmails(source: NodeJS.ProcessEnv = process.env): string[] {
  return (source.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * Admin access is controlled only by the server config (ADMIN_EMAILS), never from inside the app,
 * so no client account can be promoted and a compromised admin session can't create new admins.
 */
export function isAdmin(user: { email: string; role?: string | null }): boolean {
  return adminEmails().includes(user.email.toLowerCase());
}
