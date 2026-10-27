"use client";

import { CheckCircle2, Loader2, Play, RotateCcw, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { completeExperimentAction, deleteExperimentAction, experimentStatusAction } from "@/app/(app)/app/(founder)/lab/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = { id: string; status: "planned" | "running" | "completed" | "cancelled"; successCriteria: string; resultCount: number };

export function ExperimentControls({ id, status, successCriteria, resultCount }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [passed, setPassed] = useState<boolean | null>(null);
  const [learnings, setLearnings] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const r = await fn();
      if (r && !r.ok) toast.error(r.error);
      else {
        if (msg) toast.success(msg);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "planned" ? (
        <Button variant="outline" className="rounded-[10px]" disabled={pending} onClick={() => act(() => experimentStatusAction(id, "start"), "Experiment started")}>
          <Play /> Start
        </Button>
      ) : null}
      {status === "planned" || status === "running" ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="gradient" className="h-9 px-4" />}>
            <CheckCircle2 /> Record outcome
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Record the outcome</DialogTitle>
              <DialogDescription>
                Compare your results with the success criteria you set: <span className="text-foreground">{successCriteria}</span>
                {resultCount === 0 ? <span className="mt-2 block text-warning">You haven&apos;t recorded any results yet.</span> : null}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Did it pass?">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  role="radio"
                  aria-checked={passed === v}
                  onClick={() => setPassed(v)}
                  className={cn("flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm", passed === v && (v ? "border-emerald-400 bg-emerald-50" : "border-rose-400 bg-rose-50"))}
                >
                  {v ? <CheckCircle2 className="size-4 text-emerald-700" /> : <XCircle className="size-4 text-rose-700" />}
                  {v ? "Met the criteria" : "Did not meet them"}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="learnings">Learnings</Label>
              <Textarea id="learnings" rows={4} value={learnings} onChange={(e) => setLearnings(e.target.value)} placeholder="What did you learn? What surprised you?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next">Next action</Label>
              <Input id="next" value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="What will you do next?" />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
              <Button
                variant="gradient"
                className="px-4"
                disabled={passed === null || pending}
                onClick={() =>
                  start(async () => {
                    const r = await completeExperimentAction(id, { passed, learnings, nextAction });
                    if (!r.ok) return setError(r.fieldErrors?.learnings?.[0] ?? r.error);
                    setOpen(false);
                    toast.success("Outcome recorded");
                    router.refresh();
                  })
                }
              >
                {pending ? <Loader2 className="animate-spin" /> : null} Save outcome
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {status === "completed" || status === "cancelled" ? (
        <Button variant="outline" className="rounded-[10px]" disabled={pending} onClick={() => act(() => experimentStatusAction(id, "reopen"), "Experiment reopened")}>
          <RotateCcw /> Reopen
        </Button>
      ) : null}
      {status === "planned" || status === "running" ? (
        <Button variant="ghost" className="rounded-[10px]" disabled={pending} onClick={() => act(() => experimentStatusAction(id, "cancel"), "Experiment cancelled")}>
          Cancel experiment
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete experiment"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Delete this experiment and its results?")) act(() => deleteExperimentAction(id));
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
