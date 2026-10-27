import "server-only";
import Stripe from "stripe";
import { getIntegrationEnv, requireIntegration } from "@/lib/env";
import type { PlanId } from "@/lib/plans";

const g = globalThis as unknown as { __stripe?: Stripe };

export function getStripe(): Stripe {
  requireIntegration("stripe");
  g.__stripe ??= new Stripe(getIntegrationEnv().STRIPE_SECRET_KEY!, { maxNetworkRetries: 2, timeout: 20_000 });
  return g.__stripe;
}

/** Paid plans and their Stripe price ids (configured via env). */
export function priceIdFor(plan: Exclude<PlanId, "free">): string {
  const env = getIntegrationEnv();
  return (plan === "founder" ? env.STRIPE_PRICE_FOUNDER_MONTHLY : env.STRIPE_PRICE_STUDIO_MONTHLY)!;
}

export function planForPrice(priceId: string | null | undefined, source: NodeJS.ProcessEnv = process.env): Exclude<PlanId, "free"> | null {
  if (!priceId) return null;
  if (priceId === source.STRIPE_PRICE_FOUNDER_MONTHLY) return "founder";
  if (priceId === source.STRIPE_PRICE_STUDIO_MONTHLY) return "studio";
  return null;
}
