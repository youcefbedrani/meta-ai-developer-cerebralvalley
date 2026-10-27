import { ChevronLeft, FlaskConical } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ComplexityBadge, HypothesisBadge } from "@/components/ideas/complexity-badge";
import { IdeaActions } from "@/components/ideas/idea-actions";
import { IdeaAnatomy } from "@/components/ideas/idea-anatomy";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getIdea } from "@/server/data/ideas";
import { getIdeaEvidence } from "@/server/data/gold-mine";
import { ClusterCard } from "@/components/gold-mine/pains-step";

export default async function IdeaPage({ params }: PageProps<"/app/ideas/[id]">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const idea = await getIdea(user.id, id);
  if (!idea) notFound();
  const c = idea.content;
  const evidence = idea.goldMineSessionId ? await getIdeaEvidence(user.id, idea.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/ideas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Ideas
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{c.title}</h1>
            <p className="mt-1.5 max-w-2xl text-muted-foreground">{c.oneLiner}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ComplexityBadge value={c.complexity} />
              <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">{idea.status}</span>
            </div>
          </div>
          <div id={`idea-actions-${idea.id}`}>
            <IdeaActions ideaId={idea.id} status={idea.status} projectId={idea.projectId} />
          </div>
        </div>
      </div>

      {evidence.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Evidence: the real pain{evidence.length === 1 ? "" : "s"} this idea solves</h2>
          {evidence.map((cl) => <ClusterCard key={cl.id} c={cl} compact />)}
          <p className="text-xs text-muted-foreground">The pains are sourced; the idea itself (solution, pricing, differentiation) is still a hypothesis to test.</p>
        </section>
      ) : (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm text-muted-foreground">
          <HypothesisBadge /> <span className="ml-2">Everything below is an AI-generated hypothesis. No research has been done yet. Turn it into a project to research and test it.</span>
        </div>
      )}

      <IdeaAnatomy
        ideaId={idea.id}
        projectId={idea.projectId}
        unknowns={c.evidenceMissing}
        parts={[
          // Gold Mine ideas come from sourced pain quotes: the problem and who has it are evidenced.
          { label: "Problem", value: c.problem, sourced: evidence.length > 0 },
          { label: "Customer", value: c.targetCustomer, sourced: evidence.length > 0 },
          { label: "Alternatives", value: c.currentAlternatives, sourced: false },
          { label: "Solution", value: c.solution, sourced: false },
          { label: "Edge", value: c.differentiationHypothesis, sourced: false },
          { label: "Money", value: c.monetization, sourced: false },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Problem">{c.problem}</Section>
        <Section title="Target customer">{c.targetCustomer}</Section>
        <Section title="Solution">{c.solution}</Section>
        <Section title="Differentiation hypothesis">{c.differentiationHypothesis}</Section>
        <ListSection title="How people solve it today" items={c.currentAlternatives} />
        <Section title="Monetization">
          <p>{c.monetization}</p>
          {c.pricingHypotheses.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {c.pricingHypotheses.map((p) => <li key={p}>{p}</li>)}
            </ul>
          ) : null}
        </Section>
        <ListSection title="Risks" items={c.risks} />
        <Section title="Complexity">
          <ComplexityBadge value={c.complexity} />
          <p className="mt-2">{c.complexityReason}</p>
        </Section>
        <ListSection title="Evidence to look for" items={c.evidenceToLookFor} hint="Research directions, not findings." />
        <ListSection title="What's unknown" items={c.evidenceMissing} />
      </div>

      <div className="surface p-5">
        <div className="flex items-center gap-2 font-medium">
          <FlaskConical className="size-4 text-primary" /> First experiment
          <span className="rounded-full border border-border px-2 py-0.5 text-xs font-normal capitalize text-muted-foreground">{c.firstExperiment.type.replace("_", " ")}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{c.firstExperiment.description}</p>
        <p className="mt-2 text-sm"><span className="text-muted-foreground">Success criteria:</span> {c.firstExperiment.successCriteria}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function ListSection({ title, items, hint }: { title: string; items: string[]; hint?: string }) {
  return (
    <Section title={title}>
      {hint ? <p className="mb-2 text-xs text-muted-foreground">{hint}</p> : null}
      {items.length ? (
        <ul className="list-disc space-y-1 pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ul>
      ) : (
        <p className="text-muted-foreground">None listed.</p>
      )}
    </Section>
  );
}
