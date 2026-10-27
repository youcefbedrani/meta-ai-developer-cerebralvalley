import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { ConfigError, getIntegrationEnv } from "@/lib/env";
import { getStripe } from "@/server/billing/stripe";
import { handleStripeEvent } from "@/server/billing/subscriptions";

/** Stripe webhook: verifies the signature, then processes each event at most once. */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(await request.text(), signature, getIntegrationEnv().STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    if (err instanceof ConfigError) return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (err) {
    console.error(`[stripe] failed to process ${event.type} ${event.id}`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
