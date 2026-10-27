"use client";

import { FileSignature, Flag, Loader2, Lock, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { acceptNdaAction, buyNowAction, makeOfferAction, reportListingAction, requestAccessAction } from "@/app/(app)/app/marketplace/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRun } from "./use-run";

type Props = {
  listingId: string;
  ndaText: string;
  access: { nda: boolean; access: "none" | "requested" | "granted" | "declined"; hasDeal: boolean; full: boolean };
  priceType: "fixed" | "offers";
  priceLabel: string;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string;
  dealId: string | null;
  isSeller: boolean;
};

/** NDA → access request or offer → deal room. */
export function BuyerPanel(p: Props) {
  const { run, pending, router } = useRun();
  const [ndaOpen, setNdaOpen] = useState(false);
  const [agree, setAgree] = useState(false);
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [offerMsg, setOfferMsg] = useState("");
  const [report, setReport] = useState("");
  const toDeal = (d: { dealId: string }) => router.push(`/app/marketplace/deals/${d.dealId}`);

  if (p.isSeller) return <section className="surface p-5 text-sm text-muted-foreground">This is your listing. Manage it under <b className="text-foreground">Selling</b>.</section>;

  return (
    <section className="surface space-y-4 p-5">
      <div>
        <p className="text-2xl font-semibold">{p.priceLabel}</p>
        <p className="text-xs text-muted-foreground">{p.priceType === "fixed" ? "Fixed price" : `Asking price · offers${p.minPrice ? ` from ${p.currency.toUpperCase()} ${p.minPrice}` : ""}${p.maxPrice ? ` up to ${p.currency.toUpperCase()} ${p.maxPrice}` : ""}`}</p>
        <p className="mt-1 text-xs text-muted-foreground">Payment is held by the platform until you confirm the transfer.</p>
      </div>

      {p.dealId ? (
        <Button variant="gradient" className="h-10 w-full" onClick={() => router.push(`/app/marketplace/deals/${p.dealId}`)}>Open your deal room</Button>
      ) : !p.access.nda ? (
        <>
          <p className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm"><Lock className="mt-0.5 size-4 shrink-0" /> Full details (research, evidence, assets) unlock after you accept the NDA and the seller grants access, or you make an offer.</p>
          <Button variant="gradient" className="h-10 w-full" onClick={() => setNdaOpen(true)}><FileSignature /> Review & accept NDA</Button>
        </>
      ) : (
        <div className="space-y-4">
          {!p.access.full ? (
            p.access.access === "requested" ? (
              <p className="rounded-xl bg-muted/40 p-3 text-sm">Access requested. You&apos;ll see the full details once the seller grants it, or make an offer now.</p>
            ) : p.access.access === "declined" ? (
              <p className="rounded-xl bg-muted/40 p-3 text-sm">The seller declined the access request. You can still make an offer.</p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="access-msg">Request full details</Label>
                <Input id="access-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="A line about you and why you're interested" />
                <Button variant="outline" className="w-full rounded-[10px]" disabled={pending} onClick={() => run(() => requestAccessAction(p.listingId, message), "Access requested")}>Request access</Button>
              </div>
            )
          ) : null}
          {p.priceType === "fixed" ? (
            <Button variant="gradient" className="h-10 w-full" disabled={pending} onClick={() => run(() => buyNowAction(p.listingId), "Deal started", toDeal)}>{pending ? <Loader2 className="animate-spin" /> : <ShoppingCart />} Buy for {p.priceLabel}</Button>
          ) : (
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => makeOfferAction(p.listingId, { amount, message: offerMsg }), "Offer sent", toDeal); }}>
              <Label htmlFor="offer-amount">Your offer ({p.currency.toUpperCase()})</Label>
              <Input id="offer-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Input aria-label="Message to the seller" value={offerMsg} onChange={(e) => setOfferMsg(e.target.value)} placeholder="Optional message" />
              <Button type="submit" variant="gradient" className="h-10 w-full" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null} Make an offer</Button>
            </form>
          )}
        </div>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="flex cursor-pointer items-center gap-1"><Flag className="size-3.5" /> Report this listing</summary>
        <div className="mt-2 space-y-2">
          <textarea aria-label="Report reason" value={report} onChange={(e) => setReport(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-white px-2 py-1.5 text-sm" placeholder="What's wrong? (plagiarism, misleading data…)" />
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => reportListingAction(p.listingId, report), "Thanks, our team will review it")}>Send report</Button>
        </div>
      </details>

      <Dialog open={ndaOpen} onOpenChange={setNdaOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Non-disclosure agreement</DialogTitle></DialogHeader>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-3 font-sans text-sm">{p.ndaText}</pre>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" /> I agree to the NDA. My acceptance is recorded with the time, my IP address and the NDA version.</label>
          <Button variant="gradient" disabled={!agree || pending} onClick={() => run(() => acceptNdaAction(p.listingId), "NDA accepted", () => { setNdaOpen(false); router.refresh(); })}>Accept NDA</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
