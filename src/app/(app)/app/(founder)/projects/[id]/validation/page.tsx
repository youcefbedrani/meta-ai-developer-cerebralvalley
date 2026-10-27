import { FlaskConical, Globe, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddRecommendedButton } from "@/components/lab/add-recommended";
import { DecisionPanel } from "@/components/lab/decision-panel";
import { ExperimentStatusBadge } from "@/components/lab/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EXPERIMENT_TYPES } from "@/lib/validation/experiments";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getValidationSummary, listExperiments } from "@/server/data/experiments";
import { listLandingPages } from "@/server/data/landing-pages";
import { getProject } from "@/server/data/projects";
import { getLatestValidationReport } from "@/server/data/research";

export default async function ProjectValidationPage({ params }: PageProps<"/app/projects/[id]/validation">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();
  const [experiments, summary, pages, report] = await Promise.all([
    listExperiments(user.id, { projectId: id }),
    getValidationSummary(user.id, id),
    listLandingPages(user.id, id),
    getLatestValidationReport(user.id, id),
  ]);
  const existingTitles = new Set(experiments.map((e) => e.title));
  const recs = report?.report.recommendedExperiments.map((r, i) => ({ ...r, i, title: r.title.replace(/^\[Mock\]\s*/, "") })).filter((r) => !existingTitles.has(r.title)) ?? [];

  return (
    <div className="space-y-6">
      <DecisionPanel projectId={id} current={project.decision} note={project.decisionNote} summary={summary} />

      <section className="surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-medium"><FlaskConical className="size-4 text-primary" /> Experiments</h2>
          <Link href={`/app/lab/new?project=${id}`} className={cn(buttonVariants({ variant: "outline" }), "rounded-[10px]")}><Plus /> New experiment</Link>
        </div>
        {experiments.length ? (
          <ul className="mt-4 divide-y divide-border">
            {experiments.map((e) => (
              <li key={e.id}>
                <Link href={`/app/lab/${e.id}`} className="flex flex-col gap-1 py-3 hover:text-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm"><span className="font-medium">{e.title}</span> <span className="text-muted-foreground">· {EXPERIMENT_TYPES.find((t) => t.value === e.type)?.label}</span></span>
                  <ExperimentStatusBadge status={e.status} passed={e.passed} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No experiments yet.</p>
        )}
        {recs.length ? (
          <div className="mt-5 rounded-xl border border-dashed border-border p-4">
            <p className="text-sm font-medium">Recommended by your research</p>
            <ul className="mt-3 space-y-2">
              {recs.map((r) => (
                <li key={r.i} className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span><span className="font-medium">{r.title}</span> <span className="text-muted-foreground">— {r.successCriteria}</span></span>
                  <AddRecommendedButton projectId={id} index={r.i} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-medium"><Globe className="size-4 text-primary" /> Landing pages & waitlists</h2>
          <Link href={`/app/lab/pages/new?project=${id}`} className={cn(buttonVariants({ variant: "outline" }), "rounded-[10px]")}><Plus /> New landing page</Link>
        </div>
        {pages.length ? (
          <ul className="mt-4 divide-y divide-border">
            {pages.map((p) => (
              <li key={p.id}>
                <Link href={`/app/lab/pages/${p.id}`} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm"><span className="font-medium">{p.content.headline}</span> <span className="text-muted-foreground">· /p/{p.slug}</span></span>
                  <span className="text-xs text-muted-foreground">{p.published ? "Published" : "Draft"} · {p.visitCount} visits · {p.signups} signups</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No landing pages yet. Create one to test demand with a real waitlist.</p>
        )}
      </section>
    </div>
  );
}
