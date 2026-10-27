"use client";

import { BadgeCheck, BarChart3, Compass, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addChannelResultAction, createUtmLinkAction, deleteChannelResultAction, recommendNextStepAction } from "@/app/(app)/app/(founder)/marketing/actions";
import { CopyButton } from "@/components/gold-mine/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChannelFunnel } from "@/lib/marketing/metrics";
import { cn } from "@/lib/utils";

type Row = { id: string; channel: string; periodStart: string; periodEnd: string; summary: string };
type Rec = { summary: string; channels: { channel: string; action: string; reason: string; nextSteps: string[] }[]; createdAt: string } | null;
type Link = { id: string; source: string; medium: string; campaign: string; content: string; url: string };

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
const money = (n: number | null, c: string) => (n === null ? "—" : `${c} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);
const int = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US"));
const ACTION: Record<string, { label: string; className: string }> = {
  double_down: { label: "Double down", className: "bg-emerald-600 text-white" },
  iterate_copy: { label: "Iterate copy", className: "bg-sky-600 text-white" },
  change_audience: { label: "Change audience", className: "bg-violet-600 text-white" },
  stop: { label: "Stop", className: "bg-rose-600 text-white" },
  keep_testing: { label: "Keep testing", className: "bg-amber-500 text-white" },
  need_more_data: { label: "Need more data", className: "bg-muted text-foreground" },
};

export function ResultsPanel({ projectId, channels, funnels, rows, currency, recommendation, recommendCost, aiReady, pages, links }: {
  projectId: string;
  channels: { id: string; name: string; type: "organic" | "paid" }[];
  funnels: ChannelFunnel[];
  rows: Row[];
  currency: string;
  recommendation: Rec;
  recommendCost: number;
  aiReady: boolean;
  pages: { id: string; slug: string }[];
  links: Link[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const first = channels[0];
  const [f, setF] = useState({ channelId: first?.id ?? "", periodStart: weekAgo(), periodEnd: today(), spend: "", impressions: "", clicks: "", visits: "", signups: "", customers: "", revenue: "" });
  const [utm, setUtm] = useState({ landingPageId: pages[0]?.id ?? "", source: "", medium: "social", campaign: "launch", content: "" });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  return (
    <>
      <section className="surface p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-medium"><Compass className="size-4 text-primary" /> Next best step</h2>
            <p className="mt-1 text-sm text-muted-foreground">AI advice per channel based only on your recorded results: double down, iterate copy, change audience or stop.</p>
          </div>
          <Button variant="gradient" className="h-10 shrink-0 px-4" disabled={pending || !aiReady} onClick={() => start(async () => { const r = await recommendNextStepAction(projectId); if (!r.ok) toast.error(r.error); else toast.success("Recommendation ready"); router.refresh(); })}>
            {pending ? <Loader2 className="animate-spin" /> : <Compass />} Get recommendation · {recommendCost} credits
          </Button>
        </div>
        {recommendation ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm">{recommendation.summary}</p>
            <ul className="grid gap-3 md:grid-cols-2">
              {recommendation.channels.map((c) => (
                <li key={c.channel} className="rounded-xl border border-border bg-white p-4 text-sm">
                  <div className="flex items-center justify-between gap-2"><p className="font-medium">{c.channel}</p><span className={cn("rounded-full px-2 py-0.5 text-xs", ACTION[c.action]?.className)}>{ACTION[c.action]?.label ?? c.action}</span></div>
                  <p className="mt-1 text-muted-foreground">{c.reason}</p>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5">{c.nextSteps.map((s) => <li key={s}>{s}</li>)}</ul>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Generated {recommendation.createdAt.slice(0, 16).replace("T", " ")} UTC from the numbers recorded at that time.</p>
          </div>
        ) : null}
      </section>

      <section className="surface p-6">
        <h2 className="flex items-center gap-2 font-medium"><BarChart3 className="size-4 text-primary" /> Funnel by channel</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <BadgeCheck className="inline size-3.5 text-emerald-600" /> = tracked on your landing page (verified). Other numbers are self-reported from your ad dashboards. Ratios are calculated from these numbers only.
        </p>
        {funnels.length ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>{["Channel", "Spend", "Impr.", "Clicks", "CTR", "Visits", "Signups", "Signup rate", "Cost / signup", "Customers", "Cost / customer", "Revenue", "ROAS"].map((h, i) => <th key={h} className={cn("px-3 py-2.5", i && "text-right")}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {funnels.map((r) => (
                  <tr key={r.channel} className="border-t border-border">
                    <td className="px-3 py-2.5 font-medium">{r.channel}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.spend, currency)}</td>
                    <td className="px-3 py-2.5 text-right">{int(r.impressions)}</td>
                    <td className="px-3 py-2.5 text-right">{int(r.clicks)}</td>
                    <td className="px-3 py-2.5 text-right">{pct(r.metrics.ctr)}</td>
                    <td className="px-3 py-2.5 text-right">{int(r.visits)} {r.visitsSource === "tracked" ? <BadgeCheck className="inline size-3.5 text-emerald-600" aria-label="tracked" /> : null}</td>
                    <td className="px-3 py-2.5 text-right">{int(r.signups)} {r.signupsSource === "tracked" ? <BadgeCheck className="inline size-3.5 text-emerald-600" aria-label="tracked" /> : null}</td>
                    <td className="px-3 py-2.5 text-right">{pct(r.metrics.signupRate)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{money(r.metrics.costPerSignup, currency)}</td>
                    <td className="px-3 py-2.5 text-right">{int(r.customers)}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.metrics.costPerCustomer, currency)}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.revenue, currency)}</td>
                    <td className="px-3 py-2.5 text-right">{r.metrics.roas === null ? "—" : `${r.metrics.roas.toFixed(2)}×`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No results yet. Share your tracking links and log what each channel delivered.</p>
        )}

        <form
          className="mt-5 space-y-3 border-t border-border pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const ch = channels.find((c) => c.id === f.channelId);
            if (!ch) return setError("Pick a channel");
            start(async () => {
              const r = await addChannelResultAction(projectId, { ...f, channel: ch.name, channelType: ch.type });
              if (!r.ok) return setError(Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error);
              toast.success("Result logged");
              setF((s) => ({ ...s, spend: "", impressions: "", clicks: "", visits: "", signups: "", customers: "", revenue: "" }));
              router.refresh();
            });
          }}
        >
          <p className="text-sm font-medium">Log results</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-channel">Channel</Label>
              <select id="r-channel" value={f.channelId} onChange={(e) => set("channelId", e.target.value)} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm">
                {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="r-from">From</Label><Input id="r-from" type="date" value={f.periodStart} onChange={(e) => set("periodStart", e.target.value)} className="h-10" /></div>
            <div className="space-y-1.5"><Label htmlFor="r-to">To</Label><Input id="r-to" type="date" value={f.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} className="h-10" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {([["spend", `Spend (${currency})`], ["impressions", "Impressions"], ["clicks", "Clicks"], ["visits", "Visits"], ["signups", "Signups"], ["customers", "Customers"], ["revenue", `Revenue (${currency})`]] as const).map(([k, label]) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`r-${k}`}>{label}</Label>
                <Input id={`r-${k}`} inputMode="decimal" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder="optional" className="h-10" />
              </div>
            ))}
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end"><Button type="submit" variant="outline" className="rounded-[10px]" disabled={pending || !channels.length}>{pending ? <Loader2 className="animate-spin" /> : <Plus />} Log result</Button></div>
        </form>

        {rows.length ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Logged entries ({rows.length})</summary>
            <ul className="mt-2 divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{r.channel} · {r.periodStart} → {r.periodEnd} · {r.summary}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete entry" onClick={() => start(async () => { const res = await deleteChannelResultAction(r.id); if (!res.ok) toast.error(res.error); router.refresh(); })}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="surface p-6">
        <h2 className="flex items-center gap-2 font-medium"><Link2 className="size-4 text-primary" /> UTM link builder</h2>
        <p className="mt-1 text-sm text-muted-foreground">Custom tracking links (for a specific post, newsletter or campaign). Visits and signups are attributed by source, campaign and content.</p>
        {pages.length ? (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-5 sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await createUtmLinkAction(projectId, utm);
                if (!r.ok) toast.error(Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error);
                else toast.success("Link created");
                router.refresh();
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="u-page">Page</Label>
              <select id="u-page" value={utm.landingPageId} onChange={(e) => setUtm((u) => ({ ...u, landingPageId: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm">{pages.map((p) => <option key={p.id} value={p.id}>/p/{p.slug}</option>)}</select>
            </div>
            {(["source", "medium", "campaign", "content"] as const).map((k) => (
              <div key={k} className="space-y-1.5"><Label htmlFor={`u-${k}`} className="capitalize">{k}{k === "content" ? " (optional)" : ""}</Label><Input id={`u-${k}`} value={utm[k]} onChange={(e) => setUtm((u) => ({ ...u, [k]: e.target.value }))} placeholder={k === "source" ? "e.g. indie-hackers" : ""} className="h-10" /></div>
            ))}
            <div className="sm:col-span-5 flex justify-end"><Button type="submit" variant="outline" className="rounded-[10px]" disabled={pending}><Plus /> Create link</Button></div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Publish a landing page to build tracking links.</p>
        )}
        {links.length ? (
          <ul className="mt-4 divide-y divide-border text-sm">
            {links.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">{l.source} / {l.medium} / {l.campaign}{l.content ? ` / ${l.content}` : ""}</span>
                <span className="flex min-w-0 items-center gap-2"><code className="truncate text-xs">{l.url}</code><CopyButton text={l.url} /></span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
