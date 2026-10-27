import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemandStep } from "@/components/gold-mine/demand-step";
import { IdeasStep } from "@/components/gold-mine/ideas-step";
import { LandingStep } from "@/components/gold-mine/landing-step";
import { PainsStep } from "@/components/gold-mine/pains-step";
import { GoldMineStepper } from "@/components/gold-mine/stepper";
import { getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { GOLD_MINE_STEPS, type GoldMineStep } from "@/lib/validation/gold-mine";
import { ideaContentSchema } from "@/lib/validation/ideas";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getSession, listClusters, listDemandChecks, listPainQuotes, listSessionIdeas } from "@/server/data/gold-mine";
import { getLandingPage, getPageStats } from "@/server/data/landing-pages";
import type { DemandSummary } from "@/server/services/gold-mine";

export default async function GoldMineSessionPage({ params, searchParams }: PageProps<"/app/gold-mine/[id]">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const session = await getSession(user.id, id);
  if (!session) notFound();
  const { step: raw } = (await searchParams) as { step?: string };
  const order = GOLD_MINE_STEPS.map((s) => s.key);
  // Once ideas exist, the landing step is unlocked.
  const hasIdeas = session.currentStep === "ideas" && (await listSessionIdeas(user.id, id)).length > 0;
  const reached: GoldMineStep = hasIdeas ? "landing" : session.currentStep;
  const requested = order.includes(raw as GoldMineStep) && raw !== "market" ? (raw as GoldMineStep) : session.currentStep;
  // Can't jump ahead of the furthest step reached.
  const viewing = order.indexOf(requested) <= order.indexOf(reached) ? requested : session.currentStep;

  let body: React.ReactNode = null;
  if (viewing === "demand" || viewing === "market") {
    const rows = await listDemandChecks(user.id, id);
    body = <DemandStep sessionId={id} niche={session.niche} rows={rows} summary={session.demandSummary as DemandSummary | null} keywordStatus={getIntegrationStatus("keywords")} cost={CREDIT_COSTS.demand_check} acknowledged={session.demandAcknowledged} />;
  } else if (viewing === "pains") {
    const [quotes, clusters] = await Promise.all([listPainQuotes(user.id, id), listClusters(user.id, id)]);
    const missing = (["ai", "search", "redis"] as const).map((n) => getIntegrationStatus(n)).filter((s) => !s.configured).map((s) => ({ label: s.label, vars: s.missing }));
    body = <PainsStep session={session} quotes={quotes} clusters={clusters} cost={CREDIT_COSTS.pain_mining} missing={missing} />;
  } else if (viewing === "ideas") {
    const [clusters, ideas] = await Promise.all([listClusters(user.id, id), listSessionIdeas(user.id, id)]);
    body = <IdeasStep sessionId={id} clusters={clusters} ideas={ideas} cost={CREDIT_COSTS.gold_ideas} />;
  } else {
    const [ideas, quotes, page] = await Promise.all([listSessionIdeas(user.id, id), listPainQuotes(user.id, id), session.landingPageId ? getLandingPage(user.id, session.landingPageId) : null]);
    const stats = page ? await getPageStats(page.id) : null;
    body = (
      <LandingStep
        sessionId={id}
        ideas={ideas.flatMap((i) => {
          const c = ideaContentSchema.safeParse(i.content);
          return c.success ? [{ id: i.id, title: c.data.title, oneLiner: c.data.oneLiner, linkedClusters: i.clusterIds.length }] : [];
        })}
        page={page ? { id: page.id, slug: page.slug, published: page.published, content: page.content } : null}
        stats={stats}
        quotesById={new Map(quotes.map((q) => [q.id, q]))}
        cost={CREDIT_COSTS.gold_landing}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/gold-mine" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Gold Mine</Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-[28px]">{session.niche}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{session.mode === "market" ? (session.marketPath ?? []).join(" › ") : session.ideaDescription || "Started from your idea"}</p>
      </div>
      <GoldMineStepper sessionId={id} current={reached} viewing={viewing} mode={session.mode} />
      {body}
    </div>
  );
}
