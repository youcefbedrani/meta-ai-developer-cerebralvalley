"use client";

import { Bot, Brain, Check, CircleAlert, ExternalLink, Gavel, Loader2, RotateCcw, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { startAutopilotAction } from "@/app/(app)/app/(founder)/projects/[id]/autopilot/actions";
import { LogoMark } from "@/components/brand/logo";
import { ConfigErrorNotice } from "@/components/config-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AUTOPILOT_GOAL_MAX, AUTOPILOT_TOOLS, type AutopilotEvent, type AutopilotVerdict } from "@/lib/validation/autopilot";
import { cn } from "@/lib/utils";

type Run = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  goal: string | null;
  trace: AutopilotEvent[];
  verdict: AutopilotVerdict | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

type Props = {
  projectId: string;
  run: Run | null;
  /** Worst case: agent reasoning plus a full validation if the project has no research yet. */
  cost: number;
  balance: number;
  missing: { label: string; vars: string[] }[];
};

const DECISION_STYLE = {
  build: { label: "Build", className: "bg-success/15 text-success border-success/30" },
  pivot: { label: "Pivot", className: "bg-warning/15 text-warning border-warning/30" },
  drop: { label: "Drop", className: "bg-destructive/15 text-destructive border-destructive/30" },
} as const;

const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const seconds = (ms?: number) => (ms === undefined ? null : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`);

export function AutopilotPanel({ projectId, run, cost, balance, missing }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<{ message: string; missing?: string[] } | null>(null);
  const active = run && (run.status === "queued" || run.status === "running");

  // Poll while the agent works so each step shows up as it happens.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(id);
  }, [active, router]);

  function launch() {
    setError(null);
    start(async () => {
      const r = await startAutopilotAction(projectId, goal);
      if (!r.ok) {
        setError({ message: r.error, missing: r.code === "config" ? r.missing : undefined });
        return;
      }
      toast.success("Autopilot started");
      router.refresh();
    });
  }

  const blocked = missing.length > 0;
  return (
    <div className="space-y-6">
      {!active ? (
        <div className="surface ambient-glow p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
              <Bot className="size-4" />
            </span>
            <div>
              <p className="font-medium">{run ? "Run Autopilot again" : "Validation Autopilot"}</p>
              <p className="text-sm text-muted-foreground">
                An AI agent powered by Meta Muse Spark researches the market, checks open questions on the web, plans the product, sets up a waitlist test and
                decides Build, Pivot or Drop — citing a source for every reason. Up to {cost} credits · {balance} left
              </p>
            </div>
          </div>
          <Textarea
            className="mt-4"
            rows={2}
            maxLength={AUTOPILOT_GOAL_MAX}
            placeholder="Optional: what should the agent focus on? (e.g. “Would clinics pay $50/month?”)"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="gradient" className="h-10 px-5" onClick={launch} disabled={pending || blocked}>
              {pending ? <Loader2 className="animate-spin" /> : run?.status === "failed" ? <RotateCcw /> : <Sparkles />}
              {run ? "Start a new run" : "Start Autopilot"}
            </Button>
            <span className="text-xs text-muted-foreground">Takes 3–8 minutes. You can leave this page — it keeps running.</span>
          </div>
          {missing.map((m) => (
            <div key={m.label} className="mt-4">
              <ConfigErrorNotice title={`${m.label} is not configured`} missing={m.vars} />
            </div>
          ))}
          {error ? (
            error.missing ? (
              <div className="mt-4">
                <ConfigErrorNotice title={error.message} missing={error.missing} />
              </div>
            ) : (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error.message}
              </p>
            )
          ) : null}
        </div>
      ) : null}

      {run?.verdict ? <VerdictCard verdict={run.verdict} projectId={projectId} /> : null}
      {run?.status === "failed" ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> Last run failed: {run.error ?? "unknown error"}
        </p>
      ) : null}
      {run ? <Trace run={run} active={!!active} /> : null}
    </div>
  );
}

function Trace({ run, active }: { run: Run; active: boolean }) {
  return (
    <section className="surface p-6" aria-live="polite">
      <div className="flex items-center gap-3">
        {active ? <LogoMark animated className="size-8 shrink-0" /> : <Bot className="size-5 text-muted-foreground" />}
        <div>
          <p className="font-medium">{active ? "Autopilot is working" : "What the agent did"}</p>
          {run.goal ? <p className="text-sm text-muted-foreground">Focus: {run.goal}</p> : null}
        </div>
      </div>
      <ol className="mt-5 space-y-3 border-l border-border pl-5">
        {run.trace.map((e, i) => (
          <TraceItem key={i} event={e} last={active && i === run.trace.length - 1} />
        ))}
        {active && run.trace.length === 0 ? <li className="text-sm text-muted-foreground">Waiting for the worker…</li> : null}
      </ol>
    </section>
  );
}

function TraceItem({ event, last }: { event: AutopilotEvent; last: boolean }) {
  const Icon = event.kind === "thought" ? Brain : event.kind === "error" ? CircleAlert : event.kind === "verdict" ? Gavel : event.kind === "tool_result" ? Check : Wrench;
  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[29px] grid size-4 place-items-center rounded-full border bg-background",
          event.kind === "error" ? "border-destructive text-destructive" : event.kind === "tool_result" || event.kind === "verdict" ? "border-transparent bg-brand-gradient text-white" : "border-border text-muted-foreground",
        )}
      >
        <Icon className="size-2.5" />
      </span>
      <div className={cn("text-sm", event.kind === "thought" && "italic text-muted-foreground", event.kind === "error" && "text-destructive")}>
        {event.tool && event.kind === "tool_call" ? <span className="mr-2 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium not-italic text-foreground">{AUTOPILOT_TOOLS[event.tool] ?? event.tool}</span> : null}
        {event.title}
        {event.durationMs !== undefined ? <span className="ml-2 text-xs text-muted-foreground">{seconds(event.durationMs)}</span> : null}
        {last && event.kind === "tool_call" ? <Loader2 className="ml-2 inline size-3 animate-spin" /> : null}
      </div>
      {event.detail ? <p className="mt-0.5 text-sm text-muted-foreground">{event.detail}</p> : null}
    </li>
  );
}

function VerdictCard({ verdict, projectId }: { verdict: AutopilotVerdict; projectId: string }) {
  const style = DECISION_STYLE[verdict.decision];
  const groups = [
    { stance: "for" as const, title: "Evidence for" },
    { stance: "against" as const, title: "Evidence against" },
  ];
  return (
    <section className="surface ambient-glow p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("rounded-full border px-3 py-1 text-sm font-semibold", style.className)}>{style.label}</span>
        <span className="text-sm text-muted-foreground">{verdict.confidence}% confidence</span>
      </div>
      <h2 className="mt-3 text-xl font-semibold tracking-tight">{verdict.headline}</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {groups.map((g) => {
          const reasons = verdict.reasons.filter((r) => r.stance === g.stance);
          return (
            <div key={g.stance}>
              <h3 className="text-sm font-medium">{g.title}</h3>
              {reasons.length ? (
                <ul className="mt-2 space-y-3">
                  {reasons.map((r, i) => (
                    <li key={i} className="text-sm">
                      <p>{r.claim}</p>
                      <p className="mt-1 flex flex-wrap gap-2">
                        {r.sourceUrls.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            {domainOf(u)} <ExternalLink className="size-3" />
                          </a>
                        ))}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">None found.</p>
              )}
            </div>
          );
        })}
      </div>
      {verdict.pivotIdea ? (
        <p className="mt-5 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
          <span className="font-medium">Suggested pivot:</span> {verdict.pivotIdea}
        </p>
      ) : null}
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {verdict.risks.length ? (
          <div>
            <h3 className="text-sm font-medium">Risks</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {verdict.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <h3 className="text-sm font-medium">Next steps</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {verdict.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        Every reason above links to a source the agent read during this run
        {verdict.droppedReasons ? ` · ${verdict.droppedReasons} reason${verdict.droppedReasons === 1 ? "" : "s"} without a verifiable source removed` : ""} ·{" "}
        <Link href={`/app/projects/${projectId}/plan`} className="text-primary hover:underline">
          Plan
        </Link>{" "}
        ·{" "}
        <Link href="/app/lab/pages" className="text-primary hover:underline">
          Landing pages
        </Link>
      </p>
    </section>
  );
}
