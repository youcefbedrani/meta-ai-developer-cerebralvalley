import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { StageBadge } from "@/components/projects/stage-badge";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getProject } from "@/server/data/projects";

export default async function ProjectLayout({ children, params }: LayoutProps<"/app/projects/[id]">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Projects
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{project.name}</h1>
          <StageBadge stage={project.stage} />
          {project.status === "archived" ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Archived</span>
          ) : null}
        </div>
      </div>
      <ProjectTabs projectId={project.id} />
      {children}
    </div>
  );
}
