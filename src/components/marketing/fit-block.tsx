import { Target, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE = {
  primary: { label: "Primary channel", className: "bg-[var(--plum)] text-white" },
  test: { label: "Test channel", className: "border border-amber-200 bg-amber-50 text-amber-800" },
  later: { label: "Later", className: "border border-border text-muted-foreground" },
} as const;

/** Fit score, role, cost range (always an assumption) and risks for one channel. */
export function FitBlock({ c }: { c: { fitScore: number; fitReasons: string[]; costRange: string; risks: string[]; role: keyof typeof ROLE } }) {
  return (
    <div className="mt-4 grid gap-4 rounded-xl border border-border bg-white p-4 text-sm md:grid-cols-[auto_1fr_1fr]">
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-baseline gap-1"><span className="text-2xl font-semibold">{c.fitScore}</span><span className="text-xs text-muted-foreground">/10 fit</span></div>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px]", ROLE[c.role].className)}>{ROLE[c.role].label}</span>
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><Target className="size-3.5" /> Why it fits</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">{c.fitReasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Cost range <span className="normal-case tracking-normal">(assumption to test)</span></p>
        <p className="mt-1">{c.costRange}</p>
        {c.risks.length ? (
          <>
            <p className="mt-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><TriangleAlert className="size-3.5" /> Risks</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">{c.risks.map((r) => <li key={r}>{r}</li>)}</ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
