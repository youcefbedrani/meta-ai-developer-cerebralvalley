import { notFound } from "next/navigation";
import { AutopilotPanel } from "@/components/autopilot/autopilot-panel";
import { getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { getProject } from "@/server/data/projects";
import { getLatestAutopilotRun } from "@/server/services/autopilot";

export default async function ProjectAutopilotPage({ params, searchParams }: PageProps<"/app/projects/[id]/autopilot">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const goal = (await searchParams).goal;
  const project = await getProject(user.id, id);
  if (!project) notFound();
  const [run, balance] = await Promise.all([getLatestAutopilotRun(user.id, id), getBalance(user.id)]);
  const missing = (["ai", "search", "redis"] as const)
    .map((n) => getIntegrationStatus(n))
    .filter((s) => !s.configured)
    .map((s) => ({ label: s.label, vars: s.missing }));

  return (
    <AutopilotPanel
      projectId={id}
      initialGoal={typeof goal === "string" ? goal.slice(0, 500) : ""}
      run={
        run
          ? {
              id: run.id,
              status: run.status,
              goal: run.goal,
              trace: run.trace,
              verdict: run.verdict,
              error: run.error,
              startedAt: run.startedAt?.toISOString() ?? null,
              finishedAt: run.finishedAt?.toISOString() ?? null,
            }
          : null
      }
      cost={CREDIT_COSTS.autopilot + CREDIT_COSTS.full_validation}
      balance={balance}
      missing={missing}
    />
  );
}
