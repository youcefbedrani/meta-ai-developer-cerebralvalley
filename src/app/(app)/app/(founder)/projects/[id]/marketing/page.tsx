import { Link2, Megaphone, Settings2, Sprout, Target, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfigErrorNotice } from "@/components/config-error";
import { AdTestsPanel, type VariantTemplate } from "@/components/marketing/ad-tests-panel";
import { AssetsPanel } from "@/components/marketing/assets-panel";
import { ChannelsBudget } from "@/components/marketing/channels-budget";
import { GtmSetupForm } from "@/components/marketing/gtm-setup-form";
import { OrganicSection } from "@/components/marketing/organic-section";
import { PaidSection } from "@/components/marketing/paid-section";
import { PlanTabs } from "@/components/marketing/plan-tabs";
import { Playbook } from "@/components/marketing/playbook";
import { ResultsPanel } from "@/components/marketing/results-panel";
import { StrategySection } from "@/components/marketing/strategy-section";
import { getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { buildUtmUrl, goalLabel, type GtmSetup } from "@/lib/validation/marketing";
import { parseAssetContent } from "@/lib/validation/marketing-assets";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { listCustomerLanguage } from "@/server/data/gold-mine";
import { listLandingPages } from "@/server/data/landing-pages";
import { getLatestMarketingPlan, listChannelResults, listMarketingTasks } from "@/server/data/marketing";
import {
  buildChannelFunnels,
  getLatestRecommendation,
  getMonthSpend,
  getTrackedEvents,
  landingUrlFor,
  listAdExperiments,
  listAssets,
  listChannels,
  listUtmLinks,
  trackedBySource,
} from "@/server/data/marketing-studio";
import { getProfile } from "@/server/data/profiles";
import { getProject } from "@/server/data/projects";

const HOURS: Record<string, number> = { under_5h: 3, "5_15h": 8, "15_30h": 15, full_time: 25 };

export default async function ProjectMarketingPage({ params }: PageProps<"/app/projects/[id]/marketing">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();
  const [saved, pages, profile, channels, results, tracked, monthSpend, assets, quotes, tests, links, rec] = await Promise.all([
    getLatestMarketingPlan(user.id, id),
    listLandingPages(user.id, id),
    getProfile(user.id),
    listChannels(user.id, id),
    listChannelResults(user.id, id),
    getTrackedEvents(user.id, id),
    getMonthSpend(user.id, id),
    listAssets(user.id, id),
    listCustomerLanguage(user.id, id),
    listAdExperiments(user.id, id),
    listUtmLinks(user.id, id),
    getLatestRecommendation(user.id, id),
  ]);
  const tasks = saved ? await listMarketingTasks(user.id, saved.id) : [];
  const ai = getIntegrationStatus("ai");
  const published = pages.filter((p) => p.published);
  const landingUrl = published[0] ? landingUrlFor(published[0].slug) : null;
  const setupDefaults: Partial<GtmSetup> = saved?.inputs ?? { skills: profile?.skills ?? [], hoursPerWeek: profile ? HOURS[profile.timePerWeek] : 5, monthlyBudget: 0, currency: "USD" };
  const currency = saved?.inputs?.currency ?? "USD";

  const header = (
    <section className="surface ambient-glow p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><Megaphone className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">Marketing Studio</h2>
          <p className="mt-1 text-sm text-muted-foreground">Get your first customers: a focused channel plan, an 8-week playbook, ready-to-edit assets, small ad tests with your own budget per platform, and results from real tracking.</p>
          {saved?.inputs ? (
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span><b className="text-foreground">Goal:</b> {goalLabel(saved.inputs)}</span>
              <span><b className="text-foreground">Budget:</b> {saved.inputs.currency} {saved.inputs.monthlyBudget}/month</span>
              <span><b className="text-foreground">Time:</b> {saved.inputs.hoursPerWeek} h/week</span>
              <span><b className="text-foreground">Market:</b> {saved.inputs.geography} · {saved.inputs.audienceType.toUpperCase()}</span>
            </p>
          ) : null}
        </div>
      </div>
      {!ai.configured ? <div className="mt-4"><ConfigErrorNotice title="AI provider is not configured" missing={ai.missing} /></div> : null}
      {saved ? (
        <details className="mt-4 rounded-xl border border-border bg-white p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><Settings2 className="size-4" /> Edit setup & regenerate plan</summary>
          <div className="mt-4"><GtmSetupForm projectId={id} defaults={setupDefaults} cost={CREDIT_COSTS.marketing_plan} regenerate disabled={!ai.configured} /></div>
        </details>
      ) : null}
      {saved && !landingUrl ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" /> Publish a landing page first so every channel has somewhere to send people.{" "}
          <Link href={`/app/projects/${id}/validation`} className="font-medium text-foreground underline-offset-4 hover:underline">Landing pages</Link>
        </p>
      ) : null}
      {saved?.legacy ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" /> This plan was made with an older version. Regenerate it to get fit scores, the setup tasks and budget suggestions.
        </p>
      ) : null}
    </section>
  );

  if (!saved) {
    return (
      <div className="space-y-6">
        {header}
        <section className="surface p-6">
          <h2 className="font-medium">1. Go-to-market setup</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tell us your budget, time and goal. The plan focuses on 1–2 primary channels plus at most one test, so you don&apos;t spread yourself thin.</p>
          <div className="mt-5"><GtmSetupForm projectId={id} defaults={setupDefaults} cost={CREDIT_COSTS.marketing_plan} disabled={!ai.configured} /></div>
        </section>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Target, t: "Focused channel plan", d: "Fit scores tied to your research, with costs labelled as assumptions to test." },
            { icon: Sprout, t: "8-week playbook + assets", d: "Week-0 setup, weekly tasks with due dates, and copy for each channel." },
            { icon: Wallet, t: "Budgets, ad tests & results", d: "A budget per platform, small ad tests with stop rules, and real tracked signups." },
          ].map((x) => (
            <div key={x.t} className="surface p-5">
              <x.icon className="size-5 text-[var(--violet)]" />
              <p className="mt-3 font-medium">{x.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const plan = saved.plan;
  const bySource = trackedBySource(tracked);
  const channelRows = channels.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    role: c.role,
    status: c.status,
    monthlyBudget: c.monthlyBudget === null ? null : Number(c.monthlyBudget),
    currency: c.currency,
    spentThisMonth: (monthSpend.get(c.id) ?? 0) + (monthSpend.get(`name:${c.name.toLowerCase()}`) ?? 0),
    trackingUrl: landingUrl ? buildUtmUrl(landingUrl, { source: c.utmSource, medium: c.type, campaign: "launch" }) : null,
    signups: bySource.get(c.utmSource)?.signups ?? 0,
  }));
  const quoteText = Object.fromEntries(quotes.map((q) => [q.id, q.quote]));
  const templates: VariantTemplate[] = [
    ...assets.filter((a) => a.type === "ad_variants").flatMap((a) => {
      const c = parseAssetContent("ad_variants", a.content) as { variants: { angle: string; headline: string; primaryText: string; cta: string; audienceIdea: string }[] } | null;
      return (c?.variants ?? []).map((v) => ({ ...v, assetId: a.id, source: a.channelName }));
    }),
    ...plan.paid.platforms.flatMap((p) => p.ads.map((ad) => ({ angle: ad.angle, headline: ad.headline, primaryText: ad.primaryText, cta: ad.cta, audienceIdea: p.targeting[0] ?? "", assetId: null, source: `Plan · ${p.platform}` }))),
  ];

  return (
    <div className="space-y-6">
      {header}
      <PlanTabs
        tabs={[
          { value: "strategy", label: "Strategy", content: <StrategySection plan={plan} /> },
          { value: "organic", label: "Organic", content: <OrganicSection plan={plan} /> },
          { value: "paid", label: "Paid ads", content: <PaidSection plan={plan} /> },
          { value: "channels", label: "Channels & budget", content: <ChannelsBudget projectId={id} channels={channelRows} monthlyBudget={saved.inputs?.monthlyBudget ?? null} currency={currency} /> },
          {
            value: "playbook",
            label: "Playbook",
            content: <Playbook tasks={tasks.map((t) => ({ id: t.id, week: t.week, channel: t.channel, channelType: t.channelType, title: t.title, description: t.description, successMetric: t.successMetric, expectedOutput: t.expectedOutput, dueDate: t.dueDate?.toISOString() ?? null, status: t.status }))} />,
          },
          {
            value: "assets",
            label: "Assets",
            content: (
              <AssetsPanel
                channels={channels.map((c) => ({ id: c.id, name: c.name, type: c.type }))}
                assets={assets.map((a) => ({ id: a.id, groupId: a.groupId, type: a.type, title: a.title, channelName: a.channelName, version: a.version, source: a.source, content: a.content, policyWarnings: a.policyWarnings, quoteIds: a.quoteIds, createdAt: a.createdAt.toISOString() }))}
                quotes={quoteText}
                cost={CREDIT_COSTS.marketing_assets}
                aiReady={ai.configured}
              />
            ),
          },
          {
            value: "ads",
            label: "Ad tests",
            content: (
              <AdTestsPanel
                projectId={id}
                basePath={`/app/projects/${id}/marketing`}
                tests={tests.map((t) => ({ id: t.id, name: t.name, platform: t.platform, status: t.status, budgetTotal: t.budgetTotal, currency: t.currency, durationDays: t.durationDays, maxCostPerSignup: t.maxCostPerSignup, variantCount: t.variantCount }))}
                paidChannels={channels.filter((c) => c.type === "paid").map((c) => ({ id: c.id, name: c.name }))}
                templates={templates}
                currency={currency}
                hasLandingPage={!!landingUrl}
              />
            ),
          },
          {
            value: "results",
            label: "Results",
            content: (
              <ResultsPanel
                projectId={id}
                channels={channels.map((c) => ({ id: c.id, name: c.name, type: c.type }))}
                funnels={buildChannelFunnels(channels, results.filter((r) => !r.adVariantId), tracked)}
                rows={results.map((r) => ({
                  id: r.id,
                  channel: r.channel,
                  periodStart: r.periodStart.toISOString().slice(0, 10),
                  periodEnd: r.periodEnd.toISOString().slice(0, 10),
                  summary: [r.spend !== null && `${currency} ${r.spend}`, r.clicks !== null && `${r.clicks} clicks`, r.visits !== null && `${r.visits} visits`, r.signups !== null && `${r.signups} signups`, r.customers !== null && `${r.customers} customers`, r.adVariantId && "ad variant"].filter(Boolean).join(" · ") || "no numbers",
                }))}
                currency={currency}
                recommendation={rec ? { ...(rec.content as { summary: string; channels: { channel: string; action: string; reason: string; nextSteps: string[] }[] }), createdAt: rec.createdAt.toISOString() } : null}
                recommendCost={CREDIT_COSTS.marketing_recommendation}
                aiReady={ai.configured}
                pages={published.map((p) => ({ id: p.id, slug: p.slug }))}
                links={links.filter((l) => !l.adVariantId).map((l) => ({ id: l.id, source: l.source, medium: l.medium, campaign: l.campaign, content: l.content, url: l.url }))}
              />
            ),
          },
        ]}
      />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Link2 className="size-3.5" /> No ad platform is connected: create ads in each platform&apos;s own tools, use the tracking links, and log the numbers here.</p>
    </div>
  );
}
