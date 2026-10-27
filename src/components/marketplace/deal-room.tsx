"use client";

import { AlertTriangle, CheckCircle2, CreditCard, FileSignature, Loader2, PackageCheck, Send, Star } from "lucide-react";
import { useState } from "react";
import {
  acceptAgreementAction,
  acceptOfferAction,
  cancelDealAction,
  confirmReceiptAction,
  counterOfferAction,
  leaveReviewAction,
  markItemAction,
  openDisputeAction,
  rejectOfferAction,
  sendMessageAction,
  startCheckoutAction,
  startTransferAction,
} from "@/app/(app)/app/marketplace/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useRun } from "./use-run";

type Role = "buyer" | "seller" | "admin";

export function OfferActions({ dealId, canRespond, currency }: { dealId: string; canRespond: boolean; currency: string }) {
  const { run, pending } = useRun();
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-3">
      {canRespond ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="gradient" disabled={pending} onClick={() => run(() => acceptOfferAction(dealId), "Offer accepted")}>Accept offer</Button>
          <Button variant="ghost" disabled={pending} onClick={() => run(() => rejectOfferAction(dealId), "Offer declined")}>Decline</Button>
        </div>
      ) : <p className="text-sm text-muted-foreground">Waiting for the other party to respond.</p>}
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => counterOfferAction(dealId, { amount, message: msg }), "Counter-offer sent"); setAmount(""); setMsg(""); }}>
        <div className="space-y-1"><Label htmlFor="counter">Counter-offer ({currency.toUpperCase()})</Label><Input id="counter" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36" /></div>
        <Input aria-label="Counter-offer message" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Optional message" className="min-w-48 flex-1" />
        <Button type="submit" variant="outline" className="rounded-[10px]" disabled={pending || !amount}>Send</Button>
      </form>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => cancelDealAction(dealId), "Deal cancelled")}>Cancel negotiation</Button>
    </div>
  );
}

export function AgreementPanel({ dealId, body, hash, accepted, otherAccepted, role }: { dealId: string; body: string; hash: string; accepted: boolean; otherAccepted: boolean; role: Role }) {
  const { run, pending } = useRun();
  const [agree, setAgree] = useState(false);
  return (
    <div className="space-y-3">
      <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-white p-4 font-sans text-xs leading-relaxed">{body}</pre>
      <p className="text-xs text-muted-foreground">Document hash (sha256): <code className="break-all">{hash}</code></p>
      <p className="text-sm">{accepted ? "✓ You accepted." : "You haven't accepted yet."} {otherAccepted ? "✓ The other party accepted." : "Waiting for the other party."}</p>
      {!accepted && role !== "admin" ? (
        <>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" /> I&apos;ve read this agreement and accept it. My acceptance is recorded with the time, my IP address and the document hash.</label>
          <Button variant="gradient" disabled={!agree || pending} onClick={() => run(() => acceptAgreementAction(dealId, hash), "Agreement accepted")}><FileSignature /> Accept agreement</Button>
        </>
      ) : null}
    </div>
  );
}

export function PayButton({ dealId, label }: { dealId: string; label: string }) {
  const { run, pending, router } = useRun();
  return (
    <Button variant="gradient" className="h-10" disabled={pending} onClick={() => run(() => startCheckoutAction(dealId), undefined, (d) => (d.url.startsWith("/") ? router.push(d.url) : window.location.assign(d.url)))}>
      {pending ? <Loader2 className="animate-spin" /> : <CreditCard />} Pay {label} (held in escrow)
    </Button>
  );
}

export function SellerTransferStart({ dealId }: { dealId: string }) {
  const { run, pending } = useRun();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="gradient" disabled={pending} onClick={() => run(() => startTransferAction(dealId), "Transfer started")}><PackageCheck /> Start transfer</Button>
      <Button variant="ghost" disabled={pending} onClick={() => run(() => cancelDealAction(dealId), "Deal cancelled and buyer refunded")}>Cancel & refund buyer</Button>
    </div>
  );
}

export function TransferItem({ item, role, active }: { item: { id: string; label: string; description: string; inPlatform: boolean; sellerDoneAt: string | null; buyerReceivedAt: string | null; sellerNote: string | null; buyerNote: string | null }; role: Role; active: boolean }) {
  const { run, pending } = useRun();
  const [note, setNote] = useState("");
  const mine = role === "seller" ? item.sellerDoneAt : item.buyerReceivedAt;
  return (
    <li className="rounded-xl border border-border bg-white p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{item.label}</p>
          {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {item.inPlatform ? <span className="rounded-full bg-muted px-2 py-0.5">Moves automatically when the buyer confirms</span> : (
            <>
              <span className={cn("rounded-full border px-2 py-0.5", item.sellerDoneAt ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border")}>Seller: {item.sellerDoneAt ? "done" : "pending"}</span>
              <span className={cn("rounded-full border px-2 py-0.5", item.buyerReceivedAt ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border")}>Buyer: {item.buyerReceivedAt ? "received" : "pending"}</span>
            </>
          )}
        </div>
      </div>
      {item.sellerNote ? <p className="mt-2 text-xs"><b>Seller:</b> {item.sellerNote}</p> : null}
      {item.buyerNote ? <p className="mt-1 text-xs"><b>Buyer:</b> {item.buyerNote}</p> : null}
      {active && !item.inPlatform && role !== "admin" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input aria-label={`Note for ${item.label}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={role === "seller" ? "How was it transferred?" : "Optional note"} className="h-9 min-w-48 flex-1" />
          <Button size="sm" variant={mine ? "ghost" : "gradient"} disabled={pending} onClick={() => run(() => markItemAction(item.id, !mine, note), mine ? "Unmarked" : role === "seller" ? "Marked as transferred" : "Marked as received")}>
            {mine ? "Undo" : role === "seller" ? "Mark transferred" : "Mark received"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function ConfirmButton({ dealId, ready }: { dealId: string; ready: boolean }) {
  const { run, pending } = useRun();
  return (
    <div className="space-y-2">
      <Button variant="gradient" className="h-10" disabled={pending || !ready} onClick={() => run(() => confirmReceiptAction(dealId), "Confirmed. The project package is now in your account.")}>
        <CheckCircle2 /> Confirm I received everything
      </Button>
      {!ready ? <p className="text-xs text-muted-foreground">Mark every external item as received first.</p> : null}
    </div>
  );
}

export function DisputeForm({ dealId }: { dealId: string }) {
  const { run, pending } = useRun();
  const [reason, setReason] = useState("");
  return (
    <details className="rounded-xl border border-border bg-white p-4 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium text-destructive"><AlertTriangle className="size-4" /> Something wrong? Open a dispute</summary>
      <p className="mt-2 text-xs text-muted-foreground">A dispute freezes the payout until an admin resolves it.</p>
      <textarea aria-label="Dispute reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-input px-3 py-2" />
      <Button variant="outline" className="mt-2 rounded-[10px]" disabled={pending} onClick={() => run(() => openDisputeAction(dealId, reason), "Dispute opened")}>Open dispute</Button>
    </details>
  );
}

export function Messages({ dealId, messages }: { dealId: string; messages: { id: string; body: string; name: string | null; mine: boolean; at: string }[] }) {
  const { run, pending } = useRun();
  const [body, setBody] = useState("");
  return (
    <div className="space-y-3">
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {messages.map((m) => (
          <li key={m.id} className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", m.mine ? "ml-auto bg-[var(--plum)] text-white" : "border border-border bg-white")}>
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className={cn("mt-0.5 text-[10px]", m.mine ? "text-white/70" : "text-muted-foreground")}>{m.name ?? "User"} · {m.at.slice(0, 16).replace("T", " ")} UTC</p>
          </li>
        ))}
        {!messages.length ? <li className="text-sm text-muted-foreground">No messages yet.</li> : null}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!body.trim()) return; run(() => sendMessageAction(dealId, body)); setBody(""); }}>
        <Input aria-label="Message" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" />
        <Button type="submit" variant="outline" size="icon" aria-label="Send message" disabled={pending}><Send /></Button>
      </form>
    </div>
  );
}

export function ReviewForm({ dealId, otherName }: { dealId: string; otherName: string }) {
  const { run, pending } = useRun();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Rate {otherName}</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}>
            <Star className={cn("size-6", n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
          </button>
        ))}
      </div>
      <Input aria-label="Review comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" />
      <Button variant="outline" className="rounded-[10px]" disabled={pending} onClick={() => run(() => leaveReviewAction(dealId, rating, comment), "Thanks for the review")}>Submit review</Button>
    </div>
  );
}

