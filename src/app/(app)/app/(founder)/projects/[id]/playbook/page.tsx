import { ArrowRight, Check, Download, Flag, Target, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfigErrorNotice } from "@/components/config-error";
import { CopyButton } from "@/components/gold-mine/copy-button";
import { GenerateButton } from "@/components/plan/generate-button";
import { buttonVariants } from "@/components/ui/button";
import { getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { PLAYBOOK_STAGE_LABEL, type LaunchPlaybook, type PLAYBOOK_FEATURES } from "@/lib/validation/launch-playbook";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getLatestMarketingPlan } from "@/server/data/marketing";
import { getLatestBusinessModel, getLatestLaunchPlaybook, getLatestMvpPlan } from "@/server/data/planning";
import { getProject } from "@/server/data/projects";
import { getLatestValidationReport } from "@/server/data/research";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Where each task's "do it in Startum" link goes. */
function featureLink(feature: (typeof PLAYBOOK_FEATURES)[number], projectId: string): { href: string; label: string } | null {
  const p = `/app/projects/${projectId}`;
  const map: Record<(typeof PLAYBOOK_FEATURES)[number], { href: string; label: string } | null> = {
    autopilot: { href: `${p}/autopilot`, label: "Autopilot" },
    research: { href: `${p}/research`, label: "Research" },
    competitors: { href: `${p}/competitors`, label: "Competitors" },
    market_voices: { href: `${p}/language`, label: "Market voices" },
    validation_lab: { href: `${p}/validation`, label: "Validation Lab" },
    landing_page: { href: "/app/lab/pages", label: "Landing pages" },
    brand: { href: `${p}/brand`, label: "Brand" },
    design: { href: `${p}/design`, label: "Design" },
    plan: { href: `${p}/plan`, label: "Plan" },
    marketing: { href: `${p}/marketing`, label: "Marketing Studio" },
    copilot: { href: `/app/copilot?project=${projectId}`, label: "AI Copilot" },
    page_review: { href: `${p}/review`, label: "Page review" },
    none: null,
  };
  return map[feature];
}

const BASIS_STYLE: Record<LaunchPlaybook["sales"]["objections"][number]["basis"], string> = {
  customer_quote: "bg-emerald-50 text-emerald-700",
  research: "bg-sky-50 text-sky-700",
  hypothesis: "bg-amber-50 text-amber-700",
};

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</p>;
}

export default async function ProjectPlaybookPage({ params }: PageProps<"/app/projects/[id]/playbook">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();
  const [latest, research, business, mvp, marketing] = await Promise.all([
    getLatestLaunchPlaybook(user.id, id),
    getLatestValidationReport(user.id, id),
    getLatestBusinessModel(user.id, id),
    getLatestMvpPlan(user.id, id),
    getLatestMarketingPlan(user.id, id),
  ]);
  const ai = getIntegrationStatus("ai");
  const inputs = [
    { label: "Research", done: !!research, href: `/app/projects/${id}/research` },
    { label: "Business model", done: !!business, href: `/app/projects/${id}/plan` },
    { label: "MVP plan", done: !!mvp, href: `/app/projects/${id}/plan` },
    { label: "Marketing plan", done: !!marketing, href: `/app/projects/${id}/marketing` },
  ];

  return (
    <div className="space-y-6">
      {!ai.configured ? <ConfigErrorNotice title="AI provider is not configured" missing={ai.missing} /> : null}

      <section className="surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-medium">Launch playbook</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              From idea to paying customers in one plan: six stages with clear &quot;move on when&quot; gates, a founder-led sales playbook, the SaaS
              metrics to watch, retention, and a week-by-week build plan with prompts for your AI coding tool. Built on everything Startum knows about this
              project.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <GenerateButton projectId={id} kind="playbook" label={latest ? "Regenerate" : "Generate"} cost={CREDIT_COSTS.launch_playbook} disabled={!ai.configured} />
            {latest ? (
              <a href={`/app/projects/${id}/playbook/export`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-[10px]")}>
                <Download /> Download (.md)
              </a>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Uses:</span>
          {inputs.map((i) =>
            i.done ? (
              <span key={i.label} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700"><Check className="size-3" /> {i.label}</span>
            ) : (
              <Link key={i.label} href={i.href} className="rounded-full border border-dashed border-border px-2 py-0.5 text-muted-foreground hover:border-primary/50 hover:text-foreground">
                + {i.label} (sharper playbook)
              </Link>
            ),
          )}
        </div>
      </section>

      {latest ? <Playbook projectId={id} p={latest.playbook} math={latest.math} createdAt={latest.createdAt} /> : (
        <p className="surface p-6 text-sm text-muted-foreground">Not generated yet. It works from just the idea, and gets much sharper with research, a business model, an MVP plan and a marketing plan.</p>
      )}
    </div>
  );
}

function Playbook({ projectId, p, math, createdAt }: { projectId: string; p: LaunchPlaybook; math: NonNullable<Awaited<ReturnType<typeof getLatestLaunchPlaybook>>>["math"]; createdAt: Date }) {
  const s = p.sales;
  return (
    <>
      {/* Strategy and the numbers */}
      <section className="surface overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <Label>Strategy</Label>
            <p className="text-sm leading-relaxed">{p.summary}</p>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Target className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-medium">North star, next 90 days: {p.northStar.goal}</p>
                <p className="mt-0.5 text-muted-foreground">Metric: {p.northStar.metric}. {p.northStar.why}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border p-4">
            <Label>Revenue maths</Label>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-semibold">{money(math.priceMonthly)}</p><p className="text-[11px] text-muted-foreground">price / mo</p></div>
              <div><p className="text-lg font-semibold">{money(math.ltv)}</p><p className="text-[11px] text-muted-foreground">lifetime value</p></div>
              <div><p className="text-lg font-semibold">{money(math.cacCeiling)}</p><p className="text-[11px] text-muted-foreground">max cost / customer</p></div>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {math.milestones.map((m) => (
                <li key={m.mrr} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5">
                  <span>{money(m.mrr)} MRR</span>
                  <span className="font-medium">{m.customers} customers</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
              Computed by Startum from {math.priceSource === "business_model" ? "your business model's main tier" : "an assumed price (generate a business model to anchor it)"} and an assumed{" "}
              {math.churnPct}% monthly churn. Replace with real numbers once you bill.
            </p>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="surface p-6" id="roadmap">
        <h3 className="font-medium">Roadmap: idea to market</h3>
        <ol className="mt-5 space-y-4">
          {p.stages.map((st, i) => (
            <li key={st.stage} className="relative grid gap-4 rounded-2xl border border-border p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <span className="grid size-8 place-items-center rounded-full bg-brand-gradient text-sm font-semibold text-white">{i + 1}</span>
                <p className="mt-2 font-medium">{PLAYBOOK_STAGE_LABEL[st.stage]}</p>
                <p className="text-xs text-muted-foreground">{st.timeframe} · {st.tasks.reduce((n, t) => n + t.hours, 0)} h of work</p>
                <p className="mt-2 text-sm text-muted-foreground">{st.goal}</p>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50/60 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-emerald-800"><Flag className="size-3.5" /> Move on when</p>
                  <ul className="space-y-0.5 text-sm">{st.exitCriteria.map((c, k) => <li key={k}>☐ {c}</li>)}</ul>
                </div>
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {st.tasks.map((t, k) => {
                    const link = featureLink(t.feature, projectId);
                    return (
                      <li key={k} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{t.title} <span className="font-normal text-muted-foreground">· {t.hours} h</span></p>
                          <p className="text-muted-foreground">{t.detail}</p>
                        </div>
                        {link ? (
                          <Link href={link.href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
                            {link.label} <ArrowRight className="size-3" />
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {st.risks.length ? (
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" /> {st.risks.join(" · ")}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Sales */}
      <section className="surface space-y-6 p-6" id="sales">
        <div>
          <h3 className="font-medium">Sales playbook</h3>
          <p className="mt-1 text-sm"><span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">{s.motion.replace("_", " ")}</span> <span className="ml-1 text-muted-foreground">{s.motionWhy}</span></p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border p-4 text-sm">
            <Label>Ideal customer</Label>
            <p><span className="font-medium">Company:</span> {s.icp.company}</p>
            <p className="mt-1"><span className="font-medium">Buyer:</span> {s.icp.buyer}</p>
            <p className="mt-1"><span className="font-medium">User:</span> {s.icp.user}</p>
            <p className="mt-3 text-xs font-medium">Buying triggers</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{s.icp.triggers.map((t, i) => <li key={i}>{t}</li>)}</ul>
            {s.icp.disqualifiers.length ? (<><p className="mt-3 text-xs font-medium">Walk away from</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">{s.icp.disqualifiers.map((t, i) => <li key={i}>{t}</li>)}</ul></>) : null}
          </div>
          <div className="rounded-xl border border-border p-4 text-sm">
            <Label>Prospecting</Label>
            <p className="text-xs font-medium">Where to find them</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{s.prospecting.whereToFind.map((t, i) => <li key={i}>{t}</li>)}</ul>
            <p className="mt-3 text-xs font-medium">List criteria</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{s.prospecting.listCriteria.map((t, i) => <li key={i}>{t}</li>)}</ul>
            <p className="mt-3"><span className="text-xs font-medium">Daily routine:</span> {s.prospecting.dailyRoutine}</p>
          </div>
        </div>

        <div>
          <Label>Outreach sequence</Label>
          <ol className="grid gap-3 lg:grid-cols-2">
            {s.outreachSequence.map((o, i) => (
              <li key={i} className="rounded-xl border border-border p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">Day {o.day} · {o.channel}</p>
                  <CopyButton text={o.message} />
                </div>
                <p className="text-xs text-muted-foreground">{o.goal}</p>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-3">{o.message}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="text-sm">
            <Label>Discovery call questions</Label>
            <ol className="list-decimal space-y-1 pl-5">{s.discoveryQuestions.map((q, i) => <li key={i}>{q}</li>)}</ol>
          </div>
          <div className="text-sm">
            <Label>Demo flow</Label>
            <ol className="space-y-2">{s.demoFlow.map((d, i) => <li key={i}><span className="font-medium">{i + 1}. {d.step}:</span> show {d.show}<span className="block pl-4 text-muted-foreground">&ldquo;{d.say}&rdquo;</span></li>)}</ol>
          </div>
        </div>

        <div>
          <Label>Objections</Label>
          <div className="grid gap-3 lg:grid-cols-2">
            {s.objections.map((o, i) => (
              <div key={i} className="rounded-xl border border-border p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">&ldquo;{o.objection}&rdquo;</p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", BASIS_STYLE[o.basis])}>{o.basis.replace("_", " ")}</span>
                </div>
                <p className="mt-1.5">{o.response}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">{o.evidence}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
            <Label>Closing</Label>
            <p><span className="font-medium">Founding offer:</span> {s.closing.foundingOffer}</p>
            <p className="mt-1.5"><span className="font-medium">The ask:</span> {s.closing.ask}</p>
            <p className="mt-1.5"><span className="font-medium">Follow-up:</span> {s.closing.followUp}</p>
          </div>
          <div className="text-sm">
            <Label>Pipeline</Label>
            <ol className="space-y-1.5">
              {s.pipeline.map((st, i) => (
                <li key={i} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 rounded-lg bg-muted/50 px-3 py-2">
                  <span className="font-medium">{st.stage}</span>
                  <span className="text-muted-foreground">{st.definition} <span className="text-foreground">→ {st.nextAction}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Metrics, retention, pricing */}
      <section className="surface space-y-6 p-6" id="metrics">
        <h3 className="font-medium">Metrics, retention & pricing</h3>
        <div>
          <Label>Funnel</Label>
          <ol className="grid gap-2 md:grid-cols-5">
            {p.metrics.funnel.map((f) => (
              <li key={f.stage} className="rounded-xl border border-border p-3 text-sm">
                <p className="font-medium capitalize">{f.stage}</p>
                <p className="mt-1 text-xs text-muted-foreground">{f.definition}</p>
                <p className="mt-2 text-xs"><span className="font-medium">Measure:</span> {f.howToMeasure}</p>
                <p className="mt-1 text-xs text-amber-700">{f.targetAssumption}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm"><span className="font-medium">Activation moment:</span> {p.metrics.activationMoment}</p>
        </div>
        <div className="grid gap-4 text-sm lg:grid-cols-3">
          <div><Label>Weekly dashboard</Label><ul className="space-y-1">{p.metrics.weeklyDashboard.map((m, i) => <li key={i}>☐ {m}</li>)}</ul></div>
          <div><Label>Onboarding</Label><ol className="list-decimal space-y-1 pl-5">{p.retention.onboarding.map((m, i) => <li key={i}>{m}</li>)}</ol></div>
          <div>
            <Label>Churn signals → save actions</Label>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{p.retention.churnSignals.map((m, i) => <li key={i}>{m}</li>)}</ul>
            <ul className="mt-2 list-disc space-y-1 pl-5">{p.retention.saveActions.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        </div>
        <div className="grid gap-4 text-sm lg:grid-cols-2">
          <div><Label>Pricing tactics</Label><ul className="list-disc space-y-1 pl-5">{p.pricingTactics.map((m, i) => <li key={i}>{m}</li>)}</ul></div>
          <div><Label>Unit economics</Label><p className="text-muted-foreground">{p.metrics.unitEconomicsNotes}</p></div>
        </div>
      </section>

      {/* Build */}
      <section className="surface space-y-6 p-6" id="build">
        <h3 className="font-medium">Build plan</h3>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {p.build.sprints.map((sp, i) => (
            <li key={i} className="rounded-xl border border-border p-4 text-sm">
              <p className="text-xs text-muted-foreground">Week {sp.week}</p>
              <p className="font-medium">{sp.focus}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">{sp.deliverables.map((d, k) => <li key={k}>{d}</li>)}</ul>
              <p className="mt-2 text-xs text-muted-foreground">Done when: {sp.doneWhen}</p>
            </li>
          ))}
        </ol>
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="text-sm"><Label>Launch infrastructure</Label><ul className="space-y-1">{p.build.launchInfra.map((x, i) => <li key={i}>☐ {x}</li>)}</ul></div>
          <div>
            <Label>Prompts for your AI coding tool</Label>
            <div className="space-y-3">
              {p.build.aiCodingPrompts.map((x, i) => (
                <div key={i} className="rounded-xl border border-border p-4 text-sm">
                  <div className="flex items-center justify-between gap-2"><p className="font-medium">{x.title}</p><CopyButton text={x.prompt} /></div>
                  <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-xs">{x.prompt}</pre>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">For the full spec, use <Link href={`/app/projects/${projectId}/plan`} className="text-primary hover:underline">Plan → Download coding-agent prompt</Link>.</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Generated {fmt.format(createdAt)} · targets, churn and costs are assumptions to test, not benchmarks.</p>
      </section>
    </>
  );
}
