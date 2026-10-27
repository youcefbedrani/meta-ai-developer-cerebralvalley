import { ArrowRight, Lightbulb, Sparkles } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generateIdeasAction } from "@/app/(app)/app/(founder)/gold-mine/actions";
import { IdeaGrid } from "@/components/ideas/idea-grid";
import type { PainCluster } from "@/server/data/gold-mine";
import type { listSessionIdeas } from "@/server/data/gold-mine";
import { ideaContentSchema } from "@/lib/validation/ideas";
import { ActionButton } from "./action-button";
import { ClusterCard } from "./pains-step";

export function IdeasStep({ sessionId, clusters, ideas, cost }: { sessionId: string; clusters: PainCluster[]; ideas: Awaited<ReturnType<typeof listSessionIdeas>>; cost: number }) {
  if (!clusters.length) {
    return (
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6 text-sm">
        <p className="font-medium text-warning">Needs more data</p>
        <p className="mt-1 text-muted-foreground">Ideas are only generated from real pain clusters. Mine pains first (or broaden the niche if mining found too little).</p>
      </div>
    );
  }
  const titleById = new Map(clusters.map((c) => [c.id, c.title]));
  return (
    <div className="space-y-6">
      <section className="surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-medium"><Lightbulb className="size-4 text-primary" /> Ideas from {clusters.length} pain cluster{clusters.length === 1 ? "" : "s"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Every idea must link to at least one real pain cluster — unlinked ideas are rejected automatically.</p>
          </div>
          <ActionButton action={generateIdeasAction} args={[sessionId]} success="Ideas generated">
            <Sparkles /> {ideas.length ? "Generate more" : "Generate ideas"} · {cost} credits
          </ActionButton>
        </div>
      </section>

      {ideas.length ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">Ideas · tick 2–3 to compare</h3>
            <Link href={`/app/gold-mine/${sessionId}?step=landing`} className={cn(buttonVariants({ variant: "gradient" }), "h-9 px-4")}>Draft a landing page <ArrowRight /></Link>
          </div>
          <IdeaGrid
            ideas={ideas.flatMap((i) => {
              const c = ideaContentSchema.safeParse(i.content);
              if (!c.success) return [];
              return [{
                id: i.id,
                title: c.data.title,
                oneLiner: c.data.oneLiner,
                targetCustomer: `${c.data.targetCustomer} · Solves: ${i.clusterIds.map((id) => titleById.get(id) ?? "cluster").join(", ")}`,
                complexity: c.data.complexity,
                status: i.status,
                projectId: i.projectId,
                createdAt: i.createdAt.toISOString(),
              }];
            })}
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">The evidence</h3>
        {clusters.map((c) => <ClusterCard key={c.id} c={c} compact />)}
      </section>
    </div>
  );
}
