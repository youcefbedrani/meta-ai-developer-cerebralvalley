import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { AddCompetitorForm, CompetitorScanPanel, DeleteCompetitorButton } from "@/components/competitors/competitor-controls";
import { CoverageGrid, FeatureMatrix, Landscape, PricingLadder } from "@/components/competitors/competitor-insights";
import { CREDIT_COSTS } from "@/lib/plans";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { getProject } from "@/server/data/projects";
import { getLatestCompetitorScan, listCompetitors, listResearchJobs, type CompetitorRow } from "@/server/data/research";

const ORIGIN = { research: "From research", scan: "From competitor scan", manual: "Added by you · unverified" } as const;

export default async function ProjectCompetitorsPage({ params }: PageProps<"/app/projects/[id]/competitors">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();
  const [competitors, scan, jobs, balance] = await Promise.all([listCompetitors(user.id, id), getLatestCompetitorScan(user.id, id), listResearchJobs(user.id, id, 1), getBalance(user.id)]);
  const researchRunning = jobs.some((j) => j.status === "queued" || j.status === "running");
  const scanJob = scan
    ? { status: scan.status, currentStage: scan.currentStage, error: scan.error, result: (scan.input?.result as Record<string, number> | undefined) ?? null, finishedAt: scan.finishedAt?.toISOString() ?? null }
    : null;

  return (
    <div className="space-y-6">
      <CompetitorScanPanel projectId={id} job={scanJob} cost={CREDIT_COSTS.competitor_scan} balance={balance} researchRunning={researchRunning} />

      {competitors.length ? (
        <>
          <Landscape list={competitors} projectName={project.name} />
          <CoverageGrid list={competitors} />
          <div className="grid gap-6 xl:grid-cols-2">
            <PricingLadder list={competitors} />
            <FeatureMatrix list={competitors} />
          </div>
        </>
      ) : (
        <p className="surface p-5 text-sm text-muted-foreground">
          No competitors yet. Run a scan above (or research), or add ones you already know. Only competitors actually found in sources are added automatically, with pricing only when a source shows it.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">All competitors ({competitors.length})</h2>
        <AddCompetitorForm projectId={id} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {competitors.map((c) => (
          <CompetitorCard key={c.id} c={c} projectId={id} />
        ))}
      </div>
    </div>
  );
}

function CompetitorCard({ c, projectId }: { c: CompetitorRow; projectId: string }) {
  return (
    <article id={`competitor-${c.id}`} className="surface scroll-mt-24 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{c.name}</h3>
          {c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-xs text-muted-foreground hover:underline">{c.website}</a> : null}
          <p className="mt-1 text-[11px] text-muted-foreground">{ORIGIN[c.origin]}{c.lastScannedAt ? ` · scanned ${c.lastScannedAt.toISOString().slice(0, 10)}` : ""}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">{c.type}</span>
          <DeleteCompetitorButton projectId={projectId} competitorId={c.id} name={c.name} />
        </div>
      </div>
      {c.description ? <p className="mt-3 text-sm">{c.description}</p> : null}
      {c.targetCustomer ? <p className="mt-1 text-sm"><span className="text-muted-foreground">For:</span> {c.targetCustomer}</p> : null}
      {c.notes ? <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="text-xs text-muted-foreground">Your notes:</span> {c.notes}</p> : null}
      <div className="mt-4 rounded-xl border border-border p-3 text-sm">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Pricing</p>
        {c.pricing && c.pricingSource ? (
          <>
            <p className="mt-1">
              {String((c.pricing as { summary?: string }).summary ?? "")}{" "}
              <a href={c.pricingSource.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">
                source, retrieved {c.pricingSource.retrievedAt.toISOString().slice(0, 10)} <ExternalLink className="size-3" />
              </a>
            </p>
            {c.pricingPlans?.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {c.pricingPlans.map((p) => (
                  <li key={p.name} className="rounded-md bg-muted px-2 py-0.5 text-xs">{p.name}: {p.priceMonthly === null ? "custom" : p.priceMonthly === 0 ? "free" : `${p.priceMonthly} ${p.currency}/mo`}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-muted-foreground">Not found in sources yet. A scan looks for it.</p>
        )}
      </div>
      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <List title="Strengths" items={c.strengths ?? []} />
        <List title="Weaknesses" items={c.weaknesses ?? []} />
      </div>
      {c.features?.length ? <List title="Features mentioned" items={c.features} className="mt-4" /> : null}
      {c.sources.length ? (
        <div className="mt-4">
          <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Sources ({c.sources.length})</p>
          <ul className="space-y-0.5 text-xs">
            {c.sources.slice(0, 6).map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-muted-foreground hover:underline">
                  {s.title ?? s.domain} <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function List({ title, items, className }: { title: string; items: string[]; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      {items.length ? <ul className="list-disc space-y-1 pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-muted-foreground">Not found yet</p>}
    </div>
  );
}
