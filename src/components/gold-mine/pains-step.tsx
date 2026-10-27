import { ArrowRight, CircleAlert, MessagesSquare, RotateCcw } from "lucide-react";
import Link from "next/link";
import { startMiningAction } from "@/app/(app)/app/(founder)/gold-mine/actions";
import { ConfigErrorNotice } from "@/components/config-error";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GoldMineSession, PainCluster, PainQuote } from "@/server/data/gold-mine";
import { ActionButton } from "./action-button";
import { MiningProgress } from "./mining-progress";
import { QuoteCard } from "./quote-card";

export function PainsStep({
  session,
  quotes,
  clusters,
  cost,
  missing,
}: {
  session: GoldMineSession;
  quotes: PainQuote[];
  clusters: PainCluster[];
  cost: number;
  missing: { label: string; vars: string[] }[];
}) {
  const status = session.miningStatus;
  const stats = (session.miningStats ?? {}) as Record<string, number>;
  if (status === "queued" || status === "running") return <MiningProgress stage={session.miningStage} />;

  return (
    <div className="space-y-6">
      <section className="surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-medium"><MessagesSquare className="size-4 text-primary" /> Pain Miner</h2>
            <p className="mt-1 text-sm text-muted-foreground">Finds recent, active public discussions about “{session.niche}”, reads them, and keeps short verbatim quotes with their link, community and date. Never full threads.</p>
          </div>
          <ActionButton action={startMiningAction} args={[session.id]} success="Pain mining started" disabled={missing.length > 0}>
            {status === "failed" ? <RotateCcw /> : null}
            {status === "succeeded" ? "Mine again" : status === "failed" ? "Retry" : "Start mining"} · {cost} credits
          </ActionButton>
        </div>
        {missing.map((m) => <div key={m.label} className="mt-4"><ConfigErrorNotice title={`${m.label} is not configured`} missing={m.vars} /></div>)}
        {status === "failed" ? (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" /> {session.miningError}</p>
        ) : null}
        {status === "succeeded" ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {stats.threadsFound ?? 0} discussions found · {stats.threadsRead ?? 0} read · {stats.quotes ?? 0} quotes kept · {stats.droppedQuotes ?? 0} discarded (not verbatim or duplicate) · {stats.clusters ?? 0} pain clusters
          </p>
        ) : null}
      </section>

      {status === "succeeded" && stats.needsMoreData ? (
        <section className="rounded-2xl border border-warning/30 bg-warning/5 p-5 text-sm">
          <p className="font-medium text-warning">Needs more data</p>
          <p className="mt-1 text-muted-foreground">Only {quotes.length} usable quote(s) were found — not enough to cluster pains reliably. Try a broader or more common niche phrasing, enable more discussion sources, or mine again later. We won&apos;t fill the gap with AI-written pains.</p>
        </section>
      ) : null}

      {clusters.length ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Pain clusters, ranked</h3>
            <Link href={`/app/gold-mine/${session.id}?step=ideas`} className={cn(buttonVariants({ variant: "gradient" }), "h-9 px-4")}>Turn pains into ideas <ArrowRight /></Link>
          </div>
          {clusters.map((c) => <ClusterCard key={c.id} c={c} />)}
        </section>
      ) : quotes.length ? (
        <section className="grid gap-3 md:grid-cols-2">{quotes.map((q) => <QuoteCard key={q.id} q={q} />)}</section>
      ) : status !== "succeeded" && status !== "failed" ? (
        <div className="ambient-glow rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No pains mined yet. Start the Pain Miner to collect real customer quotes.</div>
      ) : null}
    </div>
  );
}

export function ClusterCard({ c, compact }: { c: PainCluster; compact?: boolean }) {
  return (
    <article className="surface p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">#{c.rank}</p>
          <h4 className="font-medium">{c.title}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
        </div>
        <dl className="flex shrink-0 gap-4 text-center text-xs">
          <div><dt className="text-muted-foreground">Quotes</dt><dd className="text-lg font-semibold">{c.frequency}</dd></div>
          <div><dt className="text-muted-foreground">Intensity</dt><dd className="text-lg font-semibold">{c.intensity}/5</dd></div>
          <div><dt className="text-muted-foreground">Recent</dt><dd className="text-lg font-semibold">{c.recency === null ? "—" : `${Math.round(Number(c.recency) * 100)}%`}</dd></div>
        </dl>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {(compact ? c.quotes.slice(0, 2) : c.quotes.slice(0, 4)).map((q) => <QuoteCard key={q.id} q={q} />)}
      </div>
      {c.quotes.length > 4 && !compact ? <p className="mt-2 text-xs text-muted-foreground">+ {c.quotes.length - 4} more quotes</p> : null}
    </article>
  );
}
