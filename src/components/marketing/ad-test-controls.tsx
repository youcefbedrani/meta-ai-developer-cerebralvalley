"use client";

import { FlaskConical, Loader2, Pause, Play, Plus, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addChannelResultAction, deleteAdExperimentAction, linkAdExperimentToLabAction, setAdExperimentStatusAction } from "@/app/(app)/app/(founder)/marketing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdTestStatusControls({ id, status, labExperimentId, backHref }: { id: string; status: string; labExperimentId: string | null; backHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
      toast.success(ok);
      if (after) after();
      else router.refresh();
    });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "draft" || status === "stopped" || status === "completed" ? <Button variant="gradient" disabled={pending} onClick={() => run(() => setAdExperimentStatusAction(id, "running"), "Test started")}><Play /> {status === "draft" ? "Mark as running" : "Restart"}</Button> : null}
        {status === "running" ? (
          <>
            <Button variant="outline" className="rounded-[10px]" disabled={pending} onClick={() => run(() => setAdExperimentStatusAction(id, "completed", note), "Test completed")}><Square /> Complete</Button>
            <Button variant="outline" className="rounded-[10px]" disabled={pending} onClick={() => run(() => setAdExperimentStatusAction(id, "stopped", note), "Test stopped")}><Pause /> Stop early</Button>
          </>
        ) : null}
        {labExperimentId ? (
          <Link href={`/app/lab/${labExperimentId}`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-white px-3 text-sm"><FlaskConical className="size-4" /> Open in Validation Lab</Link>
        ) : (
          <Button variant="outline" className="rounded-[10px]" disabled={pending} onClick={() => run(() => linkAdExperimentToLabAction(id), "Linked to the Validation Lab")}><FlaskConical /> Track in Validation Lab</Button>
        )}
        <Button variant="ghost" disabled={pending} onClick={() => run(() => deleteAdExperimentAction(id), "Ad test deleted", () => router.push(backHref))}><Trash2 /> Delete</Button>
      </div>
      {status === "running" ? <Input aria-label="Decision note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: what did you decide and why?" className="h-9 max-w-lg" /> : null}
      {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** Logs one variant's numbers from the ad platform's dashboard. */
export function VariantResultForm({ projectId, experimentId, variantId, variantName, platform, channelId, currency }: { projectId: string; experimentId: string; variantId: string; variantName: string; platform: string; channelId: string | null; currency: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ periodStart: today(), periodEnd: today(), spend: "", impressions: "", clicks: "", signups: "", customers: "", revenue: "" });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await addChannelResultAction(projectId, { ...f, channel: platform, channelType: "paid", channelId, adExperimentId: experimentId, adVariantId: variantId });
          if (!r.ok) return setError(Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error);
          toast.success(`Logged results for ${variantName}`);
          setF((s) => ({ ...s, spend: "", impressions: "", clicks: "", signups: "", customers: "", revenue: "" }));
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor={`${variantId}-from`} className="text-xs">From</Label><Input id={`${variantId}-from`} type="date" value={f.periodStart} onChange={(e) => set("periodStart", e.target.value)} className="h-9" /></div>
        <div className="space-y-1"><Label htmlFor={`${variantId}-to`} className="text-xs">To</Label><Input id={`${variantId}-to`} type="date" value={f.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} className="h-9" /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([["spend", `Spend (${currency})`], ["impressions", "Impressions"], ["clicks", "Clicks"], ["signups", "Signups*"], ["customers", "Customers"], ["revenue", "Revenue"]] as const).map(([k, label]) => (
          <div key={k} className="space-y-1"><Label htmlFor={`${variantId}-${k}`} className="text-xs">{label}</Label><Input id={`${variantId}-${k}`} inputMode="decimal" value={f[k]} onChange={(e) => set(k, e.target.value)} className="h-9" /></div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">*Only if not tracked: signups via the variant&apos;s link are counted automatically.</p>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      <Button type="submit" variant="outline" size="sm" className="rounded-[10px]" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Plus />} Log results</Button>
    </form>
  );
}
