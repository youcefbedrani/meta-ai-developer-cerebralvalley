import { ArrowRight, CircleDashed } from "lucide-react";
import { notFound } from "next/navigation";
import { EvidenceMix, ProjectMap, RatingMeters } from "@/components/projects/project-map";
import { ProjectSettingsForm } from "@/components/projects/project-settings-form";
import { buildProjectMap } from "@/lib/project-map";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { Scorecard } from "@/components/verdict/scorecard";
import { ShareControl } from "@/components/verdict/share-control";
import { ValidatePanel } from "@/components/verdict/validate-panel";
import { getEnv } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { getBalance } from "@/server/billing/credits";
import { getVerdictData } from "@/server/data/verdict";
import { VALIDATION_STEPS } from "@/server/services/research";

export default async function ProjectOverviewPage({ params }: PageProps<"/app/projects/[id]">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const [data, balance] = await Promise.all([getVerdictData(user.id, id), getBalance(user.id)]);
  if (!data) notFound();
  const { project, counts, ratings, run, verdict, fit } = data;
  const steps = run ? run.jobs.map((j, i) => ({ label: VALIDATION_STEPS[i]?.label ?? "Step", status: j.status, error: j.error })) : null;
  const separate = CREDIT_COSTS.research_job + CREDIT_COSTS.competitor_scan + CREDIT_COSTS.market_voices;

  return (
    <div className="space-y-6">
      <ValidatePanel projectId={project.id} steps={steps} cost={CREDIT_COSTS.full_validation} separateCost={separate} balance={balance} hasVerdict={verdict.score !== null} plan={user.plan} />
      {run?.active ? null : <Scorecard verdict={verdict} fit={fit} celebrateId={run?.runId} />}
      <ProjectMap phases={buildProjectMap(counts, project.id)} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ProjectSettingsForm
          project={{
            id: project.id,
            name: project.name,
            description: project.description,
            stage: project.stage,
            nextAction: project.nextAction,
            status: project.status,
          }}
        />
        <aside className="space-y-4">
          {verdict.score !== null ? <ShareControl projectId={project.id} token={project.shareToken} appUrl={getEnv().APP_URL} /> : null}
          <div className="surface p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Next action</p>
            <p className="mt-2 flex items-start gap-2 text-sm">
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" />
              {project.nextAction || "Not set yet"}
            </p>
          </div>
          <div className="surface p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Validation status</p>
            <p className="mt-2 flex items-start gap-2 text-sm">
              <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {project.decision ? `Decision recorded: ${project.decision}.` : counts.results ? `${counts.results} real experiment result${counts.results === 1 ? "" : "s"} recorded. Record a decision when you're ready.` : "Not validated. An idea counts as validated only after you record real experiment results."}
            </p>
          </div>
          <EvidenceMix counts={counts} />
          <RatingMeters ratings={ratings} />
        </aside>
      </div>
    </div>
  );
}
