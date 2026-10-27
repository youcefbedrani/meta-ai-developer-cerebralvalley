import { Check, Minus } from "lucide-react";
import { byType, coverage, coverageSummary, COVERAGE_FIELDS, featureMatrix, pricingLadder, type CompetitorLike } from "@/lib/competitors";
import { cn } from "@/lib/utils";

const TYPE_META = {
  direct: { label: "Direct", hint: "Same product, same customer", dot: "bg-[var(--plum)]" },
  indirect: { label: "Indirect", hint: "Different product, same problem", dot: "bg-violet-400" },
  alternative: { label: "Alternatives", hint: "What people do instead", dot: "bg-slate-400" },
} as const;

/** The landscape as a target: you in the middle, direct competitors closest, alternatives furthest out. */
export function Landscape({ list, projectName }: { list: CompetitorLike[]; projectName: string }) {
  const groups = byType(list);
  return (
    <section className="surface p-5" aria-labelledby="landscape-title">
      <h2 id="landscape-title" className="font-medium">Competitive landscape</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Closest threats in the inner ring. Hover a name for what we know.</p>
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[320px]" aria-hidden="true">
          {(["alternative", "indirect", "direct"] as const).map((t, i) => (
            <div key={t} className={cn("absolute rounded-full border", i === 0 ? "inset-0 border-dashed border-slate-300" : i === 1 ? "inset-[8%] border-violet-200 bg-violet-50/40" : "inset-[22%] border-[var(--plum)]/30 bg-[var(--plum)]/5")} />
          ))}
          <div className="absolute inset-[39%] grid place-items-center rounded-full bg-[var(--plum)] text-center text-[10px] font-semibold leading-tight text-white shadow-glow">You</div>
          {(["direct", "indirect", "alternative"] as const).flatMap((t) => {
            // Radius as a fraction of the box: each dot sits mid-band in its ring (rings at 0.28 / 0.42 / 0.5).
            const ring = { direct: 0.2, indirect: 0.35, alternative: 0.46 }[t];
            return groups[t].slice(0, 8).map((c, i, arr) => {
              const angle = (i / arr.length) * 2 * Math.PI - Math.PI / 2 + (t === "indirect" ? 0.4 : t === "alternative" ? 0.8 : 0);
              return (
                <span
                  key={c.id}
                  className={cn("absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white", TYPE_META[t].dot)}
                  style={{ left: `${50 + Math.cos(angle) * ring * 100}%`, top: `${50 + Math.sin(angle) * ring * 100}%` }}
                />
              );
            });
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {(["direct", "indirect", "alternative"] as const).map((t) => (
            <div key={t} className="rounded-xl border border-border p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className={cn("size-2.5 rounded-full", TYPE_META[t].dot)} aria-hidden="true" />
                {TYPE_META[t].label} <span className="tabular-nums text-muted-foreground">({groups[t].length})</span>
              </p>
              <p className="text-xs text-muted-foreground">{TYPE_META[t].hint}</p>
              <ul className="mt-2 flex flex-wrap gap-1">
                {groups[t].map((c) => (
                  <li key={c.id}>
                    <a href={`#competitor-${c.id}`} title={c.description ?? undefined} className="inline-block rounded-md border border-border bg-white px-1.5 py-0.5 text-xs hover:border-[var(--violet)]">
                      {c.name}
                    </a>
                  </li>
                ))}
                {!groups[t].length ? <li className="text-xs text-muted-foreground">None found yet</li> : null}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <p className="sr-only">{projectName} has {groups.direct.length} direct competitors, {groups.indirect.length} indirect and {groups.alternative.length} alternatives.</p>
    </section>
  );
}

/** Which competitor mentions which feature. */
export function FeatureMatrix({ list }: { list: CompetitorLike[] }) {
  const m = featureMatrix(list);
  if (!m.features.length) return null;
  return (
    <section className="surface p-5">
      <h2 className="font-medium">Feature comparison</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Features mentioned in sources, most common first. A blank means the sources didn&apos;t mention it, not that it&apos;s absent.</p>
      <div className="-mx-5 mt-4 overflow-x-auto px-5">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Feature</th>
              {m.competitors.map((c) => (
                <th key={c.id} className="max-w-24 truncate px-2 py-2 text-center font-medium" title={c.name}>{c.name}</th>
              ))}
              <th className="py-2 pl-2 text-right font-medium">Mentioned by</th>
            </tr>
          </thead>
          <tbody>
            {m.features.map((f) => (
              <tr key={f.label} className="border-b border-border/60">
                <td className="py-2 pr-3">{f.label}</td>
                {m.competitors.map((c) => (
                  <td key={c.id} className="px-2 py-2 text-center">
                    {f.has(c.id) ? <Check className="mx-auto size-4 text-emerald-600" aria-label="mentioned" /> : <Minus className="mx-auto size-3 text-muted-foreground/40" aria-label="not mentioned" />}
                  </td>
                ))}
                <td className="py-2 pl-2 text-right tabular-nums text-muted-foreground">{f.count}/{m.competitors.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {m.tableStakes.length || m.rare.length ? (
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {m.tableStakes.length ? (
            <p className="rounded-xl border border-border p-3"><span className="font-mono text-[10px] font-semibold text-violet-700">ANALYSIS</span> <span className="font-medium">Likely table stakes:</span> {m.tableStakes.join(", ")}. Most competitors mention these.</p>
          ) : null}
          {m.rare.length ? (
            <p className="rounded-xl border border-border p-3"><span className="font-mono text-[10px] font-semibold text-violet-700">ANALYSIS</span> <span className="font-medium">Mentioned by only one:</span> {m.rare.join(", ")}. Possible differentiators, or gaps in what the sources covered.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Cheapest sourced monthly price per competitor. Single series, hover a bar for the source quote. */
export function PricingLadder({ list }: { list: CompetitorLike[] }) {
  const { priced, unpriced } = pricingLadder(list);
  const currency = mostCommon(priced.map((p) => p.currency)) ?? "USD";
  const shown = priced.filter((p) => p.currency === currency);
  const other = priced.filter((p) => p.currency !== currency);
  const max = Math.max(1, ...shown.map((p) => p.price));
  return (
    <section className="surface p-5">
      <h2 className="font-medium">Pricing ladder</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Cheapest paid monthly plan, only where a source shows the price ({currency}). Hover a bar for the quote.</p>
      {shown.length ? (
        <ul className="mt-4 space-y-2">
          {shown.map((p) => (
            <li key={p.id} className="group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm" title={`“${p.quote}”`}>
              <span className="truncate">{p.name}</span>
              <span className="bar-grow h-5 rounded-r-[4px] bg-[var(--plum)] opacity-85 transition-opacity group-hover:opacity-100" style={{ width: `${Math.max(3, (p.price / max) * 100)}%` }} />
              <span className="whitespace-nowrap tabular-nums">
                {p.price === 0 ? "Free" : `${p.price.toLocaleString("en-US")} ${p.currency}/mo`}
                <span className="ml-1 text-xs text-muted-foreground">{p.plan}{p.free && p.price > 0 ? " · free plan too" : ""}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No monthly prices found in sources yet. A competitor scan looks up pricing pages.</p>
      )}
      {other.length ? <p className="mt-3 text-xs text-muted-foreground">Other currencies: {other.map((p) => `${p.name} ${p.price} ${p.currency}/mo`).join(" · ")}</p> : null}
      {unpriced.length ? <p className="mt-3 text-xs text-muted-foreground">No sourced monthly price: {unpriced.join(", ")}.</p> : null}
    </section>
  );
}

const FIELD_LABEL: Record<(typeof COVERAGE_FIELDS)[number], string> = {
  website: "Website",
  description: "What it is",
  customer: "Customer",
  features: "Features",
  pricing: "Pricing",
  strengths: "Strengths",
  weaknesses: "Weaknesses",
  sources: "Sources",
};

/** What we know about each competitor, and the gaps a scan should fill. */
export function CoverageGrid({ list }: { list: CompetitorLike[] }) {
  const s = coverageSummary(list);
  return (
    <section className="surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-medium">What we know (and what&apos;s missing)</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Each cell is filled only when a source backs it. Gaps are what the next scan tries to fill.</p>
        </div>
        <p className="text-sm"><span className="text-2xl font-semibold tabular-nums">{s.percent}%</span><span className="text-muted-foreground"> known · {s.gaps} gaps</span></p>
      </div>
      <div className="-mx-5 mt-4 overflow-x-auto px-5">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 pr-3 text-left font-medium">Competitor</th>
              {COVERAGE_FIELDS.map((f) => (
                <th key={f} className="px-1 py-2 text-center font-medium">{FIELD_LABEL[f]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const cov = coverage(c);
              return (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="py-2 pr-3"><a href={`#competitor-${c.id}`} className="hover:underline">{c.name}</a></td>
                  {COVERAGE_FIELDS.map((f) => (
                    <td key={f} className="px-1 py-2 text-center">
                      {cov[f] ? (
                        <span className="mx-auto grid size-5 place-items-center rounded-md bg-emerald-50 text-emerald-700"><Check className="size-3.5" aria-label={`${FIELD_LABEL[f]} known`} /></span>
                      ) : (
                        <span className="mx-auto grid size-5 place-items-center rounded-md border border-dashed border-amber-300 text-[10px] text-amber-700" aria-label={`${FIELD_LABEL[f]} missing`}>?</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function mostCommon(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
