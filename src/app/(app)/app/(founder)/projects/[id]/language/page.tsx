import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteCard } from "@/components/gold-mine/quote-card";
import { MarketVoicesPanel } from "@/components/market/market-voices";
import { MARKET_PLATFORMS, VOICE_THEMES } from "@/lib/market-platforms";
import { CREDIT_COSTS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { getProject } from "@/server/data/projects";
import { getLatestMarketVoices, listResearchJobs, getLatestCompetitorScan } from "@/server/data/research";
import { getProjectCustomerLanguage } from "@/server/services/gold-mine";

type Coverage = { key: string; found: number; quotes: number; failed: boolean }[];

/** Market voices: real quotes about the problem from public platforms, where they come from and what they say. */
export default async function MarketVoicesPage({ params, searchParams }: PageProps<"/app/projects/[id]/language">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const sp = await searchParams;
  if (!(await getProject(user.id, id))) notFound();
  const [groups, job, research, comp, balance] = await Promise.all([getProjectCustomerLanguage(user.id, id), getLatestMarketVoices(user.id, id), listResearchJobs(user.id, id, 1), getLatestCompetitorScan(user.id, id), getBalance(user.id)]);
  const busy = [research[0], comp].some((j) => j && (j.status === "queued" || j.status === "running"));
  const result = (job?.input?.result ?? null) as { coverage?: Coverage; saved?: number; queries?: string[] } | null;
  const all = groups.flatMap((g) => g.quotes.map((q) => ({ ...q, cluster: g.cluster })));
  const platformFilter = typeof sp.platform === "string" ? sp.platform : "";
  const themeFilter = typeof sp.theme === "string" ? sp.theme : "";
  const shown = all.filter((q) => (!platformFilter || q.platform === platformFilter) && (!themeFilter || q.cluster === themeFilter));

  // Counts from the whole library, so Gold Mine quotes and every scan add up.
  const byPlatform = new Map<string, number>();
  for (const q of all) byPlatform.set(q.platform, (byPlatform.get(q.platform) ?? 0) + 1);
  const platformRows = [...byPlatform.entries()].sort((a, b) => b[1] - a[1]);
  const silent = result?.coverage ? MARKET_PLATFORMS.filter((p) => !byPlatform.get(p.label) && result.coverage!.some((c) => c.key === p.key)) : [];
  const byTheme = new Map<string, number>();
  for (const q of all) byTheme.set(q.cluster, (byTheme.get(q.cluster) ?? 0) + 1);
  const themeRows = [...byTheme.entries()].sort((a, b) => b[1] - a[1]);
  const maxP = Math.max(1, ...platformRows.map((r) => r[1]));
  const maxT = Math.max(1, ...themeRows.map((r) => r[1]));
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(platformFilter ? { platform: platformFilter } : {}), ...(themeFilter ? { theme: themeFilter } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/app/projects/${id}/language${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <MarketVoicesPanel
        projectId={id}
        job={job ? { status: job.status, currentStage: job.currentStage, error: job.error, finishedAt: job.finishedAt?.toISOString() ?? null, saved: result?.saved ?? null } : null}
        cost={CREDIT_COSTS.market_voices}
        balance={balance}
        busy={busy}
      />

      {all.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="surface p-5">
            <h2 className="font-medium">Where people talk about it</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Verbatim quotes per platform. Click a platform to filter.</p>
            <ul className="mt-4 space-y-2">
              {platformRows.map(([platform, n]) => (
                <li key={platform}>
                  <Link href={qs({ platform: platformFilter === platform ? "" : platform })} className={cn("group grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm", platformFilter && platformFilter !== platform && "opacity-50")}>
                    <span className="truncate">{platform}</span>
                    <span className="bar-grow h-4 rounded-r-[4px] bg-[var(--plum)] opacity-85 group-hover:opacity-100" style={{ width: `${Math.max(3, (n / maxP) * 100)}%` }} />
                    <span className="tabular-nums text-muted-foreground">{n}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {silent.length ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Nothing public found on: {silent.map((p) => p.label).join(", ")}. {silent.some((p) => ["facebook", "x", "linkedin", "tiktok"].includes(p.key)) ? "Much of these platforms is behind a login, so search can't see it." : ""}
              </p>
            ) : null}
          </section>
          <section className="surface p-5">
            <h2 className="font-medium">What they say</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Quotes by theme. Click a theme to filter.</p>
            <ul className="mt-4 space-y-2">
              {themeRows.map(([theme, n]) => (
                <li key={theme}>
                  <Link href={qs({ theme: themeFilter === theme ? "" : theme })} className={cn("group grid grid-cols-[11rem_1fr_auto] items-center gap-3 text-sm", themeFilter && themeFilter !== theme && "opacity-50")}>
                    <span className="truncate">{theme}</span>
                    <span className="bar-grow h-4 rounded-r-[4px] bg-violet-400 opacity-85 group-hover:opacity-100" style={{ width: `${Math.max(3, (n / maxT) * 100)}%` }} />
                    <span className="tabular-nums text-muted-foreground">{n}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {result?.queries?.length ? <p className="mt-3 text-xs text-muted-foreground">Last scan searched for: {result.queries.map((q) => `“${q}”`).join(", ")}</p> : null}
          </section>
        </div>
      ) : null}

      {all.length ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">
              {shown.length} quote{shown.length === 1 ? "" : "s"}
              {platformFilter ? ` from ${platformFilter}` : ""}
              {themeFilter ? ` · ${themeFilter}` : ""}
            </h2>
            {platformFilter || themeFilter ? <Link href={`/app/projects/${id}/language`} className="text-sm text-primary hover:underline">Clear filters</Link> : null}
          </div>
          <p className="text-sm text-muted-foreground">Each quote is copied word for word from a public post and links back to it. Use people&apos;s own words in copy, ads and interviews.</p>
          <div className="stagger grid gap-3 md:grid-cols-2">
            {shown.slice(0, 60).map((q) => (
              <div key={q.id}>
                <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{q.cluster}</p>
                <QuoteCard q={q} copy />
              </div>
            ))}
          </div>
          {shown.length > 60 ? <p className="text-xs text-muted-foreground">Showing 60 of {shown.length}. Filter by platform or theme to see the rest.</p> : null}
        </section>
      ) : (
        <p className="surface p-5 text-sm text-muted-foreground">No quotes yet. Run the scan above, or turn a Gold Mine idea into a project, and real customer words will appear here grouped by platform and theme.</p>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">What each platform can show</summary>
        <ul className="mt-2 space-y-1">
          {MARKET_PLATFORMS.map((p) => (
            <li key={p.key}><span className="font-medium text-foreground">{p.label}:</span> {p.note}</li>
          ))}
          <li>Themes: {VOICE_THEMES.map((t) => t.label).join(" · ")}.</li>
        </ul>
      </details>
    </div>
  );
}
