import { ArrowRight, BarChart3, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { continueToPainsAction, runDemandAction } from "@/app/(app)/app/(founder)/gold-mine/actions";
import { ConfigErrorNotice } from "@/components/config-error";
import { buttonVariants } from "@/components/ui/button";
import type { DemandVerdict, TrendClass } from "@/lib/gold-mine/trend";
import { cn } from "@/lib/utils";
import type { DemandCheckRow } from "@/server/data/gold-mine";
import type { DemandSummary } from "@/server/services/gold-mine";
import { ActionButton } from "./action-button";
import { Sparkline } from "./sparkline";

const TREND_STYLE: Record<TrendClass, string> = {
  growing: "bg-emerald-50 text-emerald-700",
  stable: "bg-sky-50 text-sky-700",
  fad: "bg-amber-50 text-amber-700",
  declining: "bg-rose-50 text-rose-700",
  unknown: "bg-muted text-muted-foreground",
};
const VERDICT: Record<DemandVerdict, { label: string; text: string; cls: string }> = {
  strong: { label: "Demand looks real", text: "Search demand and/or competitors suggest people want this.", cls: "border-emerald-300 bg-emerald-50/60" },
  weak: { label: "Demand looks weak", text: "Low or shrinking search interest. You can continue, but consider a different niche.", cls: "border-amber-300 bg-amber-50/60" },
  needs_more_data: { label: "Needs more data", text: "The keyword provider returned no volume for these phrases. We won't guess.", cls: "border-border bg-muted/50" },
};

export function DemandStep({
  sessionId,
  niche,
  rows,
  summary,
  keywordStatus,
  cost,
  acknowledged,
}: {
  sessionId: string;
  niche: string;
  rows: DemandCheckRow[];
  summary: DemandSummary | null;
  keywordStatus: { configured: boolean; missing: string[] };
  cost: number;
  acknowledged: boolean;
}) {
  const v = summary ? VERDICT[summary.verdict] : null;
  return (
    <div className="space-y-6">
      <section className="surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-medium"><BarChart3 className="size-4 text-primary" /> Demand check for “{niche}”</h2>
            <p className="mt-1 text-sm text-muted-foreground">AI suggests search phrases; volume and multi-year trends come from your keyword data provider. Trends are classified by fixed rules, not AI.</p>
          </div>
          <ActionButton action={runDemandAction} args={[sessionId]} success="Demand check complete" disabled={!keywordStatus.configured}>
            {summary ? "Re-check demand" : "Check demand"} · {cost} credits
          </ActionButton>
        </div>
        {!keywordStatus.configured ? (
          <div className="mt-4">
            <ConfigErrorNotice title="Keyword data provider is not configured" missing={keywordStatus.missing} hint="Set KEYWORD_PROVIDER=dataforseo with your DataForSEO login and password. You can still continue without demand data." />
          </div>
        ) : null}
      </section>

      {summary && v ? (
        <section className={cn("rounded-2xl border p-5", v.cls)}>
          <div className="flex items-start gap-3">
            {summary.verdict !== "strong" ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" /> : null}
            <div>
              <p className="font-medium">{v.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{v.text}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Total monthly searches across phrases: {summary.totalVolume.toLocaleString("en-US")} · Competitors found via search: {summary.competitorCount ?? "not checked (search not configured)"} · Provider: {summary.provider} · Checked {new Date(summary.checkedAt).toLocaleDateString("en")}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {rows.length ? (
        <section className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-5 py-3">Search phrase</th><th className="px-5 py-3 text-right">Monthly searches</th><th className="px-5 py-3">Trend</th><th className="px-5 py-3">Class</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-5 py-3">{r.keyword}</td>
                    <td className="px-5 py-3 text-right font-medium">{r.volume === null ? <span className="text-muted-foreground">needs more data</span> : r.volume.toLocaleString("en-US")}</td>
                    <td className="px-5 py-3"><Sparkline points={r.trend ?? []} /></td>
                    <td className="px-5 py-3"><span className={cn("rounded-md px-2 py-0.5 text-xs font-medium capitalize", TREND_STYLE[r.trendClass])}>{r.trendClass === "unknown" ? "needs more data" : r.trendClass}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary?.competitorDomains.length ? (
            <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Competitor sites seen in search: {summary.competitorDomains.join(", ")}</p>
          ) : null}
        </section>
      ) : null}

      <section className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Checkpoint</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary?.verdict === "strong" ? "Demand looks real. Next, find out what people complain about." : "Continue to mine real customer pains anyway, or go back and pick a different niche."}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Link href="/app/gold-mine" className={cn(buttonVariants({ variant: "outline" }), "rounded-[10px]")}>Change niche</Link>
          <ActionButton action={continueToPainsAction} args={[sessionId, summary?.verdict !== "strong"]} success={acknowledged ? undefined : "On to pains"}>
            {summary?.verdict === "strong" ? "Continue to pains" : "Continue anyway"} <ArrowRight />
          </ActionButton>
        </div>
      </section>
    </div>
  );
}
