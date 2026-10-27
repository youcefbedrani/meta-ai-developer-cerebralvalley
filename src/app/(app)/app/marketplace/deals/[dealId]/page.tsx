import { Check, ChevronLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgreementPanel, ConfirmButton, DisputeForm, Messages, OfferActions, PayButton, ReviewForm, SellerTransferStart, TransferItem } from "@/components/marketplace/deal-room";
import { MarketplaceNav } from "@/components/marketplace/shared";
import { HAPPY_PATH, label } from "@/lib/marketplace/deal-machine";
import { formatMoney } from "@/lib/marketplace/terms";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { isAdmin, paymentsMode } from "@/server/marketplace/config";
import { requireMarketplace } from "@/server/marketplace/guard";
import { getDealRoom } from "@/server/marketplace/deals";

export const metadata: Metadata = { title: "Deal room" };

export default async function DealRoomPage({ params }: PageProps<"/app/marketplace/deals/[dealId]">) {
  requireMarketplace();
  const user = await requireOnboardedUser();
  const { dealId } = await params;
  const room = await getDealRoom({ id: user.id, admin: isAdmin(user) }, dealId);
  if (!room) notFound();
  const { deal, role, listing, offers, items, agreement, payment, payout, disputes, reviews } = room;
  const other = role === "buyer" ? room.seller : room.buyer;
  const latest = [...offers].reverse().find((o) => o.status === "pending");
  const step = HAPPY_PATH.indexOf(deal.state);
  const money = (c: number | null) => (c === null ? "—" : formatMoney(c, deal.currency));
  const externalReady = items.filter((i) => !i.inPlatform).every((i) => i.buyerReceivedAt);
  const myAgreement = role === "seller" ? agreement?.sellerAcceptedAt : agreement?.buyerAcceptedAt;
  const otherAgreement = role === "seller" ? agreement?.buyerAcceptedAt : agreement?.sellerAcceptedAt;
  const reviewed = reviews.some((r) => r.reviewerId === user.id);
  const openDispute = disputes.find((d) => d.status === "open");

  return (
    <div className="space-y-6">
      <Link href="/app/marketplace/deals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Deals</Link>
      <MarketplaceNav active="deals" />
      <section className="surface p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Deal room · you&apos;re the {role}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{listing.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{deal.licenseType === "exclusive_transfer" ? "Exclusive transfer" : "Non-exclusive copy"} · with {other.name ?? other.email}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold">{money(deal.amountCents)}</p>
            {deal.amountCents ? <p className="text-xs text-muted-foreground">Platform fee {money(deal.platformFeeCents)} · seller receives {money(deal.amountCents - (deal.platformFeeCents ?? 0))}</p> : null}
          </div>
        </div>
        <ol className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Deal progress">
          {HAPPY_PATH.map((s, i) => (
            <li key={s} className={cn("rounded-lg border px-2 py-2 text-center text-xs", i < step || deal.state === "PAID_OUT" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : i === step ? "border-[var(--violet)] bg-[var(--violet)]/10 font-medium" : "border-border text-muted-foreground")}>
              {i < step ? <Check className="mx-auto mb-0.5 size-3.5" /> : null}{label(s)}
            </li>
          ))}
        </ol>
        {step === -1 ? <p className="mt-4 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm"><b>{label(deal.state)}.</b> {deal.state === "DISPUTED" ? "The payout is frozen until an admin resolves the dispute." : deal.state === "REFUNDED" ? "The buyer was refunded." : "This deal is closed."}</p> : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {deal.state === "DRAFT_OFFER" ? (
            <section className="surface p-6">
              <h2 className="font-medium">Offers</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {offers.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2">
                    <span><b>{o.fromUserId === deal.buyerId ? "Buyer" : "Seller"}</b> offered {money(o.amountCents)}{o.message ? `: “${o.message}”` : ""}</span>
                    <span className="text-xs capitalize text-muted-foreground">{o.status}</span>
                  </li>
                ))}
              </ul>
              {role !== "admin" ? <div className="mt-4"><OfferActions dealId={deal.id} canRespond={!!latest && latest.fromUserId !== user.id} currency={deal.currency} /></div> : null}
            </section>
          ) : null}

          {agreement && deal.state === "ACCEPTED" ? (
            <section className="surface p-6">
              <h2 className="font-medium">1. Asset Transfer Agreement</h2>
              <p className="mt-1 text-xs text-muted-foreground">Both parties accept the same text before payment. Template only: have it reviewed by a lawyer.</p>
              <div className="mt-3"><AgreementPanel dealId={deal.id} body={agreement.body} hash={agreement.hash} accepted={!!myAgreement} otherAccepted={!!otherAgreement} role={role} /></div>
              {role === "buyer" ? (
                <div className="mt-5 border-t border-border pt-4">
                  <h2 className="font-medium">2. Payment</h2>
                  {myAgreement && otherAgreement ? (
                    <div className="mt-2 space-y-2">
                      <PayButton dealId={deal.id} label={money(deal.amountCents)} />
                      <p className="text-xs text-muted-foreground">The platform holds the money until you confirm the transfer.{paymentsMode() === "mock" ? " Test mode: no real payment is taken." : ""}</p>
                    </div>
                  ) : <p className="mt-1 text-sm text-muted-foreground">Available once both parties accept the agreement.</p>}
                </div>
              ) : null}
            </section>
          ) : agreement ? (
            <details className="surface p-6"><summary className="cursor-pointer font-medium">Signed agreement</summary><pre className="mt-3 whitespace-pre-wrap font-sans text-xs">{agreement.body}</pre><p className="mt-2 text-xs text-muted-foreground">sha256 {agreement.hash}</p></details>
          ) : null}

          {["PAYMENT_HELD", "TRANSFER_IN_PROGRESS", "BUYER_CONFIRMED", "PAID_OUT", "DISPUTED"].includes(deal.state) ? (
            <section className="surface p-6">
              <h2 className="font-medium">Transfer checklist</h2>
              {deal.state === "PAYMENT_HELD" ? (
                <div className="mt-2 space-y-3">
                  <p className="text-sm"><ShieldCheck className="mr-1 inline size-4 text-emerald-600" /> Payment of {money(payment?.amountCents ?? null)} is held by the platform.</p>
                  {role === "seller" ? <SellerTransferStart dealId={deal.id} /> : <p className="text-sm text-muted-foreground">Waiting for the seller to start the transfer.</p>}
                </div>
              ) : null}
              {deal.state === "TRANSFER_IN_PROGRESS" && deal.autoConfirmAt ? <p className="mt-2 text-xs text-muted-foreground">If the buyer doesn&apos;t confirm or dispute by {deal.autoConfirmAt.toISOString().slice(0, 10)}, the deal is confirmed automatically.</p> : null}
              <ul className="mt-3 space-y-2">
                {items.map((i) => <TransferItem key={i.id} role={role} active={deal.state === "TRANSFER_IN_PROGRESS"} item={{ ...i, sellerDoneAt: i.sellerDoneAt?.toISOString() ?? null, buyerReceivedAt: i.buyerReceivedAt?.toISOString() ?? null }} />)}
              </ul>
              {deal.state === "TRANSFER_IN_PROGRESS" && role === "buyer" ? <div className="mt-4"><ConfirmButton dealId={deal.id} ready={externalReady} /></div> : null}
              {deal.deliveredProjectId && role === "buyer" ? <p className="mt-4 text-sm"><Link href={`/app/projects/${deal.deliveredProjectId}`} className="font-medium underline-offset-4 hover:underline">Open the project in your account →</Link></p> : null}
              {deal.deliveredIdeaId && role === "buyer" ? <p className="mt-4 text-sm"><Link href={`/app/ideas/${deal.deliveredIdeaId}`} className="font-medium underline-offset-4 hover:underline">Open the idea in your account →</Link></p> : null}
            </section>
          ) : null}

          {(deal.state === "PAYMENT_HELD" || deal.state === "TRANSFER_IN_PROGRESS") && role !== "admin" ? <DisputeForm dealId={deal.id} /> : null}
          {openDispute ? <section className="surface p-6 text-sm"><h2 className="font-medium text-destructive">Open dispute</h2><p className="mt-1">{openDispute.reason}</p><p className="mt-1 text-xs text-muted-foreground">An admin will review it. The payout is frozen meanwhile.</p></section> : null}

          {(deal.state === "BUYER_CONFIRMED" || deal.state === "PAID_OUT") && !reviewed && role !== "admin" ? <section className="surface p-6"><ReviewForm dealId={deal.id} otherName={other.name ?? "the other party"} /></section> : null}
        </div>

        <div className="space-y-6">
          <section className="surface p-5 text-sm">
            <h2 className="font-medium">Money</h2>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between"><dt className="text-muted-foreground">Payment</dt><dd className="capitalize">{payment?.status ?? "not paid"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Payout to seller</dt><dd className="capitalize">{payout?.status ?? "after confirmation"}</dd></div>
            </dl>
            {payout?.status === "blocked" ? <p className="mt-2 text-xs text-warning">{payout.note} {role === "seller" ? <Link href="/app/marketplace/payouts" className="underline">Set up payouts</Link> : null}</p> : null}
          </section>
          <section className="surface p-5">
            <h2 className="mb-3 font-medium">Messages</h2>
            <Messages dealId={deal.id} messages={room.messages.map(({ m, name }) => ({ id: m.id, body: m.body, name, mine: m.senderId === user.id, at: m.createdAt.toISOString() }))} />
          </section>
          <details className="surface p-5 text-xs">
            <summary className="cursor-pointer text-sm font-medium">Audit log ({room.auditLog.length})</summary>
            <ul className="mt-2 space-y-1 text-muted-foreground">{room.auditLog.map((a) => <li key={a.id}>{a.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {a.actorRole} · {a.action}{a.toState ? ` → ${a.toState}` : ""}</li>)}</ul>
          </details>
        </div>
      </div>
    </div>
  );
}
