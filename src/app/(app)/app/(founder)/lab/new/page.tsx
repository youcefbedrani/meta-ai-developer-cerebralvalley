import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { ExperimentForm } from "@/components/lab/experiment-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { listProjects } from "@/server/data/projects";

export const metadata: Metadata = { title: "New experiment" };

export default async function NewExperimentPage({ searchParams }: PageProps<"/app/lab/new">) {
  const user = await requireOnboardedUser();
  const { project } = (await searchParams) as { project?: string };
  const projects = await listProjects(user.id, { status: "active" });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="New experiment" description="Write the hypothesis and success criteria before you start, so the result can't be rationalised afterwards." />
      {projects.length ? (
        <ExperimentForm mode="create" projects={projects.map((p) => ({ id: p.id, name: p.name }))} defaultProjectId={projects.some((p) => p.id === project) ? project : undefined} />
      ) : (
        <div className="surface p-6 text-sm text-muted-foreground">
          You need a project first. <Link href="/app/projects/new" className={cn(buttonVariants({ variant: "link" }), "px-1")}>Create one</Link>
        </div>
      )}
    </div>
  );
}
