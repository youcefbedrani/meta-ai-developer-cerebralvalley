"use client";

import { Check, CircleAlert, Loader2, RotateCcw, SearchCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { startResearchAction } from "@/app/(app)/app/(founder)/projects/[id]/research/actions";
import { LogoMark } from "@/components/brand/logo";
import { ConfigErrorNotice } from "@/components/config-error";
import { Button } from "@/components/ui/button";
import { RESEARCH_STAGES } from "@/lib/validation/research";
import { cn } from "@/lib/utils";

type Job = { id: string; status: "queued" | "running" | "succeeded" | "failed" | "cancelled"; currentStage: string | null; error: string | null; createdAt: string };

type Props = {
  projectId: string;
  job: Job | null;
  hasReport: boolean;
  cost: number;
  balance: number;
  missing: { label: string; vars: string[] }[];
};

export function ResearchRunner({ projectId, job, hasReport, cost, balance, missing }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ message: string; missing?: string[] } | null>(null);
  const active = job && (job.status === "queued" || job.status === "running");

  // Poll while a job is active so the page reflects real progress from the worker.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(id);
  }, [active, router]);

  function run() {
    setError(null);
    start(async () => {
      const r = await startResearchAction(projectId);
      if (!r.ok) {
        setError({ message: r.error, missing: r.code === "config" ? r.missing : undefined });
        return;
      }
      toast.success("Research started");
      router.refresh();
    });
  }

  if (active) {
    const idx = Math.max(0, RESEARCH_STAGES.findIndex((s) => s.key === job.currentStage));
    return (
      <div className="surface p-6" aria-live="polite">
        <div className="flex items-center gap-3">
          <LogoMark animated className="size-10 shrink-0" />
          <div>
            <p className="font-medium">Research in progress</p>
            <p className="text-sm text-muted-foreground">This usually takes one to three minutes. You can leave this page — it keeps running.</p>
          </div>
        </div>
        <ol className="mt-5 grid gap-2 sm:grid-cols-2">
          {RESEARCH_STAGES.map((s, i) => (
            <li key={s.key} className={cn("flex items-center gap-2.5 text-sm", i > idx && "text-muted-foreground/60")}>
              <span className={cn("grid size-5 place-items-center rounded-full border", i < idx ? "border-transparent bg-brand-gradient text-white" : i === idx ? "border-primary" : "border-border")}>
                {i < idx ? <Check className="size-3" /> : i === idx ? <span className="size-1.5 animate-pulse rounded-full bg-primary" /> : null}
              </span>
              {s.label}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const blocked = missing.length > 0;
  return (
    <div className="surface ambient-glow p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
            <SearchCheck className="size-4" />
          </span>
          <div>
            <p className="font-medium">{hasReport ? "Run research again" : "Research this idea"}</p>
            <p className="text-sm text-muted-foreground">
              Searches the web, reads sources, extracts quotes and writes a cited report · {cost} credits · {balance} left
            </p>
          </div>
        </div>
        <Button variant="gradient" className="h-10 px-5" onClick={run} disabled={pending || blocked || balance < cost}>
          {pending ? <Loader2 className="animate-spin" /> : job?.status === "failed" ? <RotateCcw /> : <SearchCheck />}
          {job?.status === "failed" ? "Retry research" : hasReport ? "Re-run research" : "Start research"}
        </Button>
      </div>
      {job?.status === "failed" ? (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> Last run failed: {job.error ?? "unknown error"}
        </p>
      ) : null}
      {balance < cost ? <p className="mt-3 text-sm text-warning">Not enough credits this month.</p> : null}
      {missing.map((m) => (
        <div key={m.label} className="mt-4">
          <ConfigErrorNotice title={`${m.label} is not configured`} missing={m.vars} />
        </div>
      ))}
      {error ? (
        error.missing ? <div className="mt-4"><ConfigErrorNotice title={error.message} missing={error.missing} /></div> : <p role="alert" className="mt-4 text-sm text-destructive">{error.message}</p>
      ) : null}
    </div>
  );
}
