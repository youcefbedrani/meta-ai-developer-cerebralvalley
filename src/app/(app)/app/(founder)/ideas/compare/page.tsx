import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { ComplexityBadge } from "@/components/ideas/complexity-badge";
import { IdeaActions } from "@/components/ideas/idea-actions";
import { GitCompare } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getIdeasForComparison, type Idea } from "@/server/data/ideas";

export const metadata: Metadata = { title: "Compare ideas" };

const ROWS: { label: string; render: (i: Idea) => React.ReactNode }[] = [
  { label: "One-liner", render: (i) => i.content.oneLiner },
  { label: "Problem", render: (i) => i.content.problem },
  { label: "Target customer", render: (i) => i.content.targetCustomer },
  { label: "Solution", render: (i) => i.content.solution },
  { label: "Differentiation", render: (i) => i.content.differentiationHypothesis },
  { label: "Monetization", render: (i) => i.content.monetization },
  { label: "Pricing hypotheses", render: (i) => <List items={i.content.pricingHypotheses} /> },
  { label: "Complexity", render: (i) => <><ComplexityBadge value={i.content.complexity} /><p className="mt-1.5">{i.content.complexityReason}</p></> },
  { label: "Risks", render: (i) => <List items={i.content.risks} /> },
  { label: "Unknowns", render: (i) => <List items={i.content.evidenceMissing} /> },
  { label: "First experiment", render: (i) => `${i.content.firstExperiment.description} — success: ${i.content.firstExperiment.successCriteria}` },
];

export default async function CompareIdeasPage({ searchParams }: PageProps<"/app/ideas/compare">) {
  const user = await requireOnboardedUser();
  const { ids } = (await searchParams) as { ids?: string };
  const ideas = await getIdeasForComparison(user.id, (ids ?? "").split(","));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/ideas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Ideas
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Compare ideas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Side by side. All fields are AI-generated hypotheses.</p>
      </div>
      {ideas.length < 2 ? (
        <EmptyState icon={GitCompare} title="Pick at least two ideas" description="Use the Compare checkboxes on the ideas page." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="w-40 p-4 text-left text-xs font-normal uppercase tracking-wider text-muted-foreground" />
                {ideas.map((i) => (
                  <th key={i.id} className="p-4 text-left align-top font-medium">
                    <Link href={`/app/ideas/${i.id}`} className="hover:underline">{i.content.title}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <th className="p-4 text-left align-top text-xs font-normal uppercase tracking-wider text-muted-foreground">{row.label}</th>
                  {ideas.map((i) => <td key={i.id} className="p-4 align-top leading-relaxed">{row.render(i)}</td>)}
                </tr>
              ))}
              <tr>
                <th />
                {ideas.map((i) => (
                  <td key={i.id} className="p-4"><IdeaActions ideaId={i.id} status={i.status} projectId={i.projectId} compact /></td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return items.length ? <ul className="list-disc space-y-1 pl-4">{items.map((x) => <li key={x}>{x}</li>)}</ul> : <span className="text-muted-foreground">—</span>;
}
