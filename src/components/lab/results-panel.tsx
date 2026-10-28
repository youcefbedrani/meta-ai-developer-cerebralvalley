"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addResultAction, deleteResultAction } from "@/app/(app)/app/(founder)/lab/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NotesAnalysis } from "@/lib/validation/experiments";
import { AnalysisView, type AnalysisRecording } from "./interview-tools";

export type ResultItem = { id: string; metric: string; value: string | null; notes: string | null; recordedAt: string; analysis: NotesAnalysis | null; recording?: AnalysisRecording | null };

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export function ResultsPanel({ experimentId, results }: { experimentId: string; results: ResultItem[] }) {
  const router = useRouter();
  const [metric, setMetric] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await addResultAction(experimentId, { metric, value, notes });
      if (!r.ok) return setError(r.fieldErrors?.metric?.[0] ?? r.fieldErrors?.value?.[0] ?? r.error);
      setMetric("");
      setValue("");
      setNotes("");
      toast.success("Result recorded");
      router.refresh();
    });
  }

  return (
    <section className="surface p-6">
      <h2 className="font-medium">Results</h2>
      <p className="mt-1 text-sm text-muted-foreground">Record what actually happened: counts, quotes, observations. Only real results validate an idea.</p>
      <ul className="mt-4 space-y-3">
        {results.length ? (
          results.map((r) => (
            <li key={r.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {r.metric}
                    {r.value !== null ? <span className="ml-2 font-mono text-primary">{Number(r.value)}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmt.format(new Date(r.recordedAt))}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete result"
                  onClick={() =>
                    start(async () => {
                      const res = await deleteResultAction(r.id);
                      if (!res.ok) toast.error(res.error);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
              {r.analysis ? (
                <div className="mt-3"><AnalysisView analysis={r.analysis} recording={r.recording} /></div>
              ) : r.notes ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.notes}</p>
              ) : null}
              {r.analysis && r.notes ? (
                <details className="mt-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Original notes</summary>
                  <p className="mt-2 whitespace-pre-wrap">{r.notes}</p>
                </details>
              ) : null}
            </li>
          ))
        ) : (
          <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No results yet.</li>
        )}
      </ul>
      <form onSubmit={add} className="mt-5 space-y-3 border-t border-border pt-5" noValidate>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <div className="space-y-1.5">
            <Label htmlFor="r-metric">Metric</Label>
            <Input id="r-metric" value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="e.g. Interviews confirming the problem" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-value">Value (optional)</Label>
            <Input id="r-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 7" className="h-10" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-notes">Notes (optional)</Label>
          <Textarea id="r-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context, quotes, observations" />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" variant="outline" className="rounded-[10px]" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />} Add result
          </Button>
        </div>
      </form>
    </section>
  );
}
