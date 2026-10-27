import { ArrowRight, Megaphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StageBadge } from "@/components/projects/stage-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getMarketingOverview } from "@/server/data/marketing";

export const metadata: Metadata = { title: "Marketing Studio" };

export default async function MarketingOverviewPage() {
  const user = await requireOnboardedUser();
  const rows = await getMarketingOverview(user.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Marketing Studio" description="Get your first customers for each project: a focused channel plan, playbook, assets, ad tests with a budget per platform, and real results. Pick a project to open its studio." />
      {rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          {rows.map((p) => (
            <Link key={p.id} href={`/app/projects/${p.id}/marketing`} className="flex flex-col gap-3 border-b border-border p-5 last:border-0 hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2"><span className="font-medium">{p.name}</span><StageBadge stage={p.stage} /></div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {p.hasPlan ? (
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-brand-gradient" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} /></span>
                    {p.done}/{p.total} steps done
                  </span>
                ) : <span>No plan yet</span>}
                <ArrowRight className="size-4" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={Megaphone} title="No projects yet" description="Create a project (or turn a Gold Mine idea into one) to plan how you'll reach customers." action={<Link href="/app/projects/new" className={cn(buttonVariants({ variant: "gradient" }), "h-10 px-5")}>New project</Link>} />
      )}
    </div>
  );
}
