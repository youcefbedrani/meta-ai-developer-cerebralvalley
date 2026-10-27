import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Part = { label: string; value: string | string[]; sourced: boolean };
type Status = "sourced" | "hypothesis" | "missing";

const CHIP: Record<Status, string> = {
  sourced: "bg-emerald-50 text-emerald-700",
  hypothesis: "bg-rose-50 text-rose-700",
  missing: "bg-muted text-muted-foreground",
};
const LABEL: Record<Status, string> = { sourced: "Sourced", hypothesis: "Hypothesis", missing: "Missing" };

const statusOf = (p: Part): Status => ((Array.isArray(p.value) ? p.value.length === 0 : !p.value.trim()) ? "missing" : p.sourced ? "sourced" : "hypothesis");

/**
 * The idea as a chain: problem → customer → today's alternatives → solution → edge → money.
 * Each link says whether it's backed by real sources, still a hypothesis, or missing,
 * and the next step that turns hypotheses into evidence.
 */
export function IdeaAnatomy({ parts, unknowns, projectId, ideaId }: { parts: Part[]; unknowns: string[]; projectId: string | null; ideaId: string }) {
  const statuses = parts.map(statusOf);
  const sourced = statuses.filter((s) => s === "sourced").length;
  const missing = parts.filter((_, i) => statuses[i] === "missing");
  return (
    <section className="surface p-5" aria-labelledby="idea-map-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="idea-map-title" className="font-medium">Idea map</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">How the idea fits together, and how much of it is proven.</p>
        </div>
        <p className="text-sm"><span className="text-2xl font-semibold tabular-nums">{sourced}</span><span className="text-muted-foreground"> / {parts.length} parts backed by sources</span></p>
      </div>
      <ol className="stagger mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {parts.map((p, i) => (
          <li key={p.label} className="relative">
            <div className={cn("h-full rounded-xl border p-3", statuses[i] === "missing" ? "border-dashed border-border bg-muted/30" : "border-border bg-white")}>
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{i + 1}. {p.label}</p>
              </div>
              <span className={cn("mt-1.5 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", CHIP[statuses[i]])}>{LABEL[statuses[i]]}</span>
              <p className="mt-1.5 line-clamp-4 text-xs leading-relaxed">{Array.isArray(p.value) ? p.value.join(" · ") || "—" : p.value || "—"}</p>
            </div>
            {i < parts.length - 1 ? <ChevronRight className="absolute -right-2.5 top-1/2 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-background text-muted-foreground lg:block" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-800">Unknown or missing ({unknowns.length + missing.length})</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {missing.map((m) => <li key={m.label}>{m.label} isn&apos;t defined yet.</li>)}
            {unknowns.map((u) => <li key={u}>{u}</li>)}
            {!unknowns.length && !missing.length ? <li className="list-none text-muted-foreground">Nothing listed.</li> : null}
          </ul>
        </div>
        <div className="rounded-xl border border-border p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Turn hypotheses into evidence</p>
          <p className="mt-1.5 text-muted-foreground">
            {projectId ? "This idea is a project. Its project map shows research, competitors and tests." : "Make it a project to research the market, map competitors and test it with real people."}
          </p>
          {projectId ? (
            <Link href={`/app/projects/${projectId}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Open project map <ArrowRight className="size-3" /></Link>
          ) : (
            <a href={`#idea-actions-${ideaId}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Use the actions above to convert it <ArrowRight className="size-3" /></a>
          )}
        </div>
      </div>
    </section>
  );
}
