"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { clientIp } from "@/server/client-ip";
import { getDb, schema } from "@/server/db/client";
import { UserFacingError } from "@/server/data/errors";
import { acceptNda, createListingDraft, decideAccess, reportListing, requestAccess } from "@/server/data/marketplace";
import type { AppUser } from "@/server/data/users";
import { isAdmin, isMarketplaceEnabled, paymentsMode } from "@/server/marketplace/config";
import {
  acceptAgreement,
  acceptLatestOffer,
  buyNow,
  cancelDeal,
  confirmReceipt,
  counterOffer,
  handlePaymentSucceeded,
  leaveReview,
  makeOffer,
  markTransferItem,
  openDispute,
  rejectLatestOffer,
  releaseBlockedPayouts,
  resolveDispute,
  sendMessage,
  startCheckout,
  startTransfer,
} from "@/server/marketplace/deals";
import { adminUnpublish, checkReadiness, draftTeaser, reviewListing, setMarketplaceBan, submitListing, unpublishOwnListing } from "@/server/marketplace/listings";
import { completeMockOnboarding, getPayments } from "@/server/marketplace/payments";
import { isModuleOn } from "@/lib/platform-settings";
import { getPlatformSettings } from "@/server/platform/settings";

async function run<T>(fn: (user: AppUser) => Promise<T>, opts: { admin?: boolean } = {}): Promise<ActionResult<T>> {
  const user = await requireOnboardedUser();
  try {
    if (!isMarketplaceEnabled()) throw new UserFacingError("The marketplace is not enabled.");
    if (opts.admin && !isAdmin(user)) throw new UserFacingError("Admins only.");
    if (!isAdmin(user) && !isModuleOn(await getPlatformSettings(), "marketplace")) throw new UserFacingError("The marketplace is turned off right now.");
    const data = await fn(user);
    revalidatePath("/app/marketplace", "layout");
    revalidatePath("/app/admin", "layout");
    return { ok: true, data };
  } catch (err) {
    return toActionError(err);
  }
}

async function requestMeta() {
  const h = await headers();
  return { ip: clientIp(new Request("http://local", { headers: h })), userAgent: h.get("user-agent") };
}

/* Seller */
export const createListingAction = async (input: unknown) => run(async (u) => ({ id: (await createListingDraft(u.id, input as never)).id }));
export const draftTeaserAction = async (listingId: string) => run((u) => draftTeaser(u.id, listingId));
export const checkReadinessAction = async (listingId: string, teaser: unknown, confirmations: { ownershipConfirmed?: boolean; originalWorkDeclared?: boolean }) =>
  run(async (u) => {
    const r = await checkReadiness(u.id, listingId, teaser, confirmations);
    return { checks: r.checks, ready: r.ready, level: r.validation.level };
  });
export const submitListingAction = async (listingId: string, input: unknown) => run(async (u) => {
  const r = await submitListing(u.id, listingId, input);
  return { flagged: !!r.similarity, published: r.published };
});
export const unpublishListingAction = async (listingId: string) => run((u) => unpublishOwnListing(u.id, listingId));
export const decideAccessAction = async (accessId: string, grant: boolean) => run((u) => decideAccess(u.id, accessId, grant));

/* Buyer */
export const acceptNdaAction = async (listingId: string) => run(async (u) => acceptNda(u.id, listingId, await requestMeta()));
export const requestAccessAction = async (listingId: string, message: string) => run((u) => requestAccess(u.id, listingId, message));
export const makeOfferAction = async (listingId: string, input: unknown) => run(async (u) => ({ dealId: (await makeOffer(u.id, listingId, input)).id }));
export const buyNowAction = async (listingId: string) => run(async (u) => ({ dealId: (await buyNow(u.id, listingId)).id }));
export const reportListingAction = async (listingId: string, reason: string) =>
  run(async (u) => {
    if (reason.trim().length < 10) throw new UserFacingError("Tell us what's wrong (at least 10 characters).");
    await reportListing(u.id, listingId, reason);
  });

/* Deal room */
export const counterOfferAction = async (dealId: string, input: unknown) => run((u) => counterOffer(u.id, dealId, input));
export const acceptOfferAction = async (dealId: string) => run(async (u) => void (await acceptLatestOffer(u.id, dealId)));
export const rejectOfferAction = async (dealId: string) => run((u) => rejectLatestOffer(u.id, dealId));
export const cancelDealAction = async (dealId: string) => run(async (u) => void (await cancelDeal(u.id, dealId)));
export const acceptAgreementAction = async (dealId: string, hash: string) => run(async (u) => acceptAgreement(u.id, dealId, hash, (await requestMeta()).ip));
export const startCheckoutAction = async (dealId: string) => run((u) => startCheckout(u.id, dealId));
export const startTransferAction = async (dealId: string) => run(async (u) => void (await startTransfer(u.id, dealId)));
export const markItemAction = async (itemId: string, done: boolean, note: string) => run((u) => markTransferItem(u.id, itemId, done, note));
export const confirmReceiptAction = async (dealId: string) => run(async (u) => void (await confirmReceipt(u.id, dealId)));
export const openDisputeAction = async (dealId: string, reason: string) => run(async (u) => void (await openDispute(u.id, dealId, { reason })));
export const sendMessageAction = async (dealId: string, body: string) => run((u) => sendMessage(u.id, dealId, { body }));
export const leaveReviewAction = async (dealId: string, rating: number, comment: string) => run((u) => leaveReview(u.id, dealId, { rating, comment }));

/** Test mode only: simulates the buyer completing Stripe Checkout. */
export const mockPayAction = async (dealId: string, sessionId: string) =>
  run(async (u) => {
    if (paymentsMode() !== "mock") throw new UserFacingError("Mock payments are disabled.");
    const [p] = await getDb().select({ dealId: schema.marketplacePayments.dealId }).from(schema.marketplacePayments).where(eq(schema.marketplacePayments.checkoutSessionId, sessionId));
    const [deal] = p ? await getDb().select({ buyerId: schema.deals.buyerId }).from(schema.deals).where(eq(schema.deals.id, p.dealId)) : [];
    if (!p || p.dealId !== dealId || deal?.buyerId !== u.id) throw new UserFacingError("Unknown checkout session.");
    return handlePaymentSucceeded({ checkoutSessionId: sessionId, paymentIntentId: `mock_pi_${sessionId.slice(-12)}`, chargeId: `mock_ch_${sessionId.slice(-12)}` });
  });

/* Payouts (Stripe Connect) */
export const connectOnboardingAction = async () => run(async (u) => ({ url: await getPayments().connectOnboardingUrl(u) }));
export const syncConnectAction = async () =>
  run(async (u) => {
    const status = await getPayments().syncConnectAccount(u.id);
    if (status?.payoutsEnabled) await releaseBlockedPayouts(u.id);
    return status;
  });
export const mockOnboardingAction = async () =>
  run(async (u) => {
    await completeMockOnboarding(u.id);
    return { released: await releaseBlockedPayouts(u.id) };
  });

/* Admin */
export const reviewListingAction = async (listingId: string, approve: boolean, note: string) => run((u) => reviewListing(u.id, listingId, approve, note), { admin: true });
export const adminUnpublishAction = async (listingId: string, note: string) => run((u) => adminUnpublish(u.id, listingId, note), { admin: true });
export const banUserAction = async (userId: string, banned: boolean) => run((u) => setMarketplaceBan(u.id, userId, banned), { admin: true });
export const resolveDisputeAction = async (disputeId: string, outcome: "refund" | "release" | "continue", note: string) => run(async (u) => void (await resolveDispute(u.id, disputeId, outcome, note)), { admin: true });
export const closeReportAction = async (reportId: string, actioned: boolean) =>
  run(async () => {
    await getDb().update(schema.listingReports).set({ status: actioned ? "actioned" : "dismissed" }).where(eq(schema.listingReports.id, reportId));
  }, { admin: true });
