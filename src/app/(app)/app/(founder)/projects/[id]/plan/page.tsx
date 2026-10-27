import { Download, FileCode2, TriangleAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { ConfigErrorNotice } from "@/components/config-error";
import { GenerateButton } from "@/components/plan/generate-button";
import { buttonVariants } from "@/components/ui/button";
import { getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getValidationSummary } from "@/server/data/experiments";
import { getLatestBusinessModel, getLatestMvpPlan } from "@/server/data/planning";
import { getProject } from "@/server/data/projects";
import { listCompetitors } from "@/server/data/research";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default async function ProjectPlanPage({ params }: PageProps<"/app/projects/[id]/plan">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();
  const [business, mvp, validation, competitors] = await Promise.all([getLatestBusinessModel(user.id, id), getLatestMvpPlan(user.id, id), getValidationSummary(user.id, id), listCompetitors(user.id, id)]);
  const ai = getIntegrationStatus("ai");
  const verifiedPrices = competitors.filter((c) => c.pricing && c.pricingSource).length;

  return (
    <div className="space-y-6">
      {!ai.configured ? <ConfigErrorNotice title="AI provider is not configured" missing={ai.missing} /> : null}
      {validation.passed === 0 ? (
        <p className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          No experiment has passed yet. You can plan, but treat it as provisional until real results support the idea.
        </p>
      ) : null}

      {/* ---------------- Business model ---------------- */}
      <section className="surface p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-medium">Business model & pricing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tiers anchored only on competitor prices verified from sources ({verifiedPrices} available). All prices are hypotheses to test.
            </p>
          </div>
          <GenerateButton projectId={id} kind="business" label={business ? "Regenerate" : "Generate"} cost={CREDIT_COSTS.business_model} disabled={!ai.configured} />
        </div>
        {business ? (
          <div className="mt-5 space-y-5">
            <p className="text-sm"><span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">{business.model.pricingModel.type.replace("_", " ")}</span> <span className="ml-2 text-muted-foreground">{business.model.pricingModel.rationale}</span></p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {business.model.tiers.map((t) => (
                <div key={t.name} className="rounded-xl border border-border p-4">
                  <p className="font-medium">{t.name}</p>
                  <p className="mt-1 text-2xl font-semibold">{t.priceMonthly === null ? "Custom" : `$${t.priceMonthly}`}<span className="text-sm font-normal text-muted-foreground"> {t.priceMonthly === null ? "" : "/mo"}</span></p>
                  <p className="text-xs text-muted-foreground">{t.billingNote} · hypothesis</p>
                  <ul className="mt-3 list-disc space-y-1 pl-4 text-sm">{t.includes.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  <p className="mt-3 text-xs text-muted-foreground">{t.rationale}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Verified competitor anchors</p>
                {business.model.competitorAnchors.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm">{business.model.competitorAnchors.map((a, i) => <li key={i}><span className="font-medium">{a.competitor}</span>: {a.observation}</li>)}</ul>
                ) : (
                  <p className="text-sm text-muted-foreground">None — no competitor prices were verified from sources, so pricing is based on assumptions only.</p>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Assumptions to test</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">{business.model.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            </div>
            {business.model.pricingExperiments.length ? (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Pricing experiments</p>
                <ul className="space-y-1 text-sm">{business.model.pricingExperiments.map((e, i) => <li key={i}><span className="font-medium">{e.title}</span> <span className="text-muted-foreground">— {e.successCriteria}</span></li>)}</ul>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Generated {fmt.format(business.createdAt)}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Not generated yet. Running research first gives it verified competitor prices to anchor on.</p>
        )}
      </section>

      {/* ---------------- MVP plan ---------------- */}
      <section className="surface p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-medium">MVP plan & build kit</h2>
            <p className="mt-1 text-sm text-muted-foreground">Must-haves with acceptance criteria, journeys, data model and milestones — sized for a micro-SaaS. Export it for coding agents.</p>
          </div>
          <GenerateButton projectId={id} kind="mvp" label={mvp ? "Regenerate" : "Generate"} cost={CREDIT_COSTS.mvp_plan} disabled={!ai.configured} />
        </div>
        {mvp ? (
          <div className="mt-5 space-y-6">
            <div className="flex flex-wrap gap-2">
              <a href={`/app/projects/${id}/plan/export?format=spec`} className={cn(buttonVariants({ variant: "outline" }), "rounded-[10px]")}><Download /> Download spec (.md)</a>
              <a href={`/app/projects/${id}/plan/export?format=prompt`} className={cn(buttonVariants({ variant: "outline" }), "rounded-[10px]")}><FileCode2 /> Download coding-agent prompt</a>
            </div>
            <div className="grid gap-4 lg:grid-cols-3 text-sm">
              <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Summary</p><p className="mt-1">{mvp.plan.productSummary}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Target user</p><p className="mt-1">{mvp.plan.targetUser}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Problem</p><p className="mt-1">{mvp.plan.problemStatement}</p></div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Must-have</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {mvp.plan.mustHave.map((f, i) => (
                  <div key={i} className="rounded-xl border border-border p-4 text-sm">
                    <p className="font-medium">{f.feature}</p>
                    <p className="mt-1 text-muted-foreground">{f.why}</p>
                    <ul className="mt-2 space-y-1">{f.acceptanceCriteria.map((c, j) => <li key={j}>☐ {c}</li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 text-sm">
              <div><p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Later</p><ul className="list-disc space-y-1 pl-5 text-muted-foreground">{mvp.plan.later.map((l, i) => <li key={i}><span className="text-foreground">{l.feature}</span> — {l.reason}</li>)}</ul></div>
              <div><p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Out of scope</p><ul className="list-disc space-y-1 pl-5 text-muted-foreground">{mvp.plan.outOfScope.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 text-sm">
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">User journeys</p>
                {mvp.plan.userJourneys.map((j, i) => <div key={i} className="mb-3"><p className="font-medium">{j.name}</p><ol className="list-decimal pl-5 text-muted-foreground">{j.steps.map((s, k) => <li key={k}>{s}</li>)}</ol></div>)}
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Data model</p>
                <ul className="space-y-1">{mvp.plan.techNeeds.dataModel.map((e, i) => <li key={i}><span className="font-mono text-xs text-primary">{e.entity}</span> <span className="text-muted-foreground">{e.fields.join(", ")}</span></li>)}</ul>
                <p className="mb-1 mt-3 text-xs uppercase tracking-wider text-muted-foreground">Stack & integrations</p>
                <p className="text-muted-foreground">{[...mvp.plan.techNeeds.suggestedStack, ...mvp.plan.techNeeds.integrations].join(" · ")}</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Milestones</p>
              <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{mvp.plan.milestones.map((m, i) => <li key={i} className="rounded-xl border border-border p-4 text-sm"><p className="font-medium">{m.title}</p><p className="text-xs text-muted-foreground">{m.estimate}</p><ul className="mt-2 list-disc space-y-1 pl-4">{m.deliverables.map((d, k) => <li key={k}>{d}</li>)}</ul></li>)}</ol>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 text-sm">
              <div><p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Launch checklist</p><ul className="space-y-1">{mvp.plan.launchChecklist.map((c, i) => <li key={i}>☐ {c}</li>)}</ul></div>
              <div><p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Risks</p><ul className="list-disc space-y-1 pl-5">{mvp.plan.risks.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
            </div>
            <p className="text-xs text-muted-foreground">Generated {fmt.format(mvp.createdAt)}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Not generated yet. It builds on your research, experiments and business model.</p>
        )}
      </section>
    </div>
  );
}
