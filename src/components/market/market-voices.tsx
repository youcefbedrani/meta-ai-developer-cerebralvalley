"use client";

import { CircleAlert, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import { startMarketVoicesAction } from "@/app/(app)/app/(founder)/projects/[id]/language/actions";
import { LogoLoader } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

type Job = { status: "queued" | "running" | "succeeded" | "failed" | "cancelled"; currentStage: string | null; error: string | null; finishedAt: string | null; saved: number | null } | null;
const STAGES: Record<string, string> = { queued: "Waiting for a worker", planning: "Choosing search phrases", searching: "Searching each platform", reading: "Reading public posts", extracting: "Pulling out real quotes", saving: "Saving" };

/** Starts a market-voices scan and shows its progress while the worker runs it. */
export function MarketVoicesPanel({ projectId, job, cost, balance, busy }: { projectId: string; job: Job; cost: number; balance: number; busy: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = job && (job.status === "queued" || job.status === "running");
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(id);
  }, [active, router]);

  if (active) {
    return (
      <div className="surface flex flex-col items-center gap-2 p-6 text-center sm:flex-row sm:text-left">
        <LogoLoader label="" size="sm" />
        <div>
          <p className="font-medium">Listening to the market…</p>
          <p className="text-sm text-muted-foreground">{STAGES[job.currentStage ?? "queued"] ?? "Working"}. About a minute; you can leave the page.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="surface ambient-glow p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow"><Globe className="size-4" /></span>
          <div>
            <p className="font-medium">Research the market across platforms</p>
            <p className="text-sm text-muted-foreground">Searches Reddit, Quora, YouTube, Facebook, X, LinkedIn, TikTok, Hacker News, Indie Hackers, Product Hunt, review sites and Stack Exchange, and keeps only real quotes with links · {cost} credits · {balance} left</p>
          </div>
        </div>
        <Button
          variant="gradient"
          className="h-10 px-5"
          disabled={pending || busy || balance < cost}
          onClick={() =>
            start(async () => {
              const r = await startMarketVoicesAction(projectId);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Market research started");
              router.refresh();
            })
          }
        >
          <Globe /> {job?.status === "succeeded" ? "Scan again" : "Start scan"}
        </Button>
      </div>
      {busy ? <p className="mt-3 text-sm text-muted-foreground">Another scan or research is running for this project. Start this when it finishes.</p> : null}
      {job?.status === "succeeded" ? <p className="mt-3 text-sm text-muted-foreground">Last scan{job.finishedAt ? ` (${job.finishedAt.slice(0, 10)})` : ""}: {job.saved ?? 0} new quotes saved.</p> : null}
      {job?.status === "failed" ? (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> Last scan failed: {job.error ?? "unknown error"}
        </p>
      ) : null}
    </div>
  );
}
