import { ArrowRight, Check, ChevronLeft, Clock, Gauge, Lightbulb, ListChecks, ShieldAlert, Sparkles, TriangleAlert, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { MVP_PLAYBOOK as P, strategiesForSkills } from "@/lib/resources/mvp-playbook";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getProfile } from "@/server/data/profiles";

export const metadata: Metadata = { title: P.title };

const SECTIONS = [
  ["what", "What an MVP is"],
  ["ladder", "The MVP ladder"],
  ["risk", "Risk = time"],
  ["skills", "Play to your strengths"],
  ["strategies", "8 strategies"],
  ["checklist", "Landing page checklist"],
] as const;

export default async function MvpPlaybookPage() {
  const user = await requireOnboardedUser();
  const profile = await getProfile(user.id);
  const skills = profile?.skills ?? [];
  const ranked = strategiesForSkills(skills);
  const suggested = skills.length ? ranked.filter((s) => s.fitsSkills.some((t) => skills.some((m) => m.toLowerCase().includes(t) || t.includes(m.toLowerCase())))).slice(0, 2) : [];

  return (
    <article className="space-y-10">
      <div>
        <Link href="/app/resources" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Resources</Link>
        <header className="surface ambient-glow rails-bg mt-3 overflow-hidden p-6 sm:p-8">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--violet)]"><Clock className="size-4" /> {P.readMinutes} min read</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{P.title}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{P.subtitle}</p>
          <div className="mt-5 max-w-3xl space-y-3 text-[15px] leading-relaxed">{P.intro.map((t) => <p key={t}>{t}</p>)}</div>
          <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-2">
            {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-full border border-border bg-white px-3 py-1 text-sm hover:border-foreground/30">{label}</a>)}
          </nav>
        </header>
      </div>

      <section id="what" className="scroll-mt-24 grid gap-6 lg:grid-cols-2">
        <div className="surface p-6">
          <h2 className="text-xl font-semibold tracking-tight">What an MVP is</h2>
          <p className="mt-3 text-[15px] leading-relaxed">{P.whatIsAnMvp.definition}</p>
          <ul className="mt-4 space-y-2 text-sm">{P.whatIsAnMvp.points.map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[var(--violet)]" /> {t}</li>)}</ul>
          <blockquote className="mt-5 rounded-xl border-l-4 border-[var(--violet)] bg-[var(--violet)]/5 px-4 py-3 text-sm italic">{P.whatIsAnMvp.smallestExample}</blockquote>
          <p className="mt-2 text-xs text-muted-foreground">{P.whatIsAnMvp.smallestExampleNote}</p>
        </div>
        <div className="surface p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Lightbulb className="size-5 text-[var(--violet)]" /> {P.mvr.title}</h2>
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed">{P.mvr.body.map((t) => <p key={t}>{t}</p>)}</div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {P.whyAWeek.reasons.map((r) => (
              <div key={r.title} className="rounded-xl border border-border bg-white p-3">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{P.whyAWeek.title}</p>
        </div>
      </section>

      <section id="ladder" className="surface scroll-mt-24 p-6">
        <h2 className="text-xl font-semibold tracking-tight">{P.ladder.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{P.ladder.note}</p>
        <ol className="mt-5 space-y-2">
          {P.ladder.rungs.map((r, i) => (
            <li key={r.name} className="grid items-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm sm:grid-cols-[2rem_1fr_7rem_2fr_auto]">
              <span className="grid size-7 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: `color-mix(in oklab, #f77373 ${100 - i * 10}%, #814bee)` }}>{i + 1}</span>
              <span className="font-medium">{r.name}</span>
              <span className="text-xs text-muted-foreground">{r.time}</span>
              <span className="text-muted-foreground">{r.learn}</span>
              {"link" in r && r.link ? <Link href={r.link.href} className="text-xs font-medium text-[var(--violet)] hover:underline">{r.link.label} →</Link> : <span />}
            </li>
          ))}
        </ol>
      </section>

      <section id="risk" className="scroll-mt-24 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="surface p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Gauge className="size-5 text-[var(--violet)]" /> {P.risk.title}</h2>
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed">{P.risk.body.map((t) => <p key={t}>{t}</p>)}</div>
        </div>
        <div className="surface p-6">
          <h2 className="text-xl font-semibold tracking-tight">{P.example.title}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[{ ...P.example.slow, good: false }, { ...P.example.fast, good: true }].map((o) => (
              <div key={o.label} className={cn("rounded-xl border p-4 text-sm", o.good ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/60")}>
                <p className="flex items-center gap-1.5 font-medium">{o.good ? <Check className="size-4 text-emerald-700" /> : <X className="size-4 text-rose-700" />} {o.label}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">{o.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                <p className="mt-3 text-xs font-medium">{o.result}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="skills" className="surface scroll-mt-24 p-6">
        <h2 className="text-xl font-semibold tracking-tight">{P.bySkill.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{P.bySkill.note}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {P.bySkill.rows.map((r) => {
            const mine = r.tags.some((t) => skills.some((s) => s.toLowerCase().includes(t) || t.includes(s.toLowerCase())));
            return (
              <div key={r.skill} className={cn("rounded-xl border p-4 text-sm", mine ? "border-[var(--violet)]/40 bg-[var(--violet)]/5" : "border-border bg-white")}>
                <p className="flex items-center justify-between gap-2 text-xs uppercase tracking-wider text-muted-foreground">Good at {r.skill.toLowerCase()} {mine ? <span className="rounded-full bg-[var(--plum)] px-2 py-0.5 text-[10px] normal-case tracking-normal text-white">You</span> : null}</p>
                <p className="mt-1 font-medium">{r.mvp}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 rounded-xl bg-muted/40 px-4 py-3 text-sm font-medium">Keep asking: “How can I get the most information while spending the least time?”</p>
      </section>

      <section id="strategies" className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">8 MVP strategies you can use</h2>
          <p className="text-sm text-muted-foreground">Mix and match if you like, but don&apos;t get overwhelmed. Pick the best one for you and start this week.</p>
        </div>
        {suggested.length ? (
          <p className="flex items-start gap-2 rounded-xl border border-[var(--violet)]/30 bg-[var(--violet)]/5 px-4 py-3 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--violet)]" />
            <span>Based on your skills ({skills.slice(0, 4).join(", ")}), start with{" "}
              {suggested.map((s, i) => (
                <span key={s.id}>{i ? " or " : ""}<a href={`#strategy-${s.id}`} className="font-semibold underline-offset-4 hover:underline">{s.name}</a></span>
              ))}
              .</span>
          </p>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          {P.strategies.map((s, i) => (
            <div key={s.id} id={`strategy-${s.id}`} className="surface scroll-mt-24 flex flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--violet)]">Strategy {i + 1}</p>
                  <h3 className="mt-0.5 text-lg font-semibold tracking-tight">{s.name}</h3>
                </div>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Takes {s.speed}</span>
              </div>
              <p className="mt-2 text-sm">{s.oneLiner}</p>
              <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Best when:</span> {s.bestWhen}</p>
              <p className="mt-4 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><ListChecks className="size-3.5" /> How to run it</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{s.steps.map((t) => <li key={t}>{t}</li>)}</ol>
              <p className="mt-3 text-sm"><span className="font-medium">Measure:</span> <span className="text-muted-foreground">{s.measure}</span></p>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{s.pitfalls.map((t) => <li key={t} className="flex gap-1.5"><TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" /> {t}</li>)}</ul>
              <div className="mt-auto pt-4">
                <Link href={s.link.href} className={cn(buttonVariants({ variant: "outline" }), "h-9 rounded-[10px]")}>{s.link.label} <ArrowRight /></Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="checklist" className="surface scroll-mt-24 p-6">
        <h2 className="text-xl font-semibold tracking-tight">{P.landingChecklist.title}</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {P.landingChecklist.items.map((it) => (
            <li key={it.title} className="rounded-xl border border-border bg-white p-4 text-sm">
              <p className="flex items-center gap-1.5 font-medium"><Check className="size-4 text-[var(--violet)]" /> {it.title}</p>
              <p className="mt-1 text-muted-foreground">{it.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> Be honest with early users: say it&apos;s in development, never fake proof, and refund promptly if plans change.</p>
      </section>

      <section className="surface ambient-glow flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl font-medium">{P.closing}</p>
        <Link href="/app/guide" className={cn(buttonVariants({ variant: "gradient" }), "h-10 shrink-0 px-4")}>Back to your journey <ArrowRight /></Link>
      </section>
    </article>
  );
}
