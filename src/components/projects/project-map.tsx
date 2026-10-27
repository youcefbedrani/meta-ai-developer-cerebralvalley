import { ArrowRight, Check, ChevronRight, CircleDashed, CircleDot } from "lucide-react";
import Link from "next/link";
import { mapProgress, topGaps, type MapNode, type MapPhase, type NodeStatus, type ProjectCounts } from "@/lib/project-map";
import { cn } from "@/lib/utils";

const STATUS: Record<NodeStatus, { label: string; icon: typeof Check; ring: string; chip: string }> = {
  done: { label: "Done", icon: Check, ring: "border-emerald-200 bg-white", chip: "bg-emerald-500 text-white" },
  partial: { label: "Started", icon: CircleDot, ring: "border-amber-200 bg-white", chip: "bg-amber-100 text-amber-800" },
  missing: { label: "Missing", icon: CircleDashed, ring: "border-dashed border-border bg-muted/30", chip: "bg-muted text-muted-foreground" },
};

function StatusChip({ status }: { status: NodeStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", s.chip)}>
      <s.icon className="size-3" aria-hidden="true" /> {s.label}
    </span>
  );
}

function Node({ n }: { n: MapNode }) {
  return (
    <div className={cn("rounded-xl border p-3 text-sm", STATUS[n.status].ring)}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{n.label}</p>
        <StatusChip status={n.status} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{n.metric}</p>
      {n.status !== "done" ? (
        <>
          <p className="mt-2 text-xs">{n.missing}</p>
          <Link href={n.href} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {n.cta} <ArrowRight className="size-3" />
          </Link>
        </>
      ) : null}
    </div>
  );
}

/**
 * The project as a left-to-right map: Discover → Validate → Build → Grow, each step marked
 * done / started / missing from real data, with the next thing to do on every gap.
 */
export function ProjectMap({ phases }: { phases: MapPhase[] }) {
  const p = mapProgress(phases);
  const gaps = topGaps(phases);
  return (
    <section className="surface p-5" aria-labelledby="project-map-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="project-map-title" className="font-medium">Project map</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">What this project has, what&apos;s started and what&apos;s still missing. Built from your real data only.</p>
        </div>
        <p className="text-sm">
          <span className="text-2xl font-semibold tabular-nums">{p.done}</span>
          <span className="text-muted-foreground"> / {p.total} steps done{p.partial ? ` · ${p.partial} started` : ""}</span>
        </p>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${p.done} done, ${p.partial} started, ${p.total - p.done - p.partial} missing`}>
        <div className="bar-grow flex w-full">
          <div className="bg-emerald-500" style={{ width: `${(p.done / p.total) * 100}%` }} />
          <div className="ml-[2px] bg-amber-300" style={{ width: `${(p.partial / p.total) * 100}%` }} />
        </div>
      </div>

      {gaps.length ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">Fill these next</p>
          <ol className="mt-2 space-y-1.5 text-sm">
            {gaps.map((g, i) => (
              <li key={g.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="tabular-nums text-amber-900">{i + 1}.</span>
                <span className="font-medium">{g.label}:</span>
                <span className="text-muted-foreground">{g.missing}</span>
                <Link href={g.href} className="text-xs font-medium text-primary hover:underline">{g.cta} →</Link>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Every step has real data. Keep measuring and double down on what works.</p>
      )}

      <div className="stagger mt-5 grid gap-3 lg:grid-flow-col lg:auto-cols-fr">
        {phases.map((phase, i) => (
          <div key={phase.id} className="relative">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full bg-[var(--plum)] text-[10px] font-semibold text-white">{i + 1}</span>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{phase.label}</p>
              {i < phases.length - 1 ? <ChevronRight className="ml-auto hidden size-4 text-muted-foreground lg:block" aria-hidden="true" /> : null}
            </div>
            <div className="space-y-2">
              {phase.nodes.map((n) => (
                <Node key={n.id} n={n} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const KINDS = [
  { key: "facts", label: "FACT", hint: "backed by a source", bar: "bg-emerald-500" },
  { key: "analysis", label: "ANALYSIS", hint: "reasoning from facts", bar: "bg-violet-500" },
  { key: "assumptions", label: "ASSUMPTION", hint: "needs testing", bar: "bg-rose-500" },
] as const;

/** How much of the research is sourced fact vs reasoning vs untested assumption. */
export function EvidenceMix({ counts }: { counts: ProjectCounts }) {
  const total = counts.facts + counts.analysis + counts.assumptions;
  return (
    <section className="surface p-5">
      <h2 className="font-medium">What the research is built on</h2>
      {total ? (
        <>
          <div className="bar-grow mt-3 flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={KINDS.map((k) => `${counts[k.key]} ${k.label}`).join(", ")}>
            {KINDS.map((k) => (counts[k.key] ? <div key={k.key} className={k.bar} style={{ width: `${(counts[k.key] / total) * 100}%` }} /> : null))}
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {KINDS.map((k) => (
              <li key={k.key} className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-sm", k.bar)} aria-hidden="true" />
                <span className="font-mono text-[11px] font-semibold">{k.label}</span>
                <span className="text-muted-foreground">{k.hint}</span>
                <span className="ml-auto tabular-nums">{counts[k.key]}</span>
              </li>
            ))}
          </ul>
          {counts.assumptions ? <p className="mt-3 text-xs text-muted-foreground">{counts.assumptions} assumption{counts.assumptions === 1 ? "" : "s"} still need a real test before you rely on them.</p> : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No research yet. Statements appear here once a report is generated.</p>
      )}
    </section>
  );
}

const RATING_LABELS: Record<string, string> = {
  demandEvidence: "Demand evidence",
  competitivePressure: "Competitive pressure",
  feasibility: "Feasibility",
  monetization: "Monetization",
};

/** The report's four separate 1–5 ratings as meters (never one combined "success score"). */
export function RatingMeters({ ratings }: { ratings: Record<string, { score: number; label?: string; justification: string }> | null }) {
  if (!ratings) return null;
  return (
    <section className="surface p-5">
      <h2 className="font-medium">Research ratings</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Four separate ratings from the latest report. Hover for the reason.</p>
      <ul className="mt-3 space-y-2.5">
        {Object.entries(RATING_LABELS).map(([key, label]) => {
          const r = ratings[key];
          if (!r) return null;
          return (
            <li key={key} title={r.justification}>
              <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="tabular-nums text-muted-foreground">{r.score}/5{r.label ? ` · ${r.label}` : ""}</span>
              </div>
              <div className="mt-1 flex gap-[2px]" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= r.score ? "bg-[var(--plum)]" : "bg-muted")} />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
