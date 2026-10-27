import { Lightbulb, Search } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { IdeaGenerator } from "@/components/ideas/idea-generator";
import { IdeaGrid } from "@/components/ideas/idea-grid";
import { getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { BUDGETS, BUSINESS_MODELS, TIME_COMMITMENTS } from "@/lib/validation/onboarding";
import { ideaListQuerySchema } from "@/lib/validation/ideas";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { listIdeas } from "@/server/data/ideas";
import { getProfile } from "@/server/data/profiles";

export const metadata: Metadata = { title: "Discover Ideas" };

const label = (list: readonly { value: string; label: string }[], v?: string) => list.find((o) => o.value === v)?.label ?? "";

export default async function IdeasPage({ searchParams }: PageProps<"/app/ideas">) {
  const user = await requireOnboardedUser();
  const query = ideaListQuerySchema.parse(await searchParams);
  const [ideas, profile, balance] = await Promise.all([listIdeas(user.id, query), getProfile(user.id), getBalance(user.id)]);
  const ai = getIntegrationStatus("ai");
  const filtered = query.q || query.status !== "all" || query.complexity !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discover Ideas"
        description="AI-generated starting points matched to your profile. Every idea is a hypothesis until research and experiments say otherwise."
      />

      <IdeaGenerator
        defaults={{
          skills: profile?.skills.join(", ") ?? "",
          niche: profile?.interests.join(", ") ?? "",
          customer: profile?.targetMarkets.join(", ") ?? "",
          budget: label(BUDGETS, profile?.budget),
          timeAvailable: label(TIME_COMMITMENTS, profile?.timePerWeek),
          businessModel: profile?.businessModels.map((m) => label(BUSINESS_MODELS, m)).join(", ") ?? "",
          complexity: "any",
          count: 4,
        }}
        cost={CREDIT_COSTS.idea_generation}
        balance={balance}
        aiConfigured={ai.configured}
        aiMissing={ai.missing}
        startOpen={ideas.length === 0 && !filtered}
      />

      <form className="flex flex-col gap-2 sm:flex-row sm:items-center" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={query.q} placeholder="Search ideas" className="h-10 w-full rounded-full border border-input bg-transparent pl-9 pr-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>
        <select name="status" defaultValue={query.status} className="h-10 rounded-full border border-input bg-transparent px-3 text-sm" aria-label="Status">
          {["all", "generated", "saved", "converted", "dismissed"].map((s) => (
            <option key={s} value={s} className="bg-popover">{s === "all" ? "All (not dismissed)" : s[0].toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select name="complexity" defaultValue={query.complexity} className="h-10 rounded-full border border-input bg-transparent px-3 text-sm" aria-label="Complexity">
          {["all", "low", "medium", "high"].map((c) => (
            <option key={c} value={c} className="bg-popover">{c === "all" ? "Any complexity" : `${c[0].toUpperCase()}${c.slice(1)} complexity`}</option>
          ))}
        </select>
        <select name="sort" defaultValue={query.sort} className="h-10 rounded-full border border-input bg-transparent px-3 text-sm" aria-label="Sort">
          <option value="newest" className="bg-popover">Newest</option>
          <option value="oldest" className="bg-popover">Oldest</option>
          <option value="complexity" className="bg-popover">Simplest first</option>
        </select>
        <button className="h-10 rounded-full border border-border px-4 text-sm hover:bg-accent">Apply</button>
      </form>

      {ideas.length ? (
        <IdeaGrid
          ideas={ideas.map((i) => ({
            id: i.id,
            title: i.content.title,
            oneLiner: i.content.oneLiner,
            targetCustomer: i.content.targetCustomer,
            complexity: i.content.complexity,
            status: i.status,
            projectId: i.projectId,
            createdAt: i.createdAt.toISOString(),
          }))}
        />
      ) : (
        <EmptyState
          icon={Lightbulb}
          title={filtered ? "No ideas match these filters" : "No ideas yet"}
          description={filtered ? "Try clearing the search or filters." : "Generate your first batch above. They're tailored to the profile you filled in."}
        />
      )}
    </div>
  );
}
