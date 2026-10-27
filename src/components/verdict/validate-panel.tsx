"use client";

import { CheckCircle2, CircleAlert, CircleDashed, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import { startValidationAction } from "@/app/(app)/app/(founder)/projects/[id]/actions";
import { LogoLoader } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Step = { label: string; status: "queued" | "running" | "succeeded" | "failed" | "cancelled"; error: string | null };

/** One click: research + competitors + market voices. Shows each step's progress while the worker runs them. */
export function ValidatePanel({ projectId, steps, cost, separateCost, balance, hasVerdict, plan }: { projectId: string; steps: Step[] | null; cost: number; separateCost: number; balance: number; hasVerdict: boolean; plan: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = !!steps?.some((s) => s.status === "queued" || s.status === "running");
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [active, router]);

  if (active && steps) {
    return (
      <section className="surface p-5" aria-live="polite">
        <div className="flex items-center gap-4">
          <LogoLoader label="" size="sm" />
          <div>
            <p className="font-medium">Validating your idea…</p>
            <p className="text-sm text-muted-foreground">About 3 minutes. You can leave this page; the verdict appears here when it&apos;s done.</p>
          </div>
        </div>
        <ol className="stagger mt-4 grid gap-2 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.label} className={cn("flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm transition-colors", s.status === "running" && "shimmer border-primary/50 bg-primary/5", s.status === "succeeded" && "border-success/30")}>
              <StepIcon status={s.status} />
              <span>
                {i + 1}. {s.label}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{statusText(s.status)}</span>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const failed = steps?.filter((s) => s.status === "failed") ?? [];
  const short = balance < cost;
  return (
    <section className="surface ambient-glow p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="animate-glow-pulse grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="font-medium">{hasVerdict ? "Re-validate with fresh data" : "Validate my idea"}</p>
            <p className="text-sm text-muted-foreground">
              Researches the market, scans competitors and their prices, and collects what real people say on Reddit, Quora, YouTube and more. Ends with a Go / Pivot / Drop verdict.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {cost} credits (instead of {separateCost} separately) · {balance} left
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
          <Button
            variant="gradient"
            className="h-10 px-5"
            disabled={pending || short}
            onClick={() =>
              start(async () => {
                const r = await startValidationAction(projectId);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Validation started");
                router.refresh();
              })
            }
          >
            <Sparkles /> {hasVerdict ? "Validate again" : "Validate my idea"}
          </Button>
          {short ? (
            <Link href="/app/settings#billing" className="text-center text-xs font-medium text-primary hover:underline">
              Not enough credits: {plan === "free" ? "upgrade or buy a pack" : "buy a credit pack"}
            </Link>
          ) : null}
        </div>
      </div>
      {failed.length ? (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Last run: {failed.map((f) => `${f.label} failed (${f.error ?? "unknown error"})`).join("; ")}. Credits for the failed step{failed.length === 1 ? " were" : "s were"} refunded.
          </span>
        </p>
      ) : null}
    </section>
  );
}

function StepIcon({ status }: { status: Step["status"] }) {
  if (status === "succeeded") return <CheckCircle2 className="animate-pop size-4 text-success" />;
  if (status === "failed" || status === "cancelled") return <CircleAlert className="size-4 text-destructive" />;
  if (status === "running") return <Loader2 className="size-4 animate-spin text-primary" />;
  return <CircleDashed className="size-4 text-muted-foreground" />;
}

const statusText = (s: Step["status"]) => ({ queued: "Waiting", running: "Working", succeeded: "Done", failed: "Failed", cancelled: "Cancelled" })[s];
