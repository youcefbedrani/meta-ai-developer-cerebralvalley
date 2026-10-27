import Link from "next/link";
import { matchingStrategies, profileLabels, profileScales, profileTakeaways } from "@/lib/founder-profile";
import { cn } from "@/lib/utils";
import type { FounderData } from "@/server/data/founder-data";

const STAGE_LABEL: Record<string, string> = { idea: "Idea", research: "Research", validation: "Validation", planning: "Planning", building: "Building", launched: "Launched" };
// Ordered stages → one hue, light to dark (sequential), so later stages read as "further along".
const STAGE_SHADE = ["bg-violet-200", "bg-violet-300", "bg-violet-400", "bg-violet-500", "bg-violet-600", "bg-violet-800"];

function Chips({ items, empty = "—" }: { items: string[]; empty?: string }) {
  return items.length ? (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li key={i} className="rounded-md border border-border bg-white px-2 py-0.5 text-xs">{i}</li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">{empty}</p>
  );
}

function Meter({ step, steps, label, value }: { step: number; steps: number; label: string; value: string }) {
  return (
    <div>
      <div className="flex justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="mt-1 flex gap-[2px]" role="img" aria-label={`${label}: ${value} (${step} of ${steps})`}>
        {Array.from({ length: steps }, (_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-[var(--plum)]" : "bg-muted")} />
        ))}
      </div>
    </div>
  );
}

function Tile({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </>
  );
  return href ? <Link href={href} className="rounded-xl border border-border bg-white p-3 hover:border-[var(--violet)]">{body}</Link> : <div className="rounded-xl border border-border bg-white p-3">{body}</div>;
}

/**
 * A founder's answers and data, visualised: who they are (skills, scales, goals), what that means
 * (rule-based takeaways and matching MVP strategies), and what they've built so far.
 * Used on the client's own profile page and in the admin user view (`viewer="admin"`).
 */
export function FounderProfileView({ data, viewer = "self" }: { data: FounderData; viewer?: "self" | "admin" }) {
  const { profile: p, credits, counts, stages } = data;
  const totalProjects = stages.reduce((s, x) => s + x.count, 0);
  const usedPct = credits.allowance ? Math.min(100, Math.round((credits.used / credits.allowance) * 100)) : 0;
  const self = viewer === "self";

  return (
    <div className="space-y-6">
      {p ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section className="surface space-y-4 p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium">{self ? "Your founder profile" : "Founder profile"}</h2>
              {self ? <Link href="/onboarding" className="text-sm text-primary hover:underline">Edit answers</Link> : null}
            </div>
            <div>
              <p className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Skills</p>
              <Chips items={p.skills} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Interests</p>
                <Chips items={p.interests} />
              </div>
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Target markets</p>
                <Chips items={p.targetMarkets} empty="Not set" />
              </div>
            </div>
            <div className="space-y-3">
              {profileScales(p).map((s) => (
                <Meter key={s.label} {...s} />
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Goals</p>
                <Chips items={profileLabels(p).goals} />
              </div>
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Business models</p>
                <Chips items={profileLabels(p).models} />
              </div>
            </div>
            {p.notes ? <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="text-xs text-muted-foreground">Notes:</span> {p.notes}</p> : null}
          </section>

          <section className="surface space-y-4 p-5">
            <div>
              <h2 className="font-medium">{self ? "What this means for you" : "What this means"}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground"><span className="font-mono font-semibold text-violet-700">ANALYSIS</span> from the answers, using fixed rules. Not a prediction.</p>
            </div>
            <ul className="space-y-3">
              {profileTakeaways(p).map((t) => (
                <li key={t.title} className="rounded-xl border border-border bg-white p-3 text-sm">
                  <p className="font-medium">{t.title}</p>
                  <p className="mt-0.5 text-muted-foreground">{t.body}</p>
                  {t.href && self ? <Link href={t.href} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">Open →</Link> : null}
                </li>
              ))}
            </ul>
            {matchingStrategies(p).length ? (
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">MVP approaches that match the skills</p>
                <ul className="space-y-1.5 text-sm">
                  {matchingStrategies(p).map((s) => (
                    <li key={s.id}>
                      <Link href={`/app/resources/mvp-playbook#strategy-${s.id}`} className="font-medium hover:underline">{s.name}</Link> <span className="text-muted-foreground">· {s.speed}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <p className="surface p-5 text-sm text-muted-foreground">Onboarding isn&apos;t finished yet, so there&apos;s no profile to show.</p>
      )}

      <section className="surface p-5">
        <h2 className="font-medium">{self ? "Your work so far" : "Work so far"}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <Tile label="Ideas" value={counts.ideas} href={self ? "/app/ideas" : undefined} />
          <Tile label="Projects" value={counts.projects} href={self ? "/app/projects" : undefined} />
          <Tile label="Research reports" value={counts.reports} href={self ? "/app/research" : undefined} />
          <Tile label="Sourced facts" value={counts.facts} />
          <Tile label="Competitors mapped" value={counts.competitors} />
          <Tile label="Customer quotes" value={counts.quotes} />
          <Tile label="Tests completed" value={counts.experiments} href={self ? "/app/lab" : undefined} />
          <Tile label="Waitlist signups" value={counts.signups} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Projects by stage</p>
            {totalProjects ? (
              <>
                <div className="bar-grow mt-2 flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={stages.filter((s) => s.count).map((s) => `${s.count} ${STAGE_LABEL[s.stage]}`).join(", ")}>
                  {stages.map((s, i) => (s.count ? <div key={s.stage} className={STAGE_SHADE[i]} style={{ width: `${(s.count / totalProjects) * 100}%` }} title={`${STAGE_LABEL[s.stage]}: ${s.count}`} /> : null))}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {stages.map((s, i) => (
                    <li key={s.stage} className={cn("flex items-center gap-1.5", !s.count && "text-muted-foreground")}>
                      <span className={cn("size-2.5 rounded-sm", STAGE_SHADE[i])} aria-hidden="true" /> {STAGE_LABEL[s.stage]} <span className="tabular-nums">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No active projects yet.</p>
            )}
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">Credits this month</span>
              <span className="tabular-nums text-muted-foreground">{credits.used} used · {credits.balance} left · <span className="capitalize">{credits.plan}</span> plan</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${usedPct}% of the monthly allowance used`}>
              <div className="bar-grow h-full rounded-full bg-[var(--plum)]" style={{ width: `${usedPct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{usedPct}% of the {credits.allowance}-credit monthly allowance.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
