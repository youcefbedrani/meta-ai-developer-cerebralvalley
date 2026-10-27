"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setDecisionAction } from "@/app/(app)/app/(founder)/lab/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Decision = "build" | "pivot" | "drop";
const OPTIONS: { value: Decision; label: string; hint: string }[] = [
  { value: "build", label: "Build", hint: "Evidence supports it. Move to planning." },
  { value: "pivot", label: "Pivot", hint: "Change customer, problem or pricing and re-test." },
  { value: "drop", label: "Drop", hint: "Archive the project and move on." },
];

export function DecisionPanel({ projectId, current, note, summary }: { projectId: string; current: Decision | null; note: string | null; summary: { completed: number; passed: number; failed: number; running: number } }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Decision | null>(current);
  const [text, setText] = useState(note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canBuild = summary.passed > 0;

  return (
    <section className="surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Decision</h2>
        <p className="text-xs text-muted-foreground">
          {summary.completed} completed · {summary.passed} passed · {summary.failed} failed · {summary.running} running
        </p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Decide based on experiments you ran — not on a report.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Decision">
        {OPTIONS.map((o) => {
          const disabled = o.value === "build" && !canBuild;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={choice === o.value}
              aria-disabled={disabled}
              onClick={() => !disabled && setChoice(o.value)}
              className={cn("rounded-xl border border-border p-3 text-left transition-colors", choice === o.value && "border-primary/60 bg-primary/10", disabled ? "cursor-not-allowed opacity-50" : "hover:border-primary/40")}
            >
              <p className="font-medium">{o.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{disabled ? "Needs at least one passed experiment." : o.hint}</p>
            </button>
          );
        })}
      </div>
      <Textarea className="mt-3" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Why? What evidence drove this decision?" />
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{current ? <>Current decision: <span className="capitalize text-foreground">{current}</span></> : "No decision yet."}</p>
        <Button
          variant="gradient"
          className="h-9 px-4"
          disabled={!choice || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await setDecisionAction(projectId, { decision: choice, note: text });
              if (!r.ok) return setError(r.error);
              toast.success("Decision saved");
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : null} Save decision
        </Button>
      </div>
    </section>
  );
}
