import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getEnv } from "@/lib/env";
import { getStripe } from "@/server/billing/stripe";
import { getDb, schema } from "@/server/db/client";
import { paymentsMode } from "./config";

/*
 * Marketplace payments: Stripe Connect (Express) with separate charges and
 * transfers. The platform charges the buyer, holds the funds, and transfers
 * the seller's share after the buyer confirms. "mock" mode simulates all of
 * this for development and tests (clearly labelled, refused in production).
 */

export type ConnectStatus = { stripeAccountId: string; detailsSubmitted: boolean; chargesEnabled: boolean; payoutsEnabled: boolean };

export interface MarketplacePayments {
  mode: "stripe" | "mock";
  /** URL to send the seller to for onboarding/KYC. */
  connectOnboardingUrl(user: { id: string; email: string }): Promise<string>;
  /** Re-reads the account from Stripe and stores its status. */
  syncConnectAccount(userId: string): Promise<ConnectStatus | null>;
  createCheckout(input: { dealId: string; title: string; amountCents: number; currency: string; buyerEmail: string }): Promise<{ sessionId: string; url: string }>;
  refund(payment: { paymentIntentId: string | null; checkoutSessionId: string }): Promise<{ refundId: string }>;
  transfer(input: { dealId: string; amountCents: number; currency: string; destination: string; chargeId: string | null }): Promise<{ transferId: string }>;
}

const appUrl = () => getEnv().APP_URL.replace(/\/$/, "");

async function storeConnect(userId: string, status: ConnectStatus): Promise<ConnectStatus> {
  await getDb()
    .insert(schema.connectAccounts)
    .values({ userId, ...status })
    .onConflictDoUpdate({ target: schema.connectAccounts.userId, set: { stripeAccountId: status.stripeAccountId, detailsSubmitted: status.detailsSubmitted, chargesEnabled: status.chargesEnabled, payoutsEnabled: status.payoutsEnabled } });
  return status;
}

export async function getConnectAccount(userId: string) {
  const [row] = await getDb().select().from(schema.connectAccounts).where(eq(schema.connectAccounts.userId, userId)).limit(1);
  return row ?? null;
}

const stripePayments: MarketplacePayments = {
  mode: "stripe",
  async connectOnboardingUrl(user) {
    const stripe = getStripe();
    let account = await getConnectAccount(user.id);
    if (!account) {
      const created = await stripe.accounts.create({ type: "express", email: user.email, metadata: { userId: user.id }, capabilities: { transfers: { requested: true } } });
      await storeConnect(user.id, { stripeAccountId: created.id, detailsSubmitted: false, chargesEnabled: false, payoutsEnabled: false });
      account = await getConnectAccount(user.id);
    }
    const link = await stripe.accountLinks.create({
      account: account!.stripeAccountId,
      type: "account_onboarding",
      refresh_url: `${appUrl()}/app/marketplace/payouts?connect=refresh`,
      return_url: `${appUrl()}/app/marketplace/payouts?connect=return`,
    });
    return link.url;
  },
  async syncConnectAccount(userId) {
    const account = await getConnectAccount(userId);
    if (!account) return null;
    const a = await getStripe().accounts.retrieve(account.stripeAccountId);
    return storeConnect(userId, { stripeAccountId: a.id, detailsSubmitted: !!a.details_submitted, chargesEnabled: !!a.charges_enabled, payoutsEnabled: !!a.payouts_enabled });
  },
  async createCheckout({ dealId, title, amountCents, currency, buyerEmail }) {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: buyerEmail,
      line_items: [{ quantity: 1, price_data: { currency, unit_amount: amountCents, product_data: { name: `Project package: ${title}`.slice(0, 250) } } }],
      payment_intent_data: { transfer_group: `deal_${dealId}`, metadata: { kind: "marketplace", dealId } },
      metadata: { kind: "marketplace", dealId },
      success_url: `${appUrl()}/app/marketplace/deals/${dealId}?paid=1`,
      cancel_url: `${appUrl()}/app/marketplace/deals/${dealId}`,
    });
    return { sessionId: session.id, url: session.url! };
  },
  async refund({ paymentIntentId }) {
    if (!paymentIntentId) throw new Error("Payment has no payment intent to refund");
    const r = await getStripe().refunds.create({ payment_intent: paymentIntentId, metadata: { kind: "marketplace" } }, { idempotencyKey: `refund-${paymentIntentId}` });
    return { refundId: r.id };
  },
  async transfer({ dealId, amountCents, currency, destination, chargeId }) {
    const t = await getStripe().transfers.create(
      { amount: amountCents, currency, destination, transfer_group: `deal_${dealId}`, ...(chargeId ? { source_transaction: chargeId } : {}), metadata: { kind: "marketplace", dealId } },
      { idempotencyKey: `payout-${dealId}` },
    );
    return { transferId: t.id };
  },
};

/** Test-mode simulation: no money moves. Checkout and onboarding go to in-app mock pages. */
const mockPayments: MarketplacePayments = {
  mode: "mock",
  async connectOnboardingUrl() {
    return "/app/marketplace/payouts/mock-onboarding";
  },
  async syncConnectAccount(userId) {
    const a = await getConnectAccount(userId);
    return a ? { stripeAccountId: a.stripeAccountId, detailsSubmitted: a.detailsSubmitted, chargesEnabled: a.chargesEnabled, payoutsEnabled: a.payoutsEnabled } : null;
  },
  async createCheckout({ dealId }) {
    const sessionId = `mock_cs_${randomUUID()}`;
    return { sessionId, url: `/app/marketplace/deals/${dealId}/mock-checkout?session=${sessionId}` };
  },
  async refund() {
    return { refundId: `mock_re_${randomUUID()}` };
  },
  async transfer() {
    return { transferId: `mock_tr_${randomUUID()}` };
  },
};

/** Completes mock onboarding (test mode only). */
export async function completeMockOnboarding(userId: string) {
  if (paymentsMode() !== "mock") throw new Error("Mock onboarding is only available in test mode");
  return storeConnect(userId, { stripeAccountId: `mock_acct_${userId.slice(0, 8)}`, detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true });
}

export function getPayments(): MarketplacePayments {
  return paymentsMode() === "mock" ? mockPayments : stripePayments;
}

export { storeConnect };
