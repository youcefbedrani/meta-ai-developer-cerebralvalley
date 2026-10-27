import { ExternalLink, Globe, Quote } from "lucide-react";
import Link from "next/link";
import { landingDraftAction } from "@/app/(app)/app/(founder)/gold-mine/actions";
import { buttonVariants } from "@/components/ui/button";
import type { LandingContent } from "@/lib/validation/experiments";
import { cn } from "@/lib/utils";
import { ActionButton } from "./action-button";
import { QuoteCard, type QuoteView } from "./quote-card";

type Props = {
  sessionId: string;
  ideas: { id: string; title: string; oneLiner: string; linkedClusters: number }[];
  page: { id: string; slug: string; published: boolean; content: LandingContent } | null;
  stats: { visits: number; signups: number; conversion: number | null } | null;
  quotesById: Map<string, QuoteView>;
  cost: number;
};

function Based({ ids, quotesById }: { ids: string[]; quotesById: Map<string, QuoteView> }) {
  const quotes = ids.map((id) => quotesById.get(id)).filter((q): q is QuoteView => !!q);
  if (!quotes.length) return null;
  return (
    <details className="mt-1 text-xs text-muted-foreground">
      <summary className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"><Quote className="size-3" /> Based on {quotes.length} quote{quotes.length === 1 ? "" : "s"}</summary>
      <div className="mt-2 space-y-2">{quotes.map((q) => <QuoteCard key={q.id} q={q} />)}</div>
    </details>
  );
}

export function LandingStep({ sessionId, ideas, page, stats, quotesById, cost }: Props) {
  if (!page) {
    if (!ideas.length) {
      return <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6 text-sm"><p className="font-medium text-warning">Needs more data</p><p className="mt-1 text-muted-foreground">Generate ideas from your pain clusters first.</p></div>;
    }
    return (
      <section className="surface p-6">
        <h2 className="flex items-center gap-2 font-medium"><Globe className="size-4 text-primary" /> Draft a landing page</h2>
        <p className="mt-1 text-sm text-muted-foreground">Copy is written only from the quotes behind the idea; each block shows which quotes it&apos;s based on. Choosing an idea turns it into a project and copies its quotes into the project&apos;s customer-language library.</p>
        <ul className="mt-5 space-y-3">
          {ideas.map((i) => (
            <li key={i.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{i.title}</p>
                <p className="text-sm text-muted-foreground">{i.oneLiner}</p>
                <p className="mt-1 text-xs text-muted-foreground">Linked to {i.linkedClusters} pain cluster{i.linkedClusters === 1 ? "" : "s"}</p>
              </div>
              <ActionButton action={landingDraftAction} args={[sessionId, i.id]} success="Landing page draft created" className="h-9 shrink-0 px-4">
                Draft page · {cost} credits
              </ActionButton>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const refs = page.content.quoteRefs;
  return (
    <div className="space-y-6">
      <section className="surface p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-medium"><Globe className="size-4 text-primary" /> Landing page draft</h2>
            <p className="mt-1 text-sm text-muted-foreground">{page.published ? `Published at /p/${page.slug}` : "Draft — review and publish it in the landing page builder."}</p>
          </div>
          <Link href={`/app/lab/pages/${page.id}`} className={cn(buttonVariants({ variant: "gradient" }), "h-10 px-5")}>Open in builder <ExternalLink /></Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-hard">
        <div className="px-6 py-10 text-center">
          <h3 className="text-3xl font-semibold tracking-tight">{page.content.headline}</h3>
          {refs ? <Based ids={refs.headline} quotesById={quotesById} /> : null}
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{page.content.subheadline}</p>
          {refs ? <Based ids={refs.subheadline} quotesById={quotesById} /> : null}
          <ul className="mx-auto mt-6 max-w-md space-y-3 text-left text-sm">
            {page.content.bullets.map((b, i) => (
              <li key={i} className="rounded-xl border border-border px-4 py-3">
                ✓ {b}
                {refs?.bullets[i] ? <Based ids={refs.bullets[i]} quotesById={quotesById} /> : null}
              </li>
            ))}
          </ul>
          <span className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-[var(--plum)] px-5 text-sm font-medium text-white">{page.content.ctaLabel}</span>
        </div>
      </section>

      <section className="surface p-6">
        <h3 className="font-medium">Results</h3>
        {stats && page.published && stats.visits > 0 ? (
          <dl className="mt-4 grid grid-cols-3 gap-4">
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Unique visits</dt><dd className="mt-1 text-2xl font-semibold">{stats.visits}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Signups</dt><dd className="mt-1 text-2xl font-semibold">{stats.signups}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Conversion</dt><dd className="mt-1 text-2xl font-semibold">{stats.conversion === null ? "—" : `${(stats.conversion * 100).toFixed(1)}%`}</dd></div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No visits yet. Publish the page and share it with the communities your quotes came from — real visits and signups will appear here.</p>
        )}
      </section>
    </div>
  );
}
