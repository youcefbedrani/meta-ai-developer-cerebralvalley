/*
 * NDA and Asset Transfer Agreement templates.
 * IMPORTANT: these templates are placeholders and MUST be reviewed by a lawyer
 * for your jurisdiction before real use (see README).
 */

export const NDA_VERSION = "nda-v1";
export const AGREEMENT_TEMPLATE_VERSION = "ata-v1";
export const WAITLIST_CONSENT_VERSION = "transfer-consent-v1";
export const WAITLIST_CONSENT_TEXT = "Also allow my email to be shared with a future owner of this product if it's sold.";

export const NDA_TEXT = `Mutual non-disclosure (click-through), version ${NDA_VERSION}

By viewing the full details of this listing you agree:
1. To use the information only to evaluate a possible purchase of this project.
2. Not to copy, publish, or build on the information, or share it with anyone else, unless you buy the project.
3. Not to contact the seller's customers, waitlist subscribers or partners outside the platform.
4. That these obligations last 24 months from today, or until you complete a purchase.
5. That your acceptance is recorded with the time, your IP address and this version.`;

export type AgreementVars = {
  sellerName: string;
  buyerName: string;
  listingTitle: string;
  licenseType: "exclusive_transfer" | "non_exclusive";
  priceFormatted: string;
  assets: string[];
  nonCompeteMonths: number;
  nonCompeteScope: string;
  date: string;
  dealId: string;
};

export function renderAgreement(v: AgreementVars): string {
  const exclusive = v.licenseType === "exclusive_transfer";
  return [
    `ASSET TRANSFER AGREEMENT (template ${AGREEMENT_TEMPLATE_VERSION}). Deal reference ${v.dealId}`,
    `Date: ${v.date}`,
    `Seller: ${v.sellerName}`,
    `Buyer: ${v.buyerName}`,
    ``,
    `1. Subject. The Seller transfers to the Buyer the project package "${v.listingTitle}", consisting of:`,
    ...v.assets.map((a) => `   - ${a}`),
    ``,
    `2. License type: ${exclusive ? "EXCLUSIVE TRANSFER" : "NON-EXCLUSIVE LICENSE"}.`,
    exclusive
      ? `   All rights, title and interest in the assets pass to the Buyer. The project is moved to the Buyer's account and the Seller loses access. The Seller keeps no copies, except as required by law.`
      : `   The Buyer receives a copy of the research package and a non-exclusive, perpetual right to use it. The Seller keeps ownership and may sell further copies. This is clearly not an exclusive sale.`,
    ``,
    `3. Price: ${v.priceFormatted}, paid through the platform. Funds are held by the platform until the Buyer confirms the transfer (or the confirmation window passes without a dispute), then paid out to the Seller minus the platform fee.`,
    ``,
    `4. Seller warranties. The Seller confirms that the assets are their original work or that they hold the rights to transfer them, that the waitlist emails included were collected with the subscribers' consent to transfer, and that the listing doesn't misrepresent tracked data.`,
    ``,
    exclusive
      ? `5. Non-compete. For ${v.nonCompeteMonths} months from completion the Seller will not build, sell or promote a product that directly competes with the transferred project${v.nonCompeteScope ? ` (scope: ${v.nonCompeteScope})` : ""}.`
      : `5. Non-compete. None (non-exclusive license).`,
    ``,
    `6. External assets (domain, code repository, accounts) are transferred using the checklist in the deal room. Each item is confirmed by both parties.`,
    ``,
    `7. Disputes are first handled through the platform's dispute process. Opening a dispute freezes the payout until it is resolved.`,
    ``,
    `This template must be reviewed by a lawyer before use. By accepting in the app, each party agrees to this exact text (identified by its hash).`,
  ].join("\n");
}

export function platformFee(amountCents: number, percent: number): number {
  return Math.round((amountCents * percent) / 100);
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
