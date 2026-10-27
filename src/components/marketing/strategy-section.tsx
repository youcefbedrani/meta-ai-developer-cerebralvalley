import { Lightbulb, Search, Target, Users } from "lucide-react";
import type { MarketingPlan } from "@/lib/validation/marketing";
import { cn } from "@/lib/utils";

const BASIS: Record<MarketingPlan["angles"][number]["basis"], { label: string; className: string }> = {
  customer_quote: { label: "Customer quote", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  research: { label: "Research", className: "border-sky-200 bg-sky-50 text-sky-700" },
  hypothesis: { label: "Hypothesis", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

export function StrategySection({ plan }: { plan: MarketingPlan }) {
  return (
    <>
      <section className="surface p-6">
        <h2 className="flex items-center gap-2 font-medium"><Target className="size-4 text-primary" /> Positioning</h2>
        <p className="mt-3 text-xl font-semibold tracking-tight">{plan.positioning.oneLiner}</p>
        <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Ideal customer</dt><dd className="mt-1">{plan.positioning.idealCustomer}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">The problem, in their words</dt><dd className="mt-1">{plan.positioning.problemInTheirWords}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Key message</dt><dd className="mt-1">{plan.positioning.keyMessage}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Unique angle</dt><dd className="mt-1">{plan.positioning.uniqueAngle}</dd></div>
        </dl>
      </section>

      <section className="surface p-6">
        <h2 className="flex items-center gap-2 font-medium"><Users className="size-4 text-primary" /> Who you&apos;re targeting</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {plan.audience.segments.map((s) => (
            <div key={s.name} className="rounded-xl border border-border bg-white p-4 text-sm">
              <p className="font-medium">{s.name}</p>
              <p className="mt-1 text-muted-foreground">{s.who}</p>
              <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">When they feel the pain</p>
              <p className="mt-1">{s.trigger}</p>
              {s.whereTheyHangOut.length ? (
                <>
                  <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Where they spend time</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">{s.whereTheyHangOut.map((w) => <li key={w} className="rounded-full border border-border px-2 py-0.5 text-xs">{w}</li>)}</ul>
                </>
              ) : null}
              {s.howTheySearch.length ? (
                <>
                  <p className="mt-3 flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground"><Search className="size-3" /> What they search for</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">{s.howTheySearch.map((q) => <li key={q}>“{q}”</li>)}</ul>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {plan.angles.length ? (
        <section className="surface p-6">
          <h2 className="flex items-center gap-2 font-medium"><Lightbulb className="size-4 text-primary" /> Messaging angles</h2>
          <p className="mt-1 text-xs text-muted-foreground">Different reasons someone might care. Your ads and posts each test one angle, so you learn which message works. The label shows what each angle is based on.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plan.angles.map((a) => (
              <div key={a.name} className="rounded-xl border border-border bg-white p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{a.name}</p>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", BASIS[a.basis].className)}>{BASIS[a.basis].label}</span>
                </div>
                <p className="mt-2 text-base font-semibold tracking-tight">“{a.hook}”</p>
                <p className="mt-2 text-muted-foreground">{a.whyItResonates}</p>
                <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Based on:</span> {a.evidence}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
