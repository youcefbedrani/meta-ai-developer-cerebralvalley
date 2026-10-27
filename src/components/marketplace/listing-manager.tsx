"use client";

import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { checkReadinessAction, decideAccessAction, draftTeaserAction, submitListingAction, unpublishListingAction } from "@/app/(app)/app/marketplace/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Teaser } from "@/lib/validation/marketplace";
import { cn } from "@/lib/utils";
import { useRun } from "./use-run";

type Check = { id: string; label: string; ok: boolean; detail?: string };
const EMPTY: Teaser = { title: "", problem: "", market: "", solution: "", highlights: [], idealBuyer: "" };

export function TeaserEditor({ listingId, initial, editable, cost, aiDraft = true }: { listingId: string; initial: Partial<Teaser>; editable: boolean; cost: number; aiDraft?: boolean }) {
  const { run, pending, router } = useRun();
  const [t, setT] = useState<Teaser>({ ...EMPTY, ...initial });
  const [own, setOwn] = useState(false);
  const [orig, setOrig] = useState(false);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const set = <K extends keyof Teaser>(k: K, v: Teaser[K]) => setT((x) => ({ ...x, [k]: v }));

  return (
    <section className="surface space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium">Details for buyers</h2>
          <p className="text-sm text-muted-foreground">Hidden from the public. Only buyers who sign the NDA and get access (or make an offer) see this. No personal data.</p>
        </div>
        {editable && aiDraft ? (
          <Button variant="outline" className="rounded-[10px]" disabled={pending} onClick={() => run(() => draftTeaserAction(listingId), "Teaser drafted. Review and edit it.", (d) => setT(d))}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Draft with AI · {cost} credits
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3">
        <div className="space-y-1"><Label htmlFor="t-title">Title</Label><Input id="t-title" value={t.title} onChange={(e) => set("title", e.target.value)} disabled={!editable} /></div>
        {(["problem", "market", "solution", "idealBuyer"] as const).map((k) => (
          <div key={k} className="space-y-1">
            <Label htmlFor={`t-${k}`}>{k === "idealBuyer" ? "Ideal buyer" : k[0].toUpperCase() + k.slice(1)}</Label>
            <textarea id={`t-${k}`} value={t[k]} onChange={(e) => set(k, e.target.value)} disabled={!editable} rows={2} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm disabled:opacity-70" />
          </div>
        ))}
        <div className="space-y-1">
          <Label htmlFor="t-high">Highlights (one per line)</Label>
          <textarea id="t-high" value={t.highlights.join("\n")} onChange={(e) => set("highlights", e.target.value.split("\n").filter((s) => s.trim()))} disabled={!editable} rows={3} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm disabled:opacity-70" />
        </div>
      </div>

      {editable ? (
        <div className="space-y-3 border-t border-border pt-4">
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} className="mt-1" /> I own these assets (or hold the rights to transfer them), and the waitlist emails I&apos;m including were collected with consent.</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={orig} onChange={(e) => setOrig(e.target.checked)} className="mt-1" /> This is my original work, not copied from someone else.</label>
          {checks ? (
            <ul className="space-y-1 rounded-xl border border-border bg-white p-3 text-sm" aria-label="Readiness checks">
              {checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  {c.ok ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <X className="mt-0.5 size-4 shrink-0 text-destructive" />}
                  <span className={cn(!c.ok && "text-destructive")}>{c.label}{c.detail ? `: ${c.detail}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" className="rounded-[10px]" disabled={pending} onClick={() => run(() => checkReadinessAction(listingId, t, { ownershipConfirmed: own, originalWorkDeclared: orig }), undefined, (d) => setChecks(d.checks))}>Run readiness checks</Button>
            <Button
              variant="gradient"
              disabled={pending || !own || !orig}
              onClick={() =>
                run(
                  () => submitListingAction(listingId, { teaser: t, ownershipConfirmed: own, originalWorkDeclared: orig }),
                  undefined,
                  (d) => {
                    toast.success(d.published ? "Your listing is live on the marketplace" : d.flagged ? "Submitted for review: it looks similar to another listing, so an admin will check it" : "Submitted for review");
                    router.refresh();
                  },
                )
              }
            >
              Publish listing
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function UnpublishButton({ listingId }: { listingId: string }) {
  const { run, pending } = useRun();
  return <Button variant="outline" className="rounded-[10px]" disabled={pending} onClick={() => run(() => unpublishListingAction(listingId), "Listing unpublished")}>Unpublish</Button>;
}

export function AccessDecision({ accessId }: { accessId: string }) {
  const { run, pending } = useRun();
  return (
    <span className="flex gap-1">
      <Button size="sm" variant="gradient" disabled={pending} onClick={() => run(() => decideAccessAction(accessId, true), "Access granted")}>Grant</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => decideAccessAction(accessId, false), "Declined")}>Decline</Button>
    </span>
  );
}
