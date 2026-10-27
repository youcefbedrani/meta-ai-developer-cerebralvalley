"use client";

import { useState } from "react";
import { adminUnpublishAction, banUserAction, closeReportAction, resolveDisputeAction, reviewListingAction } from "@/app/(app)/app/marketplace/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRun } from "./use-run";

export function ReviewActions({ listingId }: { listingId: string }) {
  const { run, pending } = useRun();
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input aria-label="Review note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the seller (required to reject)" className="h-9 min-w-56 flex-1" />
      <Button size="sm" variant="gradient" disabled={pending} onClick={() => run(() => reviewListingAction(listingId, true, note), "Listing approved")}>Approve</Button>
      <Button size="sm" variant="outline" disabled={pending || note.trim().length < 3} onClick={() => run(() => reviewListingAction(listingId, false, note), "Listing rejected")}>Reject</Button>
    </div>
  );
}

export function UnpublishAction({ listingId }: { listingId: string }) {
  const { run, pending } = useRun();
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => adminUnpublishAction(listingId, "Unpublished after a report."), "Unpublished")}>Unpublish listing</Button>;
}

export function BanAction({ userId, banned }: { userId: string; banned: boolean }) {
  const { run, pending } = useRun();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => banUserAction(userId, !banned), banned ? "User reinstated" : "User suspended")}>{banned ? "Lift suspension" : "Suspend seller"}</Button>;
}

export function ReportActions({ reportId }: { reportId: string }) {
  const { run, pending } = useRun();
  return (
    <span className="flex gap-1">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => closeReportAction(reportId, false), "Report dismissed")}>Dismiss</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => closeReportAction(reportId, true), "Marked as actioned")}>Mark actioned</Button>
    </span>
  );
}

export function DisputeActions({ disputeId, canResume }: { disputeId: string; canResume: boolean }) {
  const { run, pending } = useRun();
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input aria-label="Resolution note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note" className="h-9 min-w-56 flex-1" />
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => resolveDisputeAction(disputeId, "refund", note), "Buyer refunded")}>Refund buyer</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => resolveDisputeAction(disputeId, "release", note), "Released to seller")}>Release to seller</Button>
      {canResume ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => resolveDisputeAction(disputeId, "continue", note), "Deal resumed")}>Resume deal</Button> : null}
    </div>
  );
}
