import { ArrowRight, Check, Compass, FolderKanban, Lightbulb, Plus, SearchCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { buttonVariants } from "@/components/ui/button";
import { JOURNEY_STEPS, nextStep } from "@/lib/journey";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { countProjects, listProjects } from "@/server/data/projects";
import { listExperiments } from "@/server/data/experiments";
import { getJourneyProgress } from "@/server/data/journey";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  const [projects, counts, experiments, journey] = await Promise.all([
    listProjects(user.id, { status: "active" }),
    countProjects(user.id),
    listExperiments(user.id),
    getJourneyProgress(user.id),
  ]);
  const completedExperiments = experiments.filter((e) => e.status === "completed").length;
  const firstName = user.name?.split(" ")[0];

  const next = nextStep(journey.progress);
  const doneCount = JOURNEY_STEPS.filter((s) => journey.progress[s.id]).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={<>Welcome{firstName ? `, ${firstName}` : ""}</>}
        description="Every idea is a project. Research, competitors, experiments and plans all live inside it."
        actions={
          <Link href="/app/projects/new" className={cn(buttonVariants({ variant: "gradient" }), "h-10 px-4")}>
            <Plus /> New project
          </Link>
        }
      />

      <section className="stagger grid gap-4 sm:grid-cols-3">
        <Stat icon={FolderKanban} label="Active projects" value={counts.active} />
        <Stat icon={FolderKanban} label="Archived projects" value={counts.archived} />
        <Stat icon={SearchCheck} label="Completed experiments" value={completedExperiments} note={`${experiments.filter((e) => e.status === "running").length} running`} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Recent projects</h2>
            <Link href="/app/projects" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          {projects.length ? (
            <div className="stagger grid gap-3 sm:grid-cols-2">
              {projects.slice(0, 4).map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          ) : (
            <div className="ambient-glow rounded-2xl border border-dashed border-border p-8 text-center">
              <Lightbulb className="mx-auto size-6 text-primary" />
              <p className="mt-3 font-medium">No projects yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Start with an idea you already have.</p>
              <Link href="/app/projects/new" className={cn(buttonVariants({ variant: "outline" }), "mt-4 rounded-[10px]")}>
                Create a project <ArrowRight />
              </Link>
            </div>
          )}
        </div>

        <div className="surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">Your journey</h2>
            <span className="text-xs text-muted-foreground">{doneCount}/{JOURNEY_STEPS.length} done</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="bar-grow h-full rounded-full bg-brand-gradient" style={{ width: `${Math.round((doneCount / JOURNEY_STEPS.length) * 100)}%` }} />
          </div>
          <ol className="mt-4 space-y-2.5">
            {JOURNEY_STEPS.map((s) => {
              const done = journey.progress[s.id];
              const isNext = next?.id === s.id;
              return (
                <li key={s.id}>
                  <Link href={`/app/guide#step-${s.id}`} className="flex items-start gap-3 text-sm">
                    <span
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                        done ? "border-transparent bg-brand-gradient text-white" : isNext ? "border-2 border-[var(--violet)]" : "border-border",
                      )}
                    >
                      {done ? <Check className="size-3" /> : null}
                    </span>
                    <span className={cn(done && "text-muted-foreground line-through", isNext && "font-medium")}>{s.title}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <Link href="/app/guide" className={cn(buttonVariants({ variant: next ? "gradient" : "outline" }), "mt-5 h-9 w-full rounded-[10px]")}>
            <Compass /> {next ? "Open the step-by-step guide" : "View the guide"}
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, note }: { icon: typeof FolderKanban; label: string; value: number; note?: string }) {
  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
