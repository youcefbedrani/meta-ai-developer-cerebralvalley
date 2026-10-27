import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MockPayButton } from "@/components/marketplace/mock-pay";
import { formatMoney } from "@/lib/marketplace/terms";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { paymentsMode } from "@/server/marketplace/config";
import { requireMarketplace } from "@/server/marketplace/guard";
import { getDealRoom } from "@/server/marketplace/deals";

export const metadata: Metadata = { title: "Test checkout" };

/** Stands in for Stripe Checkout when MARKETPLACE_PAYMENTS=mock. Never available in production. */
export default async function MockCheckoutPage({ params, searchParams }: PageProps<"/app/marketplace/deals/[dealId]/mock-checkout">) {
  requireMarketplace();
  if (paymentsMode() !== "mock") notFound();
  const user = await requireOnboardedUser();
  const { dealId } = await params;
  const { session } = await searchParams;
  const room = await getDealRoom({ id: user.id, admin: false }, dealId);
  if (!room || room.role !== "buyer" || typeof session !== "string") notFound();
  return (
    <div className="mx-auto max-w-md space-y-4 pt-8">
      <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><FlaskConical className="size-4" /> Test mode: this simulates Stripe Checkout. No money moves.</p>
      <section className="surface space-y-4 p-6">
        <p className="text-sm text-muted-foreground">Project package</p>
        <p className="text-lg font-semibold">{room.listing.title}</p>
        <p className="text-3xl font-semibold">{formatMoney(room.deal.amountCents ?? 0, room.deal.currency)}</p>
        <MockPayButton dealId={dealId} sessionId={session} label={formatMoney(room.deal.amountCents ?? 0, room.deal.currency)} />
      </section>
    </div>
  );
}
