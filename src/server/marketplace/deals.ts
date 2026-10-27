import "server-only";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, lt, ne, notInArray, or } from "drizzle-orm";
import { z } from "zod";
import { canTransition, TERMINAL_STATES, type DealActor, type DealState, type TransitionContext } from "@/lib/marketplace/deal-machine";
import { AGREEMENT_TEMPLATE_VERSION, formatMoney, platformFee, renderAgreement } from "@/lib/marketplace/terms";
import { ASSET_LABELS, disputeSchema, EXTERNAL_ASSETS, IN_PLATFORM_ASSETS, messageSchema, offerInputSchema, reviewSchema, type InPlatformAsset } from "@/lib/validation/marketplace";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError, UserFacingError } from "@/server/data/errors";
import { audit, hasSignedNda } from "@/server/data/marketplace";
import type { UserId } from "@/server/data/user-id";
import { getPlatformSettings } from "@/server/platform/settings";
import { getConnectAccount, getPayments } from "./payments";
import { cloneIdea, cloneProjectPackage, moveIdeaOwnership, moveProjectOwnership } from "./transfer";

/*
 * Deals: negotiation, agreement, escrowed payment, transfer, payout and
 * disputes. Every state change goes through `transition`, which checks the
 * state machine, locks the row, and writes the audit log in one transaction.
 */

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
export type Deal = typeof schema.deals.$inferSelect;
type Actor = { id: string | null; role: DealActor };
const isUuid = (id: string) => z.uuid().safeParse(id).success;

async function assertNotBanned(userId: string) {
  const [u] = await getDb().select({ banned: schema.users.marketplaceBannedAt }).from(schema.users).where(eq(schema.users.id, userId));
  if (u?.banned) throw new UserFacingError("Your marketplace access has been suspended. Contact support.");
}

/** Moves a deal to `to` if the state machine allows it. Optional `effects` run in the same transaction. */
export async function transition(
  dealId: string,
  to: DealState,
  actor: Actor,
  opts: { context?: (deal: Deal, tx: Tx) => Promise<TransitionContext>; set?: Partial<typeof schema.deals.$inferInsert>; effects?: (deal: Deal, tx: Tx) => Promise<void>; data?: Record<string, unknown> } = {},
): Promise<Deal> {
  return getDb().transaction(async (tx) => {
    const [deal] = await tx.select().from(schema.deals).where(eq(schema.deals.id, dealId)).for("update");
    if (!deal) throw new NotFoundError("Deal");
    const ctx = opts.context ? await opts.context(deal, tx) : {};
    const check = canTransition(deal.state, to, actor.role, ctx);
    if (!check.ok) throw new UserFacingError(check.reason);
    const [updated] = await tx
      .update(schema.deals)
      .set({ ...opts.set, state: to, stateBeforeDispute: to === "DISPUTED" ? deal.state : opts.set?.stateBeforeDispute })
      .where(eq(schema.deals.id, dealId))
      .returning();
    await audit({ dealId, listingId: deal.listingId, actorId: actor.id, actorRole: actor.role, action: "deal_transition", fromState: deal.state, toState: to, data: opts.data }, tx);
    if (opts.effects) await opts.effects(updated, tx);
    return updated;
  });
}

function roleIn(deal: Pick<Deal, "buyerId" | "sellerId">, userId: string): "buyer" | "seller" | null {
  return deal.buyerId === userId ? "buyer" : deal.sellerId === userId ? "seller" : null;
}

async function requireParty(userId: string, dealId: string) {
  if (!isUuid(dealId)) throw new NotFoundError("Deal");
  const [deal] = await getDb().select().from(schema.deals).where(and(eq(schema.deals.id, dealId), or(eq(schema.deals.buyerId, userId), eq(schema.deals.sellerId, userId)))).limit(1);
  if (!deal) throw new NotFoundError("Deal");
  return { deal, role: roleIn(deal, userId)! };
}

async function requireListingForDeal(listingId: string) {
  const [listing] = await getDb().select().from(schema.listings).where(eq(schema.listings.id, listingId)).limit(1);
  if (!listing) throw new NotFoundError("Listing");
  return listing;
}

/* ---------------------------------------------------------- Negotiation */

function checkAmount(listing: typeof schema.listings.$inferSelect, cents: number) {
  if (listing.priceType === "fixed" && cents !== listing.priceCents) throw new UserFacingError(`This listing has a fixed price of ${formatMoney(listing.priceCents, listing.currency)}.`);
  if (listing.minPriceCents !== null && cents < listing.minPriceCents) throw new UserFacingError(`Offers start at ${formatMoney(listing.minPriceCents, listing.currency)}.`);
  if (listing.maxPriceCents !== null && cents > listing.maxPriceCents) throw new UserFacingError(`Offers are capped at ${formatMoney(listing.maxPriceCents, listing.currency)}.`);
}

/** Buyer makes an offer (or opens a fixed-price purchase). Requires a signed NDA. */
export async function makeOffer(buyerId: UserId, listingId: string, input: unknown): Promise<Deal> {
  await assertNotBanned(buyerId);
  const d = offerInputSchema.parse(input);
  if (!isUuid(listingId)) throw new NotFoundError("Listing");
  const listing = await requireListingForDeal(listingId);
  if (listing.status !== "published") throw new NotFoundError("Listing");
  if (listing.sellerId === buyerId) throw new UserFacingError("You can't buy your own listing.");
  if (!(await hasSignedNda(buyerId, listingId))) throw new UserFacingError("Accept the NDA first.");
  checkAmount(listing, d.amount);

  const [existing] = await getDb()
    .select()
    .from(schema.deals)
    .where(and(eq(schema.deals.listingId, listingId), eq(schema.deals.buyerId, buyerId), notInArray(schema.deals.state, TERMINAL_STATES)))
    .limit(1);
  if (existing && existing.state !== "DRAFT_OFFER") throw new UserFacingError("You already have a deal in progress for this listing.");

  const deal = await getDb().transaction(async (tx) => {
    const deal = existing ?? (await tx.insert(schema.deals).values({ listingId, sellerId: listing.sellerId, buyerId, licenseType: listing.licenseType, currency: listing.currency }).returning())[0];
    await tx.update(schema.offers).set({ status: "countered" }).where(and(eq(schema.offers.dealId, deal.id), eq(schema.offers.status, "pending")));
    await tx.insert(schema.offers).values({ dealId: deal.id, fromUserId: buyerId, amountCents: d.amount, message: d.message || null });
    await audit({ dealId: deal.id, listingId, actorId: buyerId, actorRole: "buyer", action: existing ? "offer_made" : "deal_opened", toState: "DRAFT_OFFER", data: { amountCents: d.amount } }, tx);
    return deal;
  });
  return deal;
}

/** Fixed-price "buy now": an offer at the asking price, accepted straight away. */
export async function buyNow(buyerId: UserId, listingId: string): Promise<Deal> {
  const listing = await requireListingForDeal(listingId);
  if (listing.priceType !== "fixed") throw new UserFacingError("This listing accepts offers. Make an offer instead.");
  const deal = await makeOffer(buyerId, listingId, { amount: listing.priceCents / 100 });
  return acceptLatestOffer(buyerId, deal.id, { assumeAskingPrice: true });
}

export async function counterOffer(userId: UserId, dealId: string, input: unknown): Promise<void> {
  const { deal, role } = await requireParty(userId, dealId);
  if (deal.state !== "DRAFT_OFFER") throw new UserFacingError("This deal is no longer in negotiation.");
  const d = offerInputSchema.parse(input);
  checkAmount(await requireListingForDeal(deal.listingId), d.amount);
  await getDb().transaction(async (tx) => {
    await tx.update(schema.offers).set({ status: "countered" }).where(and(eq(schema.offers.dealId, deal.id), eq(schema.offers.status, "pending")));
    await tx.insert(schema.offers).values({ dealId: deal.id, fromUserId: userId, amountCents: d.amount, message: d.message || null });
    await audit({ dealId: deal.id, listingId: deal.listingId, actorId: userId, actorRole: role, action: "counter_offer", data: { amountCents: d.amount } }, tx);
  });
}

export async function rejectLatestOffer(userId: UserId, dealId: string): Promise<void> {
  const { deal, role } = await requireParty(userId, dealId);
  const [offer] = await getDb().select().from(schema.offers).where(and(eq(schema.offers.dealId, deal.id), eq(schema.offers.status, "pending"))).limit(1);
  if (!offer) throw new UserFacingError("There's no open offer.");
  await getDb().update(schema.offers).set({ status: offer.fromUserId === userId ? "withdrawn" : "rejected" }).where(eq(schema.offers.id, offer.id));
  await audit({ dealId: deal.id, listingId: deal.listingId, actorId: userId, actorRole: role, action: offer.fromUserId === userId ? "offer_withdrawn" : "offer_rejected" });
}

/** The party receiving the latest offer accepts it: price is fixed, agreement + transfer checklist are created. */
export async function acceptLatestOffer(userId: UserId, dealId: string, opts: { assumeAskingPrice?: boolean } = {}): Promise<Deal> {
  const { deal, role } = await requireParty(userId, dealId);
  const listing = await requireListingForDeal(deal.listingId);
  if (listing.status !== "published") throw new UserFacingError("This listing is no longer available.");
  const [offer] = await getDb().select().from(schema.offers).where(and(eq(schema.offers.dealId, deal.id), eq(schema.offers.status, "pending"))).orderBy(desc(schema.offers.createdAt)).limit(1);
  if (!offer) throw new UserFacingError("There's no open offer to accept.");
  // You accept the other side's offer, except a buyer taking the fixed asking price.
  if (offer.fromUserId === userId && !(opts.assumeAskingPrice && listing.priceType === "fixed" && offer.amountCents === listing.priceCents)) throw new UserFacingError("Wait for the other party to respond to your offer.");
  if (listing.licenseType === "exclusive_transfer") {
    const [other] = await getDb()
      .select({ id: schema.deals.id })
      .from(schema.deals)
      .where(and(eq(schema.deals.listingId, listing.id), ne(schema.deals.id, deal.id), inArray(schema.deals.state, ["ACCEPTED", "PAYMENT_HELD", "TRANSFER_IN_PROGRESS", "BUYER_CONFIRMED", "DISPUTED"])))
      .limit(1);
    if (other) throw new UserFacingError("Another buyer's deal for this exclusive listing is already in progress.");
  }
  const { feePercent } = (await getPlatformSettings()).marketplace;
  const assets = await getDb().select().from(schema.listingAssets).where(eq(schema.listingAssets.listingId, listing.id));
  const [seller, buyer] = await Promise.all([deal.sellerId, deal.buyerId].map(async (id) => (await getDb().select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, id)))[0]));

  return transition(deal.id, "ACCEPTED", { id: userId, role }, {
    set: { amountCents: offer.amountCents, platformFeeCents: platformFee(offer.amountCents, feePercent) },
    data: { offerId: offer.id, amountCents: offer.amountCents },
    effects: async (d, tx) => {
      await tx.update(schema.offers).set({ status: "accepted" }).where(eq(schema.offers.id, offer.id));
      const body = renderAgreement({
        sellerName: seller.name ?? seller.email,
        buyerName: buyer.name ?? buyer.email,
        listingTitle: listing.title,
        licenseType: listing.licenseType,
        priceFormatted: formatMoney(offer.amountCents, listing.currency),
        assets: assets.map((a) => `${ASSET_LABELS[a.kind]}${a.description ? `: ${a.description}` : ""}`),
        nonCompeteMonths: listing.nonCompeteMonths,
        nonCompeteScope: listing.nonCompeteScope,
        date: new Date().toISOString().slice(0, 10),
        dealId: d.id,
      });
      await tx.insert(schema.agreements).values({ dealId: d.id, templateVersion: AGREEMENT_TEMPLATE_VERSION, body, hash: createHash("sha256").update(body).digest("hex") });
      const inPlatform = assets.filter((a) => (IN_PLATFORM_ASSETS as readonly string[]).includes(a.kind));
      const external = assets.filter((a) => (EXTERNAL_ASSETS as readonly string[]).includes(a.kind));
      await tx.insert(schema.dealTransferItems).values([
        listing.kind === "idea"
          ? { dealId: d.id, kind: "idea" as const, label: listing.licenseType === "exclusive_transfer" ? "The idea moves to your account" : "A copy of the idea is added to your account", inPlatform: true }
          : { dealId: d.id, kind: inPlatform[0]?.kind ?? "research_reports", label: listing.licenseType === "exclusive_transfer" ? "Project moves to your account (all in-platform assets)" : `Copy of: ${inPlatform.map((a) => ASSET_LABELS[a.kind]).join(", ")}`, inPlatform: true },
        ...external.map((a) => ({ dealId: d.id, kind: a.kind, label: ASSET_LABELS[a.kind], description: a.description, inPlatform: false })),
      ]);
    },
  });
}

export async function cancelDeal(userId: UserId, dealId: string): Promise<Deal> {
  const { deal, role } = await requireParty(userId, dealId);
  if (deal.state === "PAYMENT_HELD" || deal.state === "TRANSFER_IN_PROGRESS") {
    // After payment, only the seller can cancel, which refunds the buyer.
    if (role !== "seller") throw new UserFacingError("Payment is held. Open a dispute if something is wrong.");
    return refundDeal(deal.id, { id: userId, role: "seller" }, "Seller cancelled the transfer.");
  }
  return transition(deal.id, "CANCELLED", { id: userId, role });
}

/* ------------------------------------------------------------ Agreement */

export async function acceptAgreement(userId: UserId, dealId: string, hash: string, ip: string | null) {
  const { deal, role } = await requireParty(userId, dealId);
  if (deal.state !== "ACCEPTED") throw new UserFacingError("The agreement can only be accepted before payment.");
  const [agreement] = await getDb().select().from(schema.agreements).where(eq(schema.agreements.dealId, deal.id));
  if (!agreement) throw new NotFoundError("Agreement");
  if (agreement.hash !== hash) throw new UserFacingError("The agreement changed. Reload and review it again.");
  await getDb()
    .update(schema.agreements)
    .set(role === "seller" ? { sellerAcceptedAt: new Date(), sellerIp: ip } : { buyerAcceptedAt: new Date(), buyerIp: ip })
    .where(eq(schema.agreements.id, agreement.id));
  await audit({ dealId: deal.id, listingId: deal.listingId, actorId: userId, actorRole: role, action: "agreement_accepted", data: { hash } });
}

async function agreementSigned(tx: Pick<ReturnType<typeof getDb>, "select">, dealId: string) {
  const [a] = await tx.select().from(schema.agreements).where(eq(schema.agreements.dealId, dealId));
  return !!a?.sellerAcceptedAt && !!a?.buyerAcceptedAt;
}

/* -------------------------------------------------------------- Payment */

export async function startCheckout(buyerId: UserId, dealId: string): Promise<{ url: string }> {
  const { deal, role } = await requireParty(buyerId, dealId);
  if (role !== "buyer") throw new UserFacingError("Only the buyer pays.");
  if (deal.state !== "ACCEPTED") throw new UserFacingError("This deal isn't ready for payment.");
  if (!(await agreementSigned(getDb(), deal.id))) throw new UserFacingError("Both parties must accept the transfer agreement before payment.");
  const listing = await requireListingForDeal(deal.listingId);
  const [buyer] = await getDb().select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, buyerId));
  const session = await getPayments().createCheckout({ dealId: deal.id, title: listing.title, amountCents: deal.amountCents!, currency: deal.currency, buyerEmail: buyer.email });
  await getDb().insert(schema.marketplacePayments).values({ dealId: deal.id, checkoutSessionId: session.sessionId, amountCents: deal.amountCents!, feeCents: deal.platformFeeCents ?? 0, currency: deal.currency });
  return { url: session.url };
}

/**
 * Payment confirmed (Stripe webhook or mock checkout). Idempotent: a repeated
 * event for the same checkout session changes nothing.
 */
export async function handlePaymentSucceeded(p: { checkoutSessionId: string; paymentIntentId: string | null; chargeId: string | null; amountTotal?: number | null }): Promise<"processed" | "duplicate" | "ignored"> {
  const [payment] = await getDb().select().from(schema.marketplacePayments).where(eq(schema.marketplacePayments.checkoutSessionId, p.checkoutSessionId)).limit(1);
  if (!payment) return "ignored";
  if (payment.status !== "pending") return "duplicate";
  if (p.amountTotal != null && p.amountTotal !== payment.amountCents) {
    await getDb().update(schema.marketplacePayments).set({ status: "failed" }).where(eq(schema.marketplacePayments.id, payment.id));
    await audit({ dealId: payment.dealId, actorRole: "system", action: "payment_amount_mismatch", data: { expected: payment.amountCents, got: p.amountTotal } });
    return "ignored";
  }
  await transition(payment.dealId, "PAYMENT_HELD", { id: null, role: "system" }, {
    context: async (_d, tx) => ({ agreementSigned: await agreementSigned(tx, payment.dealId) }),
    data: { checkoutSessionId: p.checkoutSessionId },
    effects: async (_d, tx) => {
      const [updated] = await tx
        .update(schema.marketplacePayments)
        .set({ status: "succeeded", paymentIntentId: p.paymentIntentId, chargeId: p.chargeId })
        .where(and(eq(schema.marketplacePayments.id, payment.id), eq(schema.marketplacePayments.status, "pending")))
        .returning({ id: schema.marketplacePayments.id });
      if (!updated) throw new UserFacingError("Payment already processed");
    },
  });
  return "processed";
}

async function succeededPayment(dealId: string) {
  const [p] = await getDb().select().from(schema.marketplacePayments).where(and(eq(schema.marketplacePayments.dealId, dealId), eq(schema.marketplacePayments.status, "succeeded"))).limit(1);
  return p ?? null;
}

export async function refundDeal(dealId: string, actor: Actor, reason: string): Promise<Deal> {
  const payment = await succeededPayment(dealId);
  return transition(dealId, "REFUNDED", actor, {
    data: { reason },
    effects: async (_d, tx) => {
      if (!payment) return;
      const { refundId } = await getPayments().refund(payment);
      await tx.update(schema.marketplacePayments).set({ status: "refunded", refundId }).where(eq(schema.marketplacePayments.id, payment.id));
    },
  });
}

/* ------------------------------------------------------------- Transfer */

export async function startTransfer(sellerId: UserId, dealId: string): Promise<Deal> {
  const { deal, role } = await requireParty(sellerId, dealId);
  if (role !== "seller") throw new UserFacingError("Only the seller starts the transfer.");
  const days = (await getPlatformSettings()).marketplace.autoConfirmDays;
  return transition(deal.id, "TRANSFER_IN_PROGRESS", { id: sellerId, role }, { set: { autoConfirmAt: new Date(Date.now() + days * 86_400_000) } });
}

export async function markTransferItem(userId: UserId, itemId: string, done: boolean, note: string) {
  if (!isUuid(itemId)) throw new NotFoundError("Transfer item");
  const [row] = await getDb().select({ item: schema.dealTransferItems, deal: schema.deals }).from(schema.dealTransferItems).innerJoin(schema.deals, eq(schema.deals.id, schema.dealTransferItems.dealId)).where(eq(schema.dealTransferItems.id, itemId)).limit(1);
  const role = row ? roleIn(row.deal, userId) : null;
  if (!row || !role) throw new NotFoundError("Transfer item");
  if (row.deal.state !== "TRANSFER_IN_PROGRESS") throw new UserFacingError("The transfer hasn't started.");
  if (row.item.inPlatform) throw new UserFacingError("In-platform assets move automatically when the buyer confirms.");
  const now = done ? new Date() : null;
  await getDb()
    .update(schema.dealTransferItems)
    .set(role === "seller" ? { sellerDoneAt: now, sellerNote: note || null } : { buyerReceivedAt: now, buyerNote: note || null })
    .where(eq(schema.dealTransferItems.id, itemId));
  await audit({ dealId: row.deal.id, listingId: row.deal.listingId, actorId: userId, actorRole: role, action: role === "seller" ? "item_done" : "item_received", data: { itemId, done } });
}

async function allExternalReceived(tx: Pick<ReturnType<typeof getDb>, "select">, dealId: string) {
  const items = await tx.select().from(schema.dealTransferItems).where(eq(schema.dealTransferItems.dealId, dealId));
  return items.filter((i) => !i.inPlatform).every((i) => i.buyerReceivedAt !== null);
}

/** Delivers the in-platform package (move or clone) in the same transaction as the confirmation. */
async function deliverPackage(deal: Deal, tx: Tx) {
  const listing = (await tx.select().from(schema.listings).where(eq(schema.listings.id, deal.listingId)))[0];
  if (listing?.kind === "idea") return deliverIdea(deal, listing, tx);
  if (!listing?.projectId) throw new UserFacingError("The listed project no longer exists.");
  if (deal.licenseType === "exclusive_transfer") {
    const { redacted } = await moveProjectOwnership(tx, listing.projectId, deal.sellerId, deal.buyerId);
    await tx.update(schema.deals).set({ deliveredProjectId: listing.projectId }).where(eq(schema.deals.id, deal.id));
    await tx.update(schema.listings).set({ status: "sold" }).where(eq(schema.listings.id, listing.id));
    await audit({ listingId: listing.id, dealId: deal.id, actorRole: "system", action: "project_moved", toState: "sold", data: { redactedWaitlistEmails: redacted } }, tx);
    // The listing is gone: close everyone else's negotiations on it.
    const others = await tx.select({ id: schema.deals.id, state: schema.deals.state }).from(schema.deals).where(and(eq(schema.deals.listingId, listing.id), ne(schema.deals.id, deal.id), inArray(schema.deals.state, ["DRAFT_OFFER", "ACCEPTED"])));
    for (const o of others) {
      await tx.update(schema.deals).set({ state: "CANCELLED" }).where(eq(schema.deals.id, o.id));
      await audit({ dealId: o.id, listingId: listing.id, actorRole: "system", action: "deal_transition", fromState: o.state, toState: "CANCELLED", data: { reason: "Listing sold to another buyer" } }, tx);
    }
  } else {
    const kinds = (await tx.select({ kind: schema.listingAssets.kind }).from(schema.listingAssets).where(eq(schema.listingAssets.listingId, listing.id))).map((a) => a.kind).filter((k): k is InPlatformAsset => (IN_PLATFORM_ASSETS as readonly string[]).includes(k));
    const { projectId, redacted } = await cloneProjectPackage(tx, listing.projectId, deal.buyerId, kinds);
    await tx.update(schema.deals).set({ deliveredProjectId: projectId }).where(eq(schema.deals.id, deal.id));
    await audit({ listingId: listing.id, dealId: deal.id, actorRole: "system", action: "package_cloned", data: { projectId, redactedWaitlistEmails: redacted } }, tx);
  }
}

async function deliverIdea(deal: Deal, listing: typeof schema.listings.$inferSelect, tx: Tx) {
  if (!listing.ideaId) throw new UserFacingError("The listed idea no longer exists.");
  if (deal.licenseType === "exclusive_transfer") {
    const ideaId = await moveIdeaOwnership(tx, listing.ideaId, deal.sellerId, deal.buyerId);
    await tx.update(schema.deals).set({ deliveredIdeaId: ideaId }).where(eq(schema.deals.id, deal.id));
    await tx.update(schema.listings).set({ status: "sold" }).where(eq(schema.listings.id, listing.id));
    await audit({ listingId: listing.id, dealId: deal.id, actorRole: "system", action: "idea_moved", toState: "sold" }, tx);
    const others = await tx.select({ id: schema.deals.id, state: schema.deals.state }).from(schema.deals).where(and(eq(schema.deals.listingId, listing.id), ne(schema.deals.id, deal.id), inArray(schema.deals.state, ["DRAFT_OFFER", "ACCEPTED"])));
    for (const o of others) {
      await tx.update(schema.deals).set({ state: "CANCELLED" }).where(eq(schema.deals.id, o.id));
      await audit({ dealId: o.id, listingId: listing.id, actorRole: "system", action: "deal_transition", fromState: o.state, toState: "CANCELLED", data: { reason: "Listing sold to another buyer" } }, tx);
    }
  } else {
    const ideaId = await cloneIdea(tx, listing.ideaId, deal.buyerId);
    await tx.update(schema.deals).set({ deliveredIdeaId: ideaId }).where(eq(schema.deals.id, deal.id));
    await audit({ listingId: listing.id, dealId: deal.id, actorRole: "system", action: "idea_cloned", data: { ideaId } }, tx);
  }
}

export async function confirmReceipt(buyerId: UserId, dealId: string): Promise<Deal> {
  const { deal, role } = await requireParty(buyerId, dealId);
  if (role !== "buyer") throw new UserFacingError("Only the buyer confirms receipt.");
  const confirmed = await transition(deal.id, "BUYER_CONFIRMED", { id: buyerId, role }, {
    context: async (_d, tx) => ({ allItemsReceived: await allExternalReceived(tx, deal.id) }),
    set: { buyerConfirmedAt: new Date() },
    effects: deliverPackage,
  });
  await releasePayout(confirmed.id);
  return confirmed;
}

/** System auto-confirm after the confirmation window, unless a dispute is open. */
export async function autoConfirmDueDeals(now = new Date()): Promise<number> {
  const due = await getDb().select({ id: schema.deals.id }).from(schema.deals).where(and(eq(schema.deals.state, "TRANSFER_IN_PROGRESS"), lt(schema.deals.autoConfirmAt, now)));
  let n = 0;
  for (const d of due) {
    try {
      await transition(d.id, "BUYER_CONFIRMED", { id: null, role: "system" }, { context: async () => ({ autoConfirmDue: true }), set: { buyerConfirmedAt: now }, effects: deliverPackage, data: { auto: true } });
      await releasePayout(d.id);
      n++;
    } catch (err) {
      console.error(`[marketplace] auto-confirm failed for deal ${d.id}`, err instanceof Error ? err.message : err);
    }
  }
  return n;
}

/* --------------------------------------------------------------- Payout */

/** Pays the seller (amount minus fee) once confirmed. Blocked until the seller's Stripe account can receive payouts. */
export async function releasePayout(dealId: string): Promise<"paid" | "blocked" | "skipped"> {
  const [deal] = await getDb().select().from(schema.deals).where(eq(schema.deals.id, dealId));
  if (!deal || deal.state !== "BUYER_CONFIRMED") return "skipped";
  const [openDispute] = await getDb().select({ id: schema.disputes.id }).from(schema.disputes).where(and(eq(schema.disputes.dealId, dealId), eq(schema.disputes.status, "open"))).limit(1);
  if (openDispute) return "skipped";
  const amount = deal.amountCents! - (deal.platformFeeCents ?? 0);
  const account = await getConnectAccount(deal.sellerId);
  await getDb().insert(schema.payouts).values({ dealId, sellerId: deal.sellerId, amountCents: amount, currency: deal.currency }).onConflictDoNothing();
  if (!account?.payoutsEnabled) {
    await getDb().update(schema.payouts).set({ status: "blocked", note: "Waiting for the seller to finish Stripe onboarding." }).where(and(eq(schema.payouts.dealId, dealId), ne(schema.payouts.status, "paid")));
    return "blocked";
  }
  const payment = await succeededPayment(dealId);
  const { transferId } = await getPayments().transfer({ dealId, amountCents: amount, currency: deal.currency, destination: account.stripeAccountId, chargeId: payment?.chargeId ?? null });
  await transition(dealId, "PAID_OUT", { id: null, role: "system" }, {
    context: async () => ({ sellerPayoutsEnabled: true }),
    data: { transferId, amountCents: amount },
    effects: async (_d, tx) => {
      await tx.update(schema.payouts).set({ status: "paid", transferId, note: null }).where(eq(schema.payouts.dealId, dealId));
    },
  });
  return "paid";
}

/** After a seller finishes onboarding, release their blocked payouts. */
export async function releaseBlockedPayouts(sellerId: string): Promise<number> {
  const blocked = await getDb().select({ dealId: schema.payouts.dealId }).from(schema.payouts).where(and(eq(schema.payouts.sellerId, sellerId), eq(schema.payouts.status, "blocked")));
  let n = 0;
  for (const b of blocked) if ((await releasePayout(b.dealId)) === "paid") n++;
  return n;
}

/* ------------------------------------------------------------- Disputes */

export async function openDispute(userId: UserId, dealId: string, input: unknown): Promise<Deal> {
  const { deal, role } = await requireParty(userId, dealId);
  const { reason } = disputeSchema.parse(input);
  return transition(deal.id, "DISPUTED", { id: userId, role }, {
    data: { reason },
    effects: async (d, tx) => {
      await tx.insert(schema.disputes).values({ dealId: d.id, openedBy: userId, reason });
    },
  });
}

/** Opened by Stripe (chargeback): freezes the deal like a user dispute. */
export async function openSystemDispute(paymentIntentId: string, reason: string, externalId: string) {
  const [payment] = await getDb().select().from(schema.marketplacePayments).where(eq(schema.marketplacePayments.paymentIntentId, paymentIntentId)).limit(1);
  if (!payment) return "ignored" as const;
  const [deal] = await getDb().select().from(schema.deals).where(eq(schema.deals.id, payment.dealId));
  if (!deal || deal.state === "DISPUTED" || !canTransition(deal.state, "DISPUTED", "system").ok) return "ignored" as const;
  await transition(deal.id, "DISPUTED", { id: null, role: "system" }, { data: { reason }, effects: async (d, tx) => void (await tx.insert(schema.disputes).values({ dealId: d.id, reason, externalId })) });
  return "processed" as const;
}

export async function resolveDispute(adminId: UserId, disputeId: string, outcome: "refund" | "release" | "continue", note: string): Promise<Deal> {
  if (!isUuid(disputeId)) throw new NotFoundError("Dispute");
  const [dispute] = await getDb().select().from(schema.disputes).where(and(eq(schema.disputes.id, disputeId), eq(schema.disputes.status, "open")));
  if (!dispute) throw new NotFoundError("Dispute");
  const admin: Actor = { id: adminId, role: "admin" };
  const close = async (tx: Tx) => {
    await tx.update(schema.disputes).set({ status: outcome === "refund" ? "resolved_refund" : outcome === "release" ? "resolved_release" : "resolved_continue", resolution: note || null, resolvedBy: adminId, resolvedAt: new Date() }).where(eq(schema.disputes.id, disputeId));
  };
  if (outcome === "refund") {
    const payment = await succeededPayment(dispute.dealId);
    return transition(dispute.dealId, "REFUNDED", admin, {
      data: { note },
      effects: async (_d, tx) => {
        await close(tx);
        if (payment) {
          const { refundId } = await getPayments().refund(payment);
          await tx.update(schema.marketplacePayments).set({ status: "refunded", refundId }).where(eq(schema.marketplacePayments.id, payment.id));
        }
      },
    });
  }
  if (outcome === "release") {
    const d = await transition(dispute.dealId, "BUYER_CONFIRMED", admin, { set: { buyerConfirmedAt: new Date() }, data: { note }, effects: async (deal, tx) => { await close(tx); await deliverPackage(deal, tx); } });
    await releasePayout(d.id);
    return d;
  }
  const [deal] = await getDb().select().from(schema.deals).where(eq(schema.deals.id, dispute.dealId));
  return transition(dispute.dealId, deal.stateBeforeDispute ?? "TRANSFER_IN_PROGRESS", admin, { context: async (dd) => ({ stateBeforeDispute: dd.stateBeforeDispute }), data: { note }, effects: async (_d, tx) => close(tx) });
}

/* ------------------------------------------------------ Messages, reviews */

export async function sendMessage(userId: UserId, dealId: string, input: unknown) {
  const { deal, role } = await requireParty(userId, dealId);
  const { body } = messageSchema.parse(input);
  await getDb().insert(schema.dealMessages).values({ dealId: deal.id, senderId: userId, body });
  await audit({ dealId: deal.id, listingId: deal.listingId, actorId: userId, actorRole: role, action: "message_sent" });
}

export async function leaveReview(userId: UserId, dealId: string, input: unknown) {
  const { deal, role } = await requireParty(userId, dealId);
  if (deal.state !== "BUYER_CONFIRMED" && deal.state !== "PAID_OUT") throw new UserFacingError("You can leave a review once the deal is complete.");
  const d = reviewSchema.parse(input);
  const inserted = await getDb()
    .insert(schema.reviews)
    .values({ dealId: deal.id, reviewerId: userId, revieweeId: role === "buyer" ? deal.sellerId : deal.buyerId, rating: d.rating, comment: d.comment })
    .onConflictDoNothing()
    .returning({ id: schema.reviews.id });
  if (!inserted.length) throw new UserFacingError("You already reviewed this deal.");
}

/* ------------------------------------------------------------- Reading */

export async function listDealsForUser(userId: UserId) {
  return getDb()
    .select({ deal: schema.deals, listingTitle: schema.listings.title })
    .from(schema.deals)
    .innerJoin(schema.listings, eq(schema.listings.id, schema.deals.listingId))
    .where(or(eq(schema.deals.buyerId, userId), eq(schema.deals.sellerId, userId)))
    .orderBy(desc(schema.deals.updatedAt));
}

export async function listDealsForListing(sellerId: UserId, listingId: string) {
  if (!isUuid(listingId)) return [];
  return getDb()
    .select({ deal: schema.deals, buyerName: schema.users.name, buyerEmail: schema.users.email })
    .from(schema.deals)
    .innerJoin(schema.users, eq(schema.users.id, schema.deals.buyerId))
    .where(and(eq(schema.deals.listingId, listingId), eq(schema.deals.sellerId, sellerId)))
    .orderBy(desc(schema.deals.updatedAt));
}

/** Full deal room for a party (or an admin). */
export async function getDealRoom(viewer: { id: UserId; admin: boolean }, dealId: string) {
  if (!isUuid(dealId)) return null;
  const db = getDb();
  const [deal] = await db.select().from(schema.deals).where(viewer.admin ? eq(schema.deals.id, dealId) : and(eq(schema.deals.id, dealId), or(eq(schema.deals.buyerId, viewer.id), eq(schema.deals.sellerId, viewer.id)))).limit(1);
  if (!deal) return null;
  const [listing, offers, messages, items, [agreement], payments, [payout], disputes, reviews, auditLog, parties] = await Promise.all([
    requireListingForDeal(deal.listingId),
    db.select().from(schema.offers).where(eq(schema.offers.dealId, deal.id)).orderBy(asc(schema.offers.createdAt)),
    db.select({ m: schema.dealMessages, name: schema.users.name }).from(schema.dealMessages).leftJoin(schema.users, eq(schema.users.id, schema.dealMessages.senderId)).where(eq(schema.dealMessages.dealId, deal.id)).orderBy(asc(schema.dealMessages.createdAt)),
    db.select().from(schema.dealTransferItems).where(eq(schema.dealTransferItems.dealId, deal.id)),
    db.select().from(schema.agreements).where(eq(schema.agreements.dealId, deal.id)),
    db.select().from(schema.marketplacePayments).where(eq(schema.marketplacePayments.dealId, deal.id)).orderBy(desc(schema.marketplacePayments.createdAt)),
    db.select().from(schema.payouts).where(eq(schema.payouts.dealId, deal.id)),
    db.select().from(schema.disputes).where(eq(schema.disputes.dealId, deal.id)).orderBy(desc(schema.disputes.createdAt)),
    db.select().from(schema.reviews).where(eq(schema.reviews.dealId, deal.id)),
    db.select().from(schema.marketplaceAuditLog).where(eq(schema.marketplaceAuditLog.dealId, deal.id)).orderBy(asc(schema.marketplaceAuditLog.createdAt)),
    db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email }).from(schema.users).where(inArray(schema.users.id, [deal.buyerId, deal.sellerId])),
  ]);
  return {
    deal,
    role: viewer.admin && !roleIn(deal, viewer.id) ? ("admin" as const) : roleIn(deal, viewer.id)!,
    listing,
    offers,
    messages,
    items,
    agreement: agreement ?? null,
    payment: payments[0] ?? null,
    payout: payout ?? null,
    disputes,
    reviews,
    auditLog,
    buyer: parties.find((p) => p.id === deal.buyerId)!,
    seller: parties.find((p) => p.id === deal.sellerId)!,
  };
}

