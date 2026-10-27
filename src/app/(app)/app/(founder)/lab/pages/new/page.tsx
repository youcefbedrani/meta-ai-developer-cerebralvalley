import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { LandingEditor } from "@/components/lab/landing-editor";
import { getEnv, getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { listExperiments } from "@/server/data/experiments";
import { suggestSlug } from "@/server/data/landing-pages";
import { getProject } from "@/server/data/projects";
import { getBrandKit } from "@/server/services/brand";

export const metadata: Metadata = { title: "New landing page" };

export default async function NewLandingPage({ searchParams }: PageProps<"/app/lab/pages/new">) {
  const user = await requireOnboardedUser();
  const { project: projectId } = (await searchParams) as { project?: string };
  const project = projectId ? await getProject(user.id, projectId) : null;
  if (!project) notFound();
  const brand = await getBrandKit(user.id, project.id);
  const experiments = (await listExperiments(user.id, { projectId: project.id })).filter((e) => (e.type === "landing_page" || e.type === "waitlist") && e.status !== "completed");
  return (
    <div className="space-y-6">
      <PageHeader title="New landing page" description={`A waitlist page to test demand for “${project.name}”. Visits and signups are counted for real.`} />
      <LandingEditor
        mode="create"
        projectId={project.id}
        projectName={project.name}
        brand={brand}
        brandCost={CREDIT_COSTS.brand_kit}
        suggestedSlug={suggestSlug(project.name)}
        experiments={experiments.map((e) => ({ id: e.id, title: e.title }))}
        aiConfigured={getIntegrationStatus("ai").configured}
        copyCost={CREDIT_COSTS.landing_copy}
        appUrl={getEnv().APP_URL}
      />
    </div>
  );
}
