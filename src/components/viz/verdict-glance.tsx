"use client";

import { CountUp } from "@/components/motion/count-up";
import type { AutopilotVerdict } from "@/lib/validation/autopilot";
import { cn } from "@/lib/utils";

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** Swatch that ties the evidence lists below to their block in the balance bar. */
export function StanceSwatch({ stance, className }: { stance: "for" | "against"; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2.5 rounded-[3px]", className)} style={{ background: stance === "for" ? "var(--viz-for)" : "var(--viz-against)" }} />;
}

/**
 * The verdict at a glance, before the reader gets to the text: how sure the agent is (a meter), how the evidence
 * splits (one bar, for vs against, counts printed on it) and how many sources back it.
 */
export function VerdictGlance({ verdict }: { verdict: AutopilotVerdict }) {
  const pro = verdict.reasons.filter((r) => r.stance === "for").length;
  const con = verdict.reasons.length - pro;
  const urls = [...new Set(verdict.reasons.flatMap((r) => r.sourceUrls))];
  const sites = new Set(urls.map(host).filter(Boolean)).size;
  const blocks = [
    { stance: "for" as const, n: pro, label: "for" },
    { stance: "against" as const, n: con, label: "against" },
  ].filter((b) => b.n > 0);

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-card/60 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Confidence</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
          <CountUp value={verdict.confidence} />%
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/15" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={verdict.confidence} aria-label="Confidence">
          <div className="viz-grow-x h-full rounded-full bg-primary" style={{ width: `${verdict.confidence}%` }} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Evidence</p>
        <div className="mt-2 flex h-7 gap-0.5" role="img" aria-label={`${pro} reasons for, ${con} against`}>
          {blocks.map((b, i) => (
            <div
              key={b.stance}
              title={`${b.n} ${b.label}`}
              className={cn("viz-grow-x flex min-w-0 basis-0 items-center justify-center overflow-hidden whitespace-nowrap rounded text-xs font-semibold", b.stance === "for" ? "text-white" : "text-[#2b1400]")}
              style={{ flexGrow: b.n, background: b.stance === "for" ? "var(--viz-for)" : "var(--viz-against)", animationDelay: `${0.15 + i * 0.25}s` }}
            >
              {b.n} {b.label}
            </div>
          ))}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><StanceSwatch stance="for" /> For</span>
          <span className="inline-flex items-center gap-1.5"><StanceSwatch stance="against" /> Against</span>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sources</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
          <CountUp value={urls.length} />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          from {sites} site{sites === 1 ? "" : "s"}, each read during this run
        </p>
      </div>
    </div>
  );
}
