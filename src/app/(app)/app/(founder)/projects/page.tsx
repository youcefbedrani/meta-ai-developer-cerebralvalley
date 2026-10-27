import { FolderKanban, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { listProjects } from "@/server/data/projects";

export const metadata: Metadata = { title: "My Projects" };

export default async function ProjectsPage({ searchParams }: PageProps<"/app/projects">) {
  const user = await requireOnboardedUser();
  const { view } = (await searchParams) as { view?: string };
  const status = view === "archived" ? "archived" : "active";
  const projects = await listProjects(user.id, { status });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Projects"
        description="Each idea is a project. Everything you learn about it is stored in one place."
        actions={
          <Link href="/app/projects/new" className={cn(buttonVariants({ variant: "gradient" }), "h-10 px-4")}>
            <Plus /> New project
          </Link>
        }
      />
      <div className="flex gap-1 rounded-full border border-border p-1 text-sm w-fit">
        {(["active", "archived"] as const).map((s) => (
          <Link
            key={s}
            href={s === "active" ? "/app/projects" : "/app/projects?view=archived"}
            className={cn(
              "rounded-full px-4 py-1.5 capitalize text-muted-foreground transition-colors",
              status === s && "bg-accent text-foreground",
            )}
          >
            {s}
          </Link>
        ))}
      </div>
      {projects.length ? (
        <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title={status === "archived" ? "No archived projects" : "No projects yet"}
          description={
            status === "archived"
              ? "Projects you archive appear here."
              : "Create a project for an idea you want to research and validate."
          }
          action={
            status === "active" ? (
              <Link href="/app/projects/new" className={cn(buttonVariants({ variant: "gradient" }), "h-10 px-4")}>
                <Plus /> Create your first project
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
