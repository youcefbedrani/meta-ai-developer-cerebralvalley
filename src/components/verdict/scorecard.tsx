import { ArrowRight, Hammer, Megaphone, Scale, Tag, Wallet } from "lucide-react";
import { Confetti } from "@/components/motion/confetti";
import { ScoreRing } from "@/components/motion/count-up";
import type { Fit, Verdict } from "@/lib/verdict";
import { cn } from "@/lib/utils";

const DECISION = {
  go: { label: "Go", tone: "bg-success/12 text-success border-success/30" },
  pivot: { label: "Pivot / sharpen", tone: "bg-warning/12 text-warning border-warning/30" },
  drop: { label: "Drop / rethink", tone: "bg-destructive/10 text-destructive border-destructive/30" },
  incomplete: { label: "Not enough data", tone: "bg-muted text-muted-foreground border-border" },
} as const;

const STATUS = { strong: "Strong", mixed: "Mixed", weak: "Weak" } as const;
const usd = (n: number) => `$${n.toLocaleString("en", { maximumFractionDigits: 0 })}`;

/** Go / Pivot / Drop scorecard plus the micro-SaaS fit check. Pure presentation: works in the app and on shared links. */
export function Scorecard({ verdict, fit, celebrateId }: { verdict: Verdict; fit: Fit; /** Set to celebrate a Go verdict once (e.g. the run id). */ celebrateId?: string }) {
  const d = DECISION[verdict.decision];
  if (verdict.score === null) return null;
  return (
    <section className="space-y-4" aria-labelledby="verdict-title">
      {verdict.decision === "go" && celebrateId ? <Confetti id={celebrateId} /> : null}
      <div className="surface p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <ScoreRing score={verdict.score} tone={verdict.decision} />
            <span className={cn("animate-pop rounded-full border px-3 py-1 text-sm font-medium [animation-delay:0.9s]", d.tone)}>{d.label}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="verdict-title" className="font-medium">{verdict.headline}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">ANALYSIS</span> Evidence score from your research, competitors, real quotes and test results. Confidence: <b className="text-foreground">{verdict.confidence}</b>. It is not a prediction; only real customers validate an idea.
            </p>
          </div>
        </div>

        <div className="stagger mt-5 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {verdict.signals.map((s) => (
            <div key={s.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{s.label}</span>
                <span className={cn("text-xs", s.status === "strong" ? "text-success" : s.status === "mixed" ? "text-warning" : "text-destructive")}>{STATUS[s.status]}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-muted" role="meter" aria-valuenow={Math.round(s.points * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.label}: ${STATUS[s.status]}`}>
                <div className="bar-grow h-full rounded-full bg-[var(--plum)] opacity-85" style={{ width: `${Math.max(4, s.points * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 border-t border-border pt-4 text-sm md:grid-cols-[1fr_1.4fr]">
          <div className="space-y-2">
            {verdict.strongest ? <p><span className="text-muted-foreground">Strongest point:</span> {verdict.strongest.label}</p> : null}
            {verdict.weakest ? <p><span className="text-muted-foreground">Biggest risk:</span> {verdict.weakest.label}</p> : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Do this next</p>
            <ul className="mt-2 space-y-1.5">
              {verdict.nextSteps.map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" /> {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <FitCard fit={fit} />
    </section>
  );
}

function FitCard({ fit }: { fit: Fit }) {
  const solo = { likely: "Likely", stretch: "A stretch", hard: "Hard" }[fit.solo.level];
  return (
    <div className="surface p-5">
      <h2 className="font-medium">Micro-SaaS fit</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Can one person build it, reach customers without ads, and get to real monthly revenue?</p>
      <div className="stagger mt-4 grid gap-4 md:grid-cols-2">
        <Item icon={Hammer} title={`Build it solo: ${solo}`}>{fit.solo.detail}</Item>
        <Item icon={Megaphone} title="Where to find customers">
          {fit.channels.length ? (
            <>
              They already talk about this on{" "}
              {fit.channels.map((c, i) => (
                <span key={c.platform}>
                  {i ? ", " : ""}
                  <b className="text-foreground">{c.platform}</b> ({c.quotes})
                </span>
              ))}
              . Start there, for free.
            </>
          ) : (
            "No public conversations found yet. Run Market voices to see where your customers talk."
          )}
        </Item>
        <Item icon={Tag} title={fit.price ? `Suggested price: ${usd(fit.price.suggested)}/month` : "Suggested price: not enough data"}>
          {fit.price ? (
            <>
              <span className="rounded bg-muted px-1 font-medium text-foreground">FACT</span> {fit.price.count} competitor entry plan{fit.price.count === 1 ? "" : "s"} with sourced prices: {usd(fit.price.low)}–{usd(fit.price.high)} (median {usd(fit.price.median)}).{" "}
              <span className="rounded bg-muted px-1 font-medium text-foreground">ANALYSIS</span> Enter a little under the typical price, then test higher.
            </>
          ) : (
            "No competitor prices were found in sources. Ask potential customers what they pay today."
          )}
        </Item>
        <Item icon={Wallet} title="Revenue math">
          {fit.revenue.length ? (
            <ul className="space-y-0.5">
              {fit.revenue.map((r) => (
                <li key={r.target}>
                  <b className="tabular-nums text-foreground">{r.customers.toLocaleString("en")}</b> paying customers → {usd(r.target)}/month
                </li>
              ))}
            </ul>
          ) : (
            "Appears once there is a price to work from."
          )}
        </Item>
      </div>
      {fit.budgetNote ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
          <Scale className="mt-0.5 size-4 shrink-0" /> {fit.budgetNote}
        </p>
      ) : null}
    </div>
  );
}

function Item({ icon: Icon, title, children }: { icon: typeof Hammer; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium">{title}</p>
        <div className="mt-0.5 text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
