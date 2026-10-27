import { FlaskConical, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ExperimentStatusBadge } from "@/components/lab/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EXPERIMENT_TYPES } from "@/lib/validation/experiments";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { listExperiments } from "@/server/data/experiments";

export const metadata: Metadata = { title: "Validation Lab" };
const STATUSES = ["all", "running", "planned", "completed", "cancelled"] as const;

export default async function LabPage({ searchParams }: PageProps<"/app/lab">) {
  const user = await requireOnboardedUser();
  const { status: raw } = (await searchParams) as { status?: string };
  const status = STATUSES.includes(raw as never) ? (raw as (typeof STATUSES)[number]) : "all";
  const experiments = await listExperiments(user.id, status === "all" ? {} : { status });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Validation Lab"
        description="Real experiments with success criteria you set up front. Only results you record count as validation."
        actions={<Link href="/app/lab/new" className={cn(buttonVariants({ variant: "gradient" }), "h-10 px-4")}><Plus /> New experiment</Link>}
      />
      <div className="flex w-fit flex-wrap gap-1 rounded-full border border-border p-1 text-sm">
        {STATUSES.map((s) => (
          <Link key={s} href={s === "all" ? "/app/lab" : `/app/lab?status=${s}`} className={cn("rounded-full px-4 py-1.5 capitalize text-muted-foreground", status === s && "bg-accent text-foreground")}>{s}</Link>
        ))}
      </div>
      {experiments.length ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          {experiments.map((e) => (
            <Link key={e.id} href={`/app/lab/${e.id}`} className="flex flex-col gap-2 border-b border-border p-5 last:border-0 hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{e.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{e.projectName} · {EXPERIMENT_TYPES.find((t) => t.value === e.type)?.label}</p>
              </div>
              <ExperimentStatusBadge status={e.status} passed={e.passed} />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={FlaskConical} title={status === "all" ? "No experiments yet" : `No ${status} experiments`} description="Design an experiment from a project's research, or start one from scratch." action={<Link href="/app/lab/new" className={cn(buttonVariants({ variant: "gradient" }), "h-10 px-4")}><Plus /> New experiment</Link>} />
      )}
    </div>
  );
}
