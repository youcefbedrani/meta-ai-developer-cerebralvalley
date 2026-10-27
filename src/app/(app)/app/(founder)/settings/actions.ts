"use server";

import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { CREDIT_PACKS, type CreditPackId } from "@/lib/plans";
import { createCheckoutSession, createCreditPackCheckout, createPortalSession } from "@/server/billing/subscriptions";

export async function checkoutAction(plan: "founder" | "studio"): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  if (plan !== "founder" && plan !== "studio") return { ok: false, error: "Unknown plan", code: "validation" };
  let url: string;
  try {
    url = await createCheckoutSession(user.id, plan);
  } catch (err) {
    try {
      return toActionError(err);
    } catch {
      console.error("[billing] checkout failed", err instanceof Error ? err.message : err);
      return { ok: false, error: "Could not start checkout. Please try again." };
    }
  }
  redirect(url);
}

export async function portalAction(): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  let url: string;
  try {
    url = await createPortalSession(user.id);
  } catch (err) {
    try {
      return toActionError(err);
    } catch {
      console.error("[billing] portal failed", err instanceof Error ? err.message : err);
      return { ok: false, error: "Could not open the billing portal. Please try again." };
    }
  }
  redirect(url);
}

export async function buyCreditsAction(packId: CreditPackId): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  if (!CREDIT_PACKS.some((p) => p.id === packId)) return { ok: false, error: "Unknown credit pack", code: "validation" };
  let url: string;
  try {
    url = await createCreditPackCheckout(user.id, packId);
  } catch (err) {
    try {
      return toActionError(err);
    } catch {
      console.error("[billing] credit pack checkout failed", err instanceof Error ? err.message : err);
      return { ok: false, error: "Could not start checkout. Please try again." };
    }
  }
  redirect(url);
}
