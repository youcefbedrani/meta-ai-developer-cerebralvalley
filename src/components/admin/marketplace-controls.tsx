"use client";

import { useState } from "react";
import { deleteListingAction, editListingAction, republishListingAction, stopDealAction } from "@/app/(app)/app/admin/actions";
import { useRun } from "@/components/marketplace/use-run";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Terms = { niche: string; price: number; earningMin: number; earningMax: number };

/** Edit a listing's public terms (niche, price, earning estimate) with a reason for the audit log. */
export function EditListingForm({ listingId, initial }: { listingId: string; initial: Terms }) {
  const { run, pending } = useRun();
  const [t, setT] = useState({ niche: initial.niche, price: String(initial.price), earningMin: String(initial.earningMin), earningMax: String(initial.earningMax), note: "" });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="adm-niche">Niche</Label>
        <Input id="adm-niche" value={t.niche} onChange={(e) => setT({ ...t, niche: e.target.value })} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="adm-price">Price</Label>
        <Input id="adm-price" inputMode="decimal" value={t.price} onChange={(e) => setT({ ...t, price: e.target.value })} className="mt-1.5" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="adm-emin">Earning low / mo</Label>
          <Input id="adm-emin" inputMode="decimal" value={t.earningMin} onChange={(e) => setT({ ...t, earningMin: e.target.value })} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="adm-emax">Earning high / mo</Label>
          <Input id="adm-emax" inputMode="decimal" value={t.earningMax} onChange={(e) => setT({ ...t, earningMax: e.target.value })} className="mt-1.5" />
        </div>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="adm-note">Reason for the change</Label>
        <Input id="adm-note" value={t.note} onChange={(e) => setT({ ...t, note: e.target.value })} placeholder="e.g. Earning estimate not supported by the seller's data" className="mt-1.5" />
      </div>
      <div className="sm:col-span-2">
        <Button size="sm" variant="gradient" disabled={pending || t.note.trim().length < 3} onClick={() => run(() => editListingAction(listingId, t), "Listing updated")}>Save changes</Button>
      </div>
    </div>
  );
}

export function RepublishButton({ listingId }: { listingId: string }) {
  const { run, pending } = useRun();
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => republishListingAction(listingId), "Listing is live again")}>Put back live</Button>;
}

export function DeleteListingButton({ listingId }: { listingId: string }) {
  const { run, pending, router } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>Delete listing…</Button>;
  return (
    <div className="flex flex-wrap gap-2">
      <Input aria-label="Reason for deleting" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (kept in the audit log)" className="h-9 min-w-56 flex-1" />
      <Button size="sm" variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => run(() => deleteListingAction(listingId, reason), "Listing deleted", () => router.replace("/app/admin/marketplace?tab=listings"))}>Delete permanently</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  );
}

/** Cancels a deal before payment, or refunds the buyer after payment. */
export function StopDealButton({ dealId, paid }: { dealId: string; paid: boolean }) {
  const { run, pending } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{paid ? "Refund & stop" : "Cancel deal"}</Button>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Input aria-label="Reason for stopping the deal" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="h-8 w-44" />
      <Button size="sm" variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => run(() => stopDealAction(dealId, reason), paid ? "Buyer refunded, deal stopped" : "Deal cancelled")}>Confirm</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>No</Button>
    </span>
  );
}
