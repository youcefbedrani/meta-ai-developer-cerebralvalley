import { ArrowRight, Check, ChevronDown, Coins, Info, ListChecks, PackageCheck, Target } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { resolveLink, type JourneyStep } from "@/lib/journey";
import { cn } from "@/lib/utils";

export type StepState = "done" | "next" | "upcoming";

/** One step of the founder journey: summary always visible, details in a native disclosure (open for the next step). */
export function JourneyStepCard({ step, number, state, projectId }: { step: JourneyStep; number: number; state: StepState; projectId: string | null }) {
  const links = step.links.map((l) => resolveLink(l, projectId));
  return (
    <li id={`step-${step.id}`} className="relative scroll-mt-24 pl-12">
      <span
        className={cn(
          "absolute left-0 top-5 grid size-8 place-items-center rounded-full text-sm font-semibold",
          state === "done" && "bg-brand-gradient text-white",
          state === "next" && "border-2 border-[var(--violet)] bg-white text-[var(--violet)] shadow-[0_0_0_4px_rgba(129,75,238,0.12)]",
          state === "upcoming" && "border border-border bg-white text-muted-foreground",
        )}
        aria-hidden="true"
      >
        {state === "done" ? <Check className="size-4" /> : number}
      </span>
      <details open={state === "next"} className={cn("surface group p-5", state === "next" && "ring-2 ring-[var(--violet)]/30")}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={cn("font-medium", state === "done" && "text-muted-foreground")}>{step.title}</h3>
              {state === "done" ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">Done</span> : null}
              {state === "next" ? <span className="rounded-full bg-[var(--plum)] px-2 py-0.5 text-[11px] text-white">Your next step</span> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{step.summary}</p>
          </div>
          <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
          <p><span className="font-medium">Why it matters: </span>{step.why}</p>
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><ListChecks className="size-3.5" /> How to do it</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">{step.howTo.map((h) => <li key={h}>{h}</li>)}</ol>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Fact icon={PackageCheck} label="You get" value={step.youGet} />
            <Fact icon={Target} label="Done when" value={step.doneWhen} />
            <Fact icon={Coins} label="Cost" value={step.cost} />
          </div>
          {step.tip ? (
            <p className="flex items-start gap-2 rounded-xl bg-[var(--violet)]/5 px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--violet)]" /> {step.tip}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {links.map((l, i) => (
              <Link key={l.label} href={l.href} className={cn(buttonVariants({ variant: i === 0 ? (state === "next" ? "gradient" : "default") : "outline" }), "h-9 rounded-[10px] px-3.5")}>
                {l.label} {i === 0 ? <ArrowRight /> : null}
              </Link>
            ))}
          </div>
          {!projectId && step.links.some((l) => "projectTab" in l) ? <p className="text-xs text-muted-foreground">Create a project first. These links will then open inside it.</p> : null}
        </div>
      </details>
    </li>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Coins; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground"><Icon className="size-3.5" /> {label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
