import { ChevronLeft, ExternalLink, Globe } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExperimentControls } from "@/components/lab/experiment-controls";
import { ExperimentForm } from "@/components/lab/experiment-form";
import { InterviewTools } from "@/components/lab/interview-tools";
import { ResultsPanel } from "@/components/lab/results-panel";
import { ExperimentStatusBadge } from "@/components/lab/status-badge";
import { getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { EXPERIMENT_TYPES, notesAnalysisSchema } from "@/lib/validation/experiments";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getExperiment, listResults } from "@/server/data/experiments";
import { getLandingPageForExperiment, getPageStats } from "@/server/data/landing-pages";

const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : "");

export default async function ExperimentPage({ params }: PageProps<"/app/lab/[id]">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const e = await getExperiment(user.id, id);
  if (!e) notFound();
  const [results, page] = await Promise.all([listResults(user.id, id), getLandingPageForExperiment(user.id, id)]);
  const stats = page ? await getPageStats(page.id) : null;
  const ai = getIntegrationStatus("ai");

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/app/projects/${e.projectId}/validation`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> {e.projectName}
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{e.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <ExperimentStatusBadge status={e.status} passed={e.passed} />
              <span>{EXPERIMENT_TYPES.find((t) => t.value === e.type)?.label}</span>
            </div>
          </div>
          <ExperimentControls id={e.id} status={e.status} successCriteria={e.successCriteria} resultCount={results.length} />
        </div>
      </div>

      {e.status === "completed" ? (
        <div className={`rounded-2xl border p-5 ${e.passed ? "border-emerald-300 bg-emerald-50/60" : "border-rose-300 bg-rose-50/60"}`}>
          <p className="font-medium">{e.passed ? "You marked this experiment as passed." : "You marked this experiment as failed."}</p>
          {e.learnings ? <p className="mt-2 whitespace-pre-wrap text-sm">{e.learnings}</p> : null}
          {e.nextAction ? <p className="mt-2 text-sm text-muted-foreground">Next: {e.nextAction}</p> : null}
        </div>
      ) : null}

      {page && stats ? (
        <section className="surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-medium"><Globe className="size-4 text-primary" /> Landing page</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className={page.published ? "text-success" : "text-muted-foreground"}>{page.published ? "Published" : "Draft"}</span>
              <Link href={`/app/lab/pages/${page.id}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">Edit page <ExternalLink className="size-3.5" /></Link>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-4">
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Unique visits</dt><dd className="mt-1 text-2xl font-semibold">{stats.visits}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Signups</dt><dd className="mt-1 text-2xl font-semibold">{stats.signups}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Conversion</dt><dd className="mt-1 text-2xl font-semibold">{stats.conversion === null ? "—" : `${(stats.conversion * 100).toFixed(1)}%`}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Live counts from your published page. Compare against: {e.successCriteria}</p>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <ResultsPanel
            experimentId={e.id}
            results={results.map((r) => {
              const analysis = r.data && (r.data as { kind?: string }).kind === "interview_analysis" ? notesAnalysisSchema.safeParse((r.data as { analysis?: unknown }).analysis) : null;
              return { id: r.id, metric: r.metric, value: r.value, notes: r.notes, recordedAt: r.recordedAt.toISOString(), analysis: analysis?.success ? analysis.data : null };
            })}
          />
          {e.type === "interview" ? (
            <InterviewTools experimentId={e.id} hasScript={!!e.procedure} aiConfigured={ai.configured} aiMissing={ai.missing} costs={{ script: CREDIT_COSTS.interview_script, analysis: CREDIT_COSTS.interview_analysis }} />
          ) : null}
        </div>
        <ExperimentForm
          mode="edit"
          experimentId={e.id}
          initial={{ type: e.type, title: e.title, hypothesis: e.hypothesis, audience: e.audience ?? "", successCriteria: e.successCriteria, procedure: e.procedure ?? "", startDate: d(e.startDate), endDate: d(e.endDate) }}
        />
      </div>
    </div>
  );
}
