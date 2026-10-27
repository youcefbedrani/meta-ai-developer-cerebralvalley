import { CalendarClock, CircleSlash, Gauge, Lightbulb, ListChecks, Sprout } from "lucide-react";
import { CopyButton } from "@/components/gold-mine/copy-button";
import { FitBlock } from "./fit-block";
import type { MarketingPlan } from "@/lib/validation/marketing";
import { cn } from "@/lib/utils";

const LEVEL = { low: "Low", medium: "Medium", high: "High" } as const;
const FIT_CLASS = { high: "border-emerald-200 bg-emerald-50 text-emerald-700", medium: "border-amber-200 bg-amber-50 text-amber-700", low: "border-border text-muted-foreground" } as const;
const TIME = { days: "Results in days", weeks: "Results in weeks", months: "Results in months" } as const;

export function OrganicSection({ plan }: { plan: MarketingPlan }) {
  const channels = [...plan.organic.channels].sort((a, b) => b.fitScore - a.fitScore || a.priority - b.priority);
  return (
    <>
      <section className="surface p-6">
        <h2 className="flex items-center gap-2 font-medium"><Sprout className="size-4 text-primary" /> Organic strategy</h2>
        <p className="text-xs text-muted-foreground">Free but takes time. Ranked by how well each channel fits your audience. Start at the top.</p>
        {plan.organic.summary ? <p className="mt-3 text-sm">{plan.organic.summary}</p> : null}
      </section>

      <div className="space-y-4">
        {channels.map((c, i) => (
          <section key={c.name} className="surface p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold", i === 0 ? "bg-brand-gradient text-white" : "border border-border bg-white")}>{i + 1}</span>
                <div>
                  <h3 className="font-medium">{c.name}{i === 0 ? <span className="ml-2 text-xs font-normal text-[var(--violet)]">Best fit</span> : null}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{c.why}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className={cn("rounded-full border px-2 py-0.5", FIT_CLASS[c.audienceFit])}>Audience fit: {LEVEL[c.audienceFit]}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">Effort: {LEVEL[c.effort]}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">{TIME[c.timeToResults]}</span>
              </div>
            </div>

            <FitBlock c={c} />

            {c.strategy ? <p className="mt-4 rounded-xl bg-muted/40 px-4 py-3 text-sm"><span className="font-medium">Strategy: </span>{c.strategy}</p> : null}

            <div className="mt-4 grid gap-5 text-sm md:grid-cols-2">
              {c.whereToFind.length ? <Block icon={Gauge} title="Where to find them" items={c.whereToFind} /> : null}
              {c.tactics.length ? <Block icon={ListChecks} title="How to do it" items={c.tactics} ordered /> : null}
              {c.contentIdeas.length ? <Block icon={Lightbulb} title="Content ideas" items={c.contentIdeas} /> : null}
              {c.avoid.length ? <Block icon={CircleSlash} title="Avoid" items={c.avoid} /> : null}
            </div>

            {c.cadence || c.kpi ? (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                {c.cadence ? <span className="flex items-center gap-1"><CalendarClock className="size-3.5" /> <span className="font-medium text-foreground">Cadence:</span> {c.cadence}</span> : null}
                {c.kpi ? <span><span className="font-medium text-foreground">Measure:</span> {c.kpi}</span> : null}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <section className="surface p-6">
        <h2 className="flex items-center gap-2 font-medium"><Sprout className="size-4 text-primary" /> Organic content drafts</h2>
        <p className="mt-1 text-xs text-muted-foreground">Edit before posting. Follow each community&apos;s rules, lead with value, and say that you&apos;re building something.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {plan.organic.content.map((c, i) => (
            <article key={i} className="rounded-xl border border-border bg-white p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-medium">{c.title}</p><p className="text-xs text-muted-foreground">{c.channel} · {c.format.replace("_", " ")}</p></div>
                <CopyButton text={`${c.title}\n\n${c.body}`} />
              </div>
              <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{c.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function Block({ icon: Icon, title, items, ordered }: { icon: typeof Gauge; title: string; items: string[]; ordered?: boolean }) {
  const List = ordered ? "ol" : "ul";
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><Icon className="size-3.5" /> {title}</p>
      <List className={cn("mt-2 space-y-1 pl-5", ordered ? "list-decimal" : "list-disc")}>{items.map((x) => <li key={x}>{x}</li>)}</List>
    </div>
  );
}
