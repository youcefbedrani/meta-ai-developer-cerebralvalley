import { ArrowRight, BadgeCheck, Coins, Compass, PartyPopper, Scale } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JourneyStepCard } from "@/components/guide/journey-step-card";
import { buttonVariants } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { JOURNEY, JOURNEY_STEPS, nextStep, resolveLink } from "@/lib/journey";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { getJourneyProgress } from "@/server/data/journey";

export const metadata: Metadata = { title: "Start here" };

export default async function GuidePage({ searchParams }: PageProps<"/app/guide">) {
  const user = await requireOnboardedUser();
  const welcome = (await searchParams).welcome === "1";
  const [{ progress, focusProjectId }, balance] = await Promise.all([getJourneyProgress(user.id), getBalance(user.id)]);
  const next = nextStep(progress);
  const done = JOURNEY_STEPS.filter((s) => progress[s.id]).length;
  const pct = Math.round((done / JOURNEY_STEPS.length) * 100);
  const firstName = user.name?.split(" ")[0];
  let n = 0;

  return (
    <div className="space-y-8">
      <section className="surface ambient-glow rails-bg overflow-hidden p-6 sm:p-8">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--violet)]">
          <Compass className="size-4" /> Start here
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {welcome ? <>Welcome to {BRAND.name}{firstName ? `, ${firstName}` : ""} 👋</> : <>Your path from idea to <span className="text-gradient">first customers</span></>}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {welcome
            ? "Here's the whole journey: find a problem worth solving, prove people want it, launch, and get your first customers. Follow the steps in order, or jump to any step. This guide stays in the sidebar under “Start here”."
            : "Nine steps in four phases. Steps tick off automatically as you do them. Open any step to see how."}
        </p>

        <div className="mt-6 max-w-xl">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{done} of {JOURNEY_STEPS.length} steps done</span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Journey progress">
            <div className="bar-grow h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {next ? (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Your next step</p>
              <p className="mt-0.5 font-medium">{next.title}</p>
              <p className="text-sm text-muted-foreground">{next.summary}</p>
            </div>
            <Link href={resolveLink(next.links[0], focusProjectId).href} className={cn(buttonVariants({ variant: "gradient" }), "h-10 shrink-0 px-4")}>
              {resolveLink(next.links[0], focusProjectId).label} <ArrowRight />
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <PartyPopper className="size-5 shrink-0 text-emerald-700" />
            <p>You&apos;ve completed the whole journey. Keep measuring, double down on what works, and start a new project whenever you have another idea.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground">Three things to know before you start</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <Concept icon={Scale} title="Every claim is labelled">
            Research marks each point as <b>FACT</b> (with a source you can open), <b>ANALYSIS</b> or <b>ASSUMPTION</b>. Nothing is made up, and AI ideas are labelled hypotheses.
          </Concept>
          <Concept icon={BadgeCheck} title="Only real results validate">
            An idea counts as validated only when a real experiment, with real people and numbers you recorded, meets the success criteria you set beforehand.
          </Concept>
          <Concept icon={Coins} title="Credits pay for AI work">
            Each AI action shows its cost on the button. You have <b>{balance} credits</b> right now. Manual work (logging results, editing, publishing) is free.
          </Concept>
        </div>
      </section>

      <nav aria-label="Phases" className="flex flex-wrap gap-2">
        {JOURNEY.map((phase, i) => {
          const phaseDone = phase.steps.every((s) => progress[s.id]);
          return (
            <a key={phase.id} href={`#phase-${phase.id}`} className={cn("rounded-full border px-3 py-1 text-sm", phaseDone ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-white hover:border-foreground/30")}>
              {i + 1}. {phase.title}
            </a>
          );
        })}
      </nav>

      <div className="space-y-10">
        {JOURNEY.map((phase, i) => (
          <section key={phase.id} id={`phase-${phase.id}`} className="scroll-mt-24">
            <div className="mb-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--violet)]">Phase {i + 1}</p>
              <h2 className="text-xl font-semibold tracking-tight">{phase.title}</h2>
              <p className="text-sm text-muted-foreground">{phase.subtitle}</p>
            </div>
            <ol className="relative space-y-4 before:absolute before:bottom-6 before:left-4 before:top-6 before:w-px before:bg-border">
              {phase.steps.map((step) => {
                n++;
                const state = progress[step.id] ? "done" : next?.id === step.id ? "next" : "upcoming";
                return <JourneyStepCard key={step.id} step={step} number={n} state={state} projectId={focusProjectId} />;
              })}
            </ol>
          </section>
        ))}
      </div>

      <div className="flex flex-col items-start gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>You can come back to this guide any time from <b className="text-foreground">Start here</b> in the sidebar.</p>
        <Link href="/app" className={cn(buttonVariants({ variant: "outline" }), "rounded-[10px]")}>Go to dashboard</Link>
      </div>
    </div>
  );
}

function Concept({ icon: Icon, title, children }: { icon: typeof Scale; title: string; children: React.ReactNode }) {
  return (
    <div className="surface p-5">
      <span className="grid size-9 place-items-center rounded-xl bg-[var(--violet)]/10 text-[var(--violet)]"><Icon className="size-4" /></span>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
