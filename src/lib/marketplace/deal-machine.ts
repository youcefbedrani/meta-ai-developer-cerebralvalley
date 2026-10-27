/*
 * Deal state machine. Every transition names who may trigger it; anything not
 * listed here is rejected. Pure, so every edge is unit-tested.
 *
 * DRAFT_OFFER → ACCEPTED → PAYMENT_HELD → TRANSFER_IN_PROGRESS → BUYER_CONFIRMED → PAID_OUT
 * side states: CANCELLED, REFUNDED, DISPUTED
 */

export const DEAL_STATES = ["DRAFT_OFFER", "ACCEPTED", "PAYMENT_HELD", "TRANSFER_IN_PROGRESS", "BUYER_CONFIRMED", "PAID_OUT", "CANCELLED", "REFUNDED", "DISPUTED"] as const;
export type DealState = (typeof DEAL_STATES)[number];
export type DealActor = "buyer" | "seller" | "system" | "admin";

export type TransitionContext = {
  /** Both parties accepted the transfer agreement. */
  agreementSigned?: boolean;
  /** Every external transfer item was confirmed received by the buyer. */
  allItemsReceived?: boolean;
  /** For system auto-confirm: the confirmation window has passed. */
  autoConfirmDue?: boolean;
  /** Seller finished Stripe Connect onboarding (payouts enabled). */
  sellerPayoutsEnabled?: boolean;
  /** For leaving DISPUTED: the state it was in before. */
  stateBeforeDispute?: DealState | null;
};

type Rule = { actors: DealActor[]; guard?: (c: TransitionContext) => string | null };

const TRANSITIONS: Partial<Record<DealState, Partial<Record<DealState, Rule>>>> = {
  DRAFT_OFFER: {
    // The party receiving the latest offer accepts it (checked by the caller).
    ACCEPTED: { actors: ["buyer", "seller"] },
    CANCELLED: { actors: ["buyer", "seller", "admin"] },
  },
  ACCEPTED: {
    PAYMENT_HELD: { actors: ["system"], guard: (c) => (c.agreementSigned ? null : "Both parties must accept the transfer agreement before payment.") },
    CANCELLED: { actors: ["buyer", "seller", "admin"] },
  },
  PAYMENT_HELD: {
    TRANSFER_IN_PROGRESS: { actors: ["seller"] },
    REFUNDED: { actors: ["seller", "admin", "system"] },
    DISPUTED: { actors: ["buyer", "seller", "system"] },
  },
  TRANSFER_IN_PROGRESS: {
    BUYER_CONFIRMED: {
      actors: ["buyer", "system"],
      guard: (c) => (c.allItemsReceived || c.autoConfirmDue ? null : "Confirm every transfer item as received first."),
    },
    REFUNDED: { actors: ["seller", "admin", "system"] },
    DISPUTED: { actors: ["buyer", "seller", "system"] },
  },
  BUYER_CONFIRMED: {
    PAID_OUT: { actors: ["system", "admin"], guard: (c) => (c.sellerPayoutsEnabled ? null : "Payout is blocked until the seller completes Stripe onboarding.") },
  },
  DISPUTED: {
    // Only an admin resolves a dispute: refund the buyer, release to the seller, or resume.
    REFUNDED: { actors: ["admin", "system"] },
    BUYER_CONFIRMED: { actors: ["admin"] },
    TRANSFER_IN_PROGRESS: { actors: ["admin"], guard: (c) => (c.stateBeforeDispute === "TRANSFER_IN_PROGRESS" ? null : "Can only resume a dispute opened during transfer.") },
    PAYMENT_HELD: { actors: ["admin"], guard: (c) => (c.stateBeforeDispute === "PAYMENT_HELD" ? null : "Can only resume a dispute opened before transfer.") },
  },
};

export const TERMINAL_STATES: DealState[] = ["PAID_OUT", "CANCELLED", "REFUNDED"];

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

export function canTransition(from: DealState, to: DealState, actor: DealActor, ctx: TransitionContext = {}): TransitionCheck {
  const rule = TRANSITIONS[from]?.[to];
  if (!rule) return { ok: false, reason: `A deal can't go from ${label(from)} to ${label(to)}.` };
  if (!rule.actors.includes(actor)) return { ok: false, reason: `The ${actor} can't move this deal to ${label(to)}.` };
  const blocked = rule.guard?.(ctx);
  return blocked ? { ok: false, reason: blocked } : { ok: true };
}

/** Every allowed edge (for tests and docs). */
export function allTransitions(): { from: DealState; to: DealState; actors: DealActor[] }[] {
  return Object.entries(TRANSITIONS).flatMap(([from, tos]) => Object.entries(tos!).map(([to, rule]) => ({ from: from as DealState, to: to as DealState, actors: rule!.actors })));
}

export function label(s: DealState): string {
  return {
    DRAFT_OFFER: "Negotiating",
    ACCEPTED: "Accepted",
    PAYMENT_HELD: "Payment held",
    TRANSFER_IN_PROGRESS: "Transfer in progress",
    BUYER_CONFIRMED: "Buyer confirmed",
    PAID_OUT: "Paid out",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
    DISPUTED: "Disputed",
  }[s];
}

/** Main-path progress for the deal room timeline. */
export const HAPPY_PATH: DealState[] = ["DRAFT_OFFER", "ACCEPTED", "PAYMENT_HELD", "TRANSFER_IN_PROGRESS", "BUYER_CONFIRMED", "PAID_OUT"];
