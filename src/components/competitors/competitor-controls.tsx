"use client";

import { CircleAlert, Plus, Radar, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { addCompetitorAction, deleteCompetitorAction, startCompetitorScanAction } from "@/app/(app)/app/(founder)/projects/[id]/competitors/actions";
import { LogoLoader } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ScanJob = { status: "queued" | "running" | "succeeded" | "failed" | "cancelled"; currentStage: string | null; error: string | null; result: { added?: number; updated?: number; pricingKept?: number; sources?: number } | null; finishedAt: string | null } | null;

const STAGES: Record<string, string> = { queued: "Waiting for a worker", planning: "Planning searches", searching: "Searching the web", reading: "Reading sources", extracting: "Extracting competitor data", saving: "Saving" };

export function CompetitorScanPanel({ projectId, job, cost, balance, researchRunning }: { projectId: string; job: ScanJob; cost: number; balance: number; researchRunning: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = job && (job.status === "queued" || job.status === "running");

  // The scan runs on the worker: refresh while it's active so progress and results appear.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(id);
  }, [active, router]);

  const scan = () =>
    start(async () => {
      const r = await startCompetitorScanAction(projectId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Competitor scan started");
      router.refresh();
    });

  if (active) {
    return (
      <div className="surface flex flex-col items-center gap-2 p-6 text-center sm:flex-row sm:text-left">
        <LogoLoader label="" size="sm" />
        <div>
          <p className="font-medium">Scanning for competitors…</p>
          <p className="text-sm text-muted-foreground">{STAGES[job.currentStage ?? "queued"] ?? "Working"}. This takes about a minute; you can leave the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface ambient-glow p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow"><Radar className="size-4" /></span>
          <div>
            <p className="font-medium">Scan for competitors</p>
            <p className="text-sm text-muted-foreground">Searches the web for alternatives and pricing pages, then fills the gaps below. Only data found in a source is kept · {cost} credits · {balance} left</p>
          </div>
        </div>
        <Button variant="gradient" className="h-10 px-5" onClick={scan} disabled={pending || balance < cost || researchRunning}>
          <Radar /> {job?.status === "succeeded" ? "Scan again" : "Start scan"}
        </Button>
      </div>
      {researchRunning ? <p className="mt-3 text-sm text-muted-foreground">Research is running for this project. Scan when it finishes.</p> : null}
      {job?.status === "succeeded" && job.result ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Last scan{job.finishedAt ? ` (${job.finishedAt.slice(0, 10)})` : ""}: {job.result.added ?? 0} new, {job.result.updated ?? 0} updated, {job.result.pricingKept ?? 0} with verified pricing, from {job.result.sources ?? 0} sources.
        </p>
      ) : null}
      {job?.status === "failed" ? (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> Last scan failed: {job.error ?? "unknown error"}
        </p>
      ) : null}
    </div>
  );
}

export function AddCompetitorForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", website: "", type: "direct" as "direct" | "indirect" | "alternative", notes: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await addCompetitorAction(projectId, form);
      if (!r.ok) return void toast.error(Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error);
      toast.success("Competitor added");
      setForm({ name: "", website: "", type: "direct", notes: "" });
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus /> Add a competitor you know
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="surface grid gap-3 p-5 sm:grid-cols-2">
      <div>
        <Label htmlFor="comp-name">Name</Label>
        <Input id="comp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" required />
      </div>
      <div>
        <Label htmlFor="comp-website">Website (optional)</Label>
        <Input id="comp-website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="example.com" className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="comp-type">Type</Label>
        <select id="comp-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-white px-2 text-sm">
          <option value="direct">Direct: same product, same customer</option>
          <option value="indirect">Indirect: different product, same problem</option>
          <option value="alternative">Alternative: what people do instead</option>
        </select>
      </div>
      <div>
        <Label htmlFor="comp-notes">What you know (optional)</Label>
        <Textarea id="comp-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1.5" />
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">Shown as “added by you” until a scan finds it in a source. The next scan also looks up its pricing.</p>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" variant="gradient" size="sm" disabled={pending}>Add competitor</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function DeleteCompetitorButton({ projectId, competitorId, name }: { projectId: string; competitorId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <Button variant="ghost" size="icon" aria-label={`Remove ${name}`} onClick={() => setConfirm(true)}>
        <Trash2 className="size-4" />
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs">
      Remove?
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await deleteCompetitorAction(projectId, competitorId);
            if (!r.ok) return void toast.error(r.error);
            toast.success(`${name} removed`);
            router.refresh();
          })
        }
      >
        Yes
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>No</Button>
    </span>
  );
}
