import { notFound } from "next/navigation";
import { ReportView } from "@/components/research/report-view";
import { ResearchRunner } from "@/components/research/research-runner";
import { getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { getProject } from "@/server/data/projects";
import { getLatestValidationReport, listResearchJobs } from "@/server/data/research";

export default async function ProjectResearchPage({ params }: PageProps<"/app/projects/[id]/research">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();
  const [jobs, report, balance] = await Promise.all([listResearchJobs(user.id, id, 1), getLatestValidationReport(user.id, id), getBalance(user.id)]);
  const job = jobs[0] ?? null;
  const missing = (["ai", "search", "redis"] as const)
    .map((n) => getIntegrationStatus(n))
    .filter((s) => !s.configured)
    .map((s) => ({ label: s.label, vars: s.missing }));

  return (
    <div className="space-y-6">
      <ResearchRunner
        projectId={id}
        job={job ? { id: job.id, status: job.status, currentStage: job.currentStage, error: job.error, createdAt: job.createdAt.toISOString() } : null}
        hasReport={!!report}
        cost={CREDIT_COSTS.research_job}
        balance={balance}
        missing={missing}
      />
      {report ? <ReportView data={report} /> : null}
    </div>
  );
}
