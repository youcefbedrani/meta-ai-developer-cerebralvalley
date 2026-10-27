import { ArrowRight, SearchCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StageBadge } from "@/components/projects/stage-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getResearchOverview } from "@/server/data/research";

export const metadata: Metadata = { title: "Research & Validate" };
const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

const STATUS: Record<string, string> = { queued: "Queued", running: "Running", succeeded: "Completed", failed: "Failed", cancelled: "Cancelled" };

export default async function ResearchOverviewPage() {
  const user = await requireOnboardedUser();
  const rows = await getResearchOverview(user.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Research & Validate" description="Sourced research and validation status across your active projects." />
      {rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          {rows.map((p) => (
            <Link key={p.id} href={`/app/projects/${p.id}/research`} className="flex flex-col gap-3 border-b border-border p-5 last:border-0 hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <StageBadge stage={p.stage} />
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{p.latestReport?.summary ?? "No research yet."}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-sm text-muted-foreground">
                {p.latestJob ? <span>{STATUS[p.latestJob.status]} · {fmt.format(p.latestJob.createdAt)}</span> : <span>Not started</span>}
                <ArrowRight className="size-4" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={SearchCheck} title="No projects to research" description="Create a project or turn an idea into one first." action={<Link href="/app/projects/new" className={cn(buttonVariants({ variant: "gradient" }), "h-10 px-5")}>New project</Link>} />
      )}
    </div>
  );
}
