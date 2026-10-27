import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Project } from "@/server/data/projects";
import { StageBadge } from "./stage-badge";

const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/app/projects/${project.id}`}
      className="group surface flex flex-col gap-3 p-5 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug">{project.name}</h3>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      {project.description ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground/70">No description yet</p>
      )}
      <div className="mt-auto flex items-center justify-between pt-1 text-xs text-muted-foreground">
        <StageBadge stage={project.stage} />
        <span>Updated {dateFmt.format(project.updatedAt)}</span>
      </div>
    </Link>
  );
}
