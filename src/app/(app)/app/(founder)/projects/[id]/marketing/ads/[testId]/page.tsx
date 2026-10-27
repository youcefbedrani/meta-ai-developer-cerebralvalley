import { BadgeCheck, ChevronLeft, ShieldAlert, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/gold-mine/copy-button";
import { AdTestStatusControls, VariantResultForm } from "@/components/marketing/ad-test-controls";
import { decideVariant, sumNullable } from "@/lib/marketing/metrics";
import { policyCheck } from "@/lib/marketing/policy";
import { utmSource } from "@/lib/validation/marketing";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getAdExperiment, getTrackedEvents } from "@/server/data/marketing-studio";

const DECISION = {
  keep_running: { label: "Keep running", className: "border-border bg-muted text-foreground" },
  continue: { label: "Continue", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  stop: { label: "Stop", className: "border-rose-200 bg-rose-50 text-rose-700" },
} as const;

export default async function AdTestPage({ params }: PageProps<"/app/projects/[id]/marketing/ads/[testId]">) {
  const user = await requireOnboardedUser();
  const { id, testId } = await params;
  const data = await getAdExperiment(user.id, testId);
  if (!data || data.experiment.projectId !== id) notFound();
  const { experiment: e, variants, links, results } = data;
  const tracked = await getTrackedEvents(user.id, id);
  const source = utmSource(e.platform);
  const campaign = utmSource(e.name);
  const rule = { maxCostPerSignup: Number(e.maxCostPerSignup), minClicks: e.minClicks };

  const rows = variants.map((v) => {
    const mine = results.filter((r) => r.adVariantId === v.id);
    const t = tracked.filter((x) => x.source === source && x.campaign === campaign && x.content === v.utmContent).reduce((a, x) => ({ visits: a.visits + x.visits, signups: a.signups + x.signups }), { visits: 0, signups: 0 });
    const spend = sumNullable(mine.map((r) => (r.spend === null ? null : Number(r.spend))));
    const clicks = sumNullable(mine.map((r) => r.clicks));
    const selfSignups = sumNullable(mine.map((r) => r.signups));
    const signups = t.signups > 0 ? t.signups : selfSignups;
    return {
      v,
      link: links.find((l) => l.adVariantId === v.id),
      spend,
      impressions: sumNullable(mine.map((r) => r.impressions)),
      clicks,
      visits: t.visits,
      signups,
      signupsTracked: t.signups > 0,
      customers: sumNullable(mine.map((r) => r.customers)),
      decision: decideVariant({ spend, clicks, signups }, rule),
      warnings: policyCheck(`${v.headline}\n${v.primaryText}\n${v.cta}`),
    };
  });
  const winners = rows.filter((r) => r.decision.decision === "continue").sort((a, b) => (a.decision.costPerSignup ?? Infinity) - (b.decision.costPerSignup ?? Infinity));
  const totalSpend = sumNullable(rows.map((r) => r.spend)) ?? 0;
  const money = (n: number | null) => (n === null ? "—" : `${e.currency} ${n.toFixed(2)}`);

  return (
    <div className="space-y-6">
      <Link href={`/app/projects/${id}/marketing`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Marketing Studio</Link>
      <section className="surface p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Ad test · {e.platform}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{e.name}</h1>
            <p className="mt-2 max-w-2xl text-sm"><span className="text-muted-foreground">Hypothesis:</span> {e.hypothesis}</p>
            <p className="mt-1 max-w-2xl text-sm"><span className="text-muted-foreground">Audience:</span> {e.audience}</p>
          </div>
          <span className="w-fit rounded-full border border-border px-3 py-1 text-sm capitalize">{e.status}</span>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
          {[
            ["Budget", `${e.currency} ${e.budgetTotal} over ${e.durationDays} days`],
            ["Spent (logged)", `${money(totalSpend)} of ${e.currency} ${e.budgetTotal}`],
            ["Stop rule", `Cost per signup > ${e.currency} ${e.maxCostPerSignup} after ${e.minClicks} clicks`],
            ["Started", e.startedAt ? e.startedAt.toISOString().slice(0, 10) : "Not yet"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-white p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>
          ))}
        </dl>
        {e.decisionNote ? <p className="mt-3 text-sm"><span className="text-muted-foreground">Decision note:</span> {e.decisionNote}</p> : null}
        <div className="mt-5"><AdTestStatusControls id={e.id} status={e.status} labExperimentId={e.labExperimentId} backHref={`/app/projects/${id}/marketing`} /></div>
      </section>

      {winners.length ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <Trophy className="size-4 shrink-0" /> <span><b>{winners[0].v.name}</b> is within your limit at {money(winners[0].decision.costPerSignup)} per signup{winners.length > 1 ? `, the best of ${winners.length} variants that pass` : ""}.</span>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {rows.map((r) => (
          <section key={r.v.id} className="surface flex flex-col p-5 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div><p className="font-medium">{r.v.name}</p>{r.v.angle ? <p className="text-xs text-[var(--violet)]">Angle: {r.v.angle}</p> : null}</div>
              <span className={cn("rounded-full border px-2 py-0.5 text-xs", DECISION[r.decision.decision].className)}>{DECISION[r.decision.decision].label}</span>
            </div>
            <div className="mt-3 rounded-xl border border-border bg-white p-3">
              <p className="font-medium">{r.v.headline}</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.v.primaryText}</p>
              <p className="mt-2 inline-block rounded-md bg-[var(--plum)] px-2 py-1 text-xs text-white">{r.v.cta}</p>
            </div>
            {r.warnings.length ? <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> {r.warnings.map((w) => `${w.category} (“${w.match}”)`).join(" · ")}</p> : null}
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Tracking link</p>
              {r.link ? <p className="mt-1 flex items-center gap-1"><code className="truncate text-xs">{r.link.url}</code><CopyButton text={r.link.url} /></p> : <p className="mt-1 text-xs text-muted-foreground">Publish a landing page and recreate the test to get links.</p>}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Spend", money(r.spend)],
                ["Clicks", r.clicks ?? "—"],
                ["Visits", r.visits],
                ["Signups", r.signups ?? "—"],
                ["Cost/signup", money(r.decision.costPerSignup)],
                ["Customers", r.customers ?? "—"],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg bg-muted/40 p-2">
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}{(k === "Visits" && r.visits > 0) || (k === "Signups" && r.signupsTracked) ? <BadgeCheck className="ml-1 inline size-3 text-emerald-600" aria-label="tracked" /> : null}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">{r.decision.reason}</p>
            <details className="mt-auto pt-3">
              <summary className="cursor-pointer text-sm font-medium">Log numbers from {e.platform}</summary>
              <div className="mt-3"><VariantResultForm projectId={id} experimentId={e.id} variantId={r.v.id} variantName={r.v.name} platform={e.platform} channelId={e.channelId} currency={e.currency} /></div>
            </details>
          </section>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Decisions are calculated from your logged spend and clicks plus signups tracked through each variant&apos;s link, using the rule you set. No benchmarks are used.</p>
    </div>
  );
}
