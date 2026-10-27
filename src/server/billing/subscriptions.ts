import "server-only";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getEnv } from "@/lib/env";
import { CREDIT_PACKS, type CreditPackId, type PlanId } from "@/lib/plans";
import { getDb, schema, type Database } from "@/server/db/client";
import { handlePaymentSucceeded, openSystemDispute, releaseBlockedPayouts } from "@/server/marketplace/deals";
import { storeConnect } from "@/server/marketplace/payments";
import type { UserId } from "@/server/data/user-id";
import { monthlyAllowance, periodStart } from "./credits";
import { getStripe, planForPrice, priceIdFor } from "./stripe";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const STATUSES = ["trialing", "active", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", "paused"] as const;
type SubStatus = (typeof STATUSES)[number];
/** Stripe may add statuses; anything unknown is stored as "incomplete" and treated as inactive. */
const toStatus = (s: string): SubStatus => ((STATUSES as readonly string[]).includes(s) ? (s as SubStatus) : "incomplete");
const ACTIVE = new Set<SubStatus>(["active", "trialing", "past_due"]);

/** Returns (and creates if needed) the Stripe customer for a user. */
async function ensureCustomer(userId: UserId): Promise<string> {
  const [user] = await getDb().select().from(schema.users).where(eq(schema.users.id, userId));
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await getStripe().customers.create({ email: user.email, name: user.name ?? undefined, metadata: { userId } }, { idempotencyKey: `customer-${userId}` });
  await getDb().update(schema.users).set({ stripeCustomerId: customer.id }).where(eq(schema.users.id, userId));
  return customer.id;
}

export async function createCheckoutSession(userId: UserId, plan: Exclude<PlanId, "free">): Promise<string> {
  const customer = await ensureCustomer(userId);
  const appUrl = getEnv().APP_URL.replace(/\/$/, "");
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [{ price: priceIdFor(plan), quantity: 1 }],
    subscription_data: { metadata: { userId } },
    allow_promotion_codes: true,
    success_url: `${appUrl}/app/settings?billing=success#billing`,
    cancel_url: `${appUrl}/app/settings?billing=cancelled#billing`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** One-time Checkout for a credit pack. Credits are added by the webhook once Stripe reports the payment as paid. */
export async function createCreditPackCheckout(userId: UserId, packId: CreditPackId): Promise<string> {
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error("Unknown credit pack");
  const customer = await ensureCustomer(userId);
  const appUrl = getEnv().APP_URL.replace(/\/$/, "");
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer,
    client_reference_id: userId,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: pack.priceUsd * 100, product_data: { name: `${pack.credits} Startum AI credits`, description: "One-time credit pack. Credits never expire." } } }],
    metadata: { kind: "credits", userId, packId: pack.id, credits: String(pack.credits) },
    success_url: `${appUrl}/app/settings?billing=credits#billing`,
    cancel_url: `${appUrl}/app/settings?billing=cancelled#billing`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** Adds a paid credit pack to the ledger. The pack comes from our catalogue, never from the amount Stripe sends. */
async function addPurchasedCredits(tx: Tx, session: Stripe.Checkout.Session): Promise<"processed" | "ignored"> {
  const pack = CREDIT_PACKS.find((p) => p.id === session.metadata?.packId);
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!pack || !userId || session.payment_status !== "paid" || session.amount_total !== pack.priceUsd * 100) {
    console.warn(`[stripe] credit pack session ${session.id} not applied (pack ${session.metadata?.packId ?? "?"}, status ${session.payment_status})`);
    return "ignored";
  }
  const [user] = await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId));
  if (!user) return "ignored";
  await tx.insert(schema.creditLedger).values({ userId: user.id, delta: pack.credits, reason: "purchase", referenceId: `pack:${session.id}`, note: `Credit pack (${pack.credits} credits)` });
  return "processed";
}

export async function createPortalSession(userId: UserId): Promise<string> {
  const customer = await ensureCustomer(userId);
  const session = await getStripe().billingPortal.sessions.create({ customer, return_url: `${getEnv().APP_URL.replace(/\/$/, "")}/app/settings#billing` });
  return session.url;
}

export async function getSubscription(userId: UserId) {
  const [row] = await getDb().select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
  return row ?? null;
}

async function findUserForSubscription(tx: Tx, sub: Stripe.Subscription): Promise<{ id: string; plan: PlanId } | null> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const [byCustomer] = await tx.select({ id: schema.users.id, plan: schema.users.plan }).from(schema.users).where(eq(schema.users.stripeCustomerId, customerId));
  if (byCustomer) return byCustomer;
  const metaUser = sub.metadata?.userId;
  if (!metaUser) return null;
  const [byMeta] = await tx.select({ id: schema.users.id, plan: schema.users.plan }).from(schema.users).where(eq(schema.users.id, metaUser));
  if (byMeta) await tx.update(schema.users).set({ stripeCustomerId: customerId }).where(eq(schema.users.id, byMeta.id));
  return byMeta ?? null;
}

/** Mirrors a Stripe subscription into our tables and updates the user's plan and credits. */
async function syncSubscription(tx: Tx, sub: Stripe.Subscription, eventId: string): Promise<void> {
  const user = await findUserForSubscription(tx, sub);
  if (!user) {
    console.warn(`[stripe] no user for subscription ${sub.id}`);
    return;
  }
  const item = sub.items.data[0];
  const priceId = item?.price.id ?? "";
  const paidPlan = planForPrice(priceId);
  const status = toStatus(sub.status);
  const isActive = ACTIVE.has(status) && paidPlan !== null;
  const newPlan: PlanId = isActive ? paidPlan : "free";
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;

  const values = {
    userId: user.id,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    plan: paidPlan ?? "founder",
    status,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  } as const;
  await tx.insert(schema.subscriptions).values(values).onConflictDoUpdate({ target: schema.subscriptions.userId, set: values });
  await tx.update(schema.users).set({ plan: newPlan }).where(eq(schema.users.id, user.id));

  // Upgrading mid-month: top up the difference so the new allowance applies now.
  const diff = (await monthlyAllowance(newPlan)) - (await monthlyAllowance(user.plan));
  if (diff > 0) {
    await tx.insert(schema.creditLedger).values({
      userId: user.id,
      delta: diff,
      reason: "adjustment",
      referenceId: `plan-upgrade:${eventId}`,
      note: `Upgrade to ${newPlan} (prorated top-up for ${periodStart().toISOString().slice(0, 7)})`,
    });
  }
}

/**
 * Processes a verified Stripe event exactly once. The event id is recorded in
 * the same transaction as its effects, so a failure rolls back and Stripe retries.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  return getDb().transaction(async (tx) => {
    const inserted = await tx.insert(schema.stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning({ id: schema.stripeEvents.id });
    if (!inserted.length) return "duplicate";

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(tx, event.data.object, event.id);
        return "processed";
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.metadata?.kind === "credits") return addPurchasedCredits(tx, session);
        if (session.metadata?.kind === "marketplace") {
          const pi = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
          let chargeId: string | null = null;
          if (pi) {
            const intent = await getStripe().paymentIntents.retrieve(pi);
            chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : (intent.latest_charge?.id ?? null);
          }
          return handlePaymentSucceeded({ checkoutSessionId: session.id, paymentIntentId: pi, chargeId, amountTotal: session.amount_total });
        }
        const userId = session.client_reference_id;
        const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (userId && customer) await tx.update(schema.users).set({ stripeCustomerId: customer }).where(eq(schema.users.id, userId));
        return "processed";
      }
      case "account.updated": {
        const account = event.data.object;
        const [row] = await tx.select({ userId: schema.connectAccounts.userId }).from(schema.connectAccounts).where(eq(schema.connectAccounts.stripeAccountId, account.id));
        if (!row) return "ignored";
        await storeConnect(row.userId, { stripeAccountId: account.id, detailsSubmitted: !!account.details_submitted, chargesEnabled: !!account.charges_enabled, payoutsEnabled: !!account.payouts_enabled });
        if (account.payouts_enabled) await releaseBlockedPayouts(row.userId);
        return "processed";
      }
      case "charge.dispute.created": {
        const dispute = event.data.object;
        const pi = typeof dispute.payment_intent === "string" ? dispute.payment_intent : (dispute.payment_intent?.id ?? null);
        return pi ? openSystemDispute(pi, `Card dispute opened with Stripe (${dispute.reason})`, dispute.id) : "ignored";
      }
      default:
        return "ignored";
    }
  });
}
