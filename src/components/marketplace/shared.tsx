import { BadgeCheck, FileSearch, FlaskConical, Lightbulb, Star, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { formatMoney } from "@/lib/marketplace/terms";
import { LEVEL_INFO, type ValidationLevel } from "@/lib/marketplace/validation-level";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<ValidationLevel, { icon: typeof Lightbulb; className: string }> = {
  none: { icon: Lightbulb, className: "border-border bg-muted text-muted-foreground" },
  researched: { icon: FileSearch, className: "border-sky-200 bg-sky-50 text-sky-800" },
  tested: { icon: FlaskConical, className: "border-amber-200 bg-amber-50 text-amber-800" },
  validated: { icon: TrendingUp, className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  revenue: { icon: Trophy, className: "border-violet-200 bg-violet-50 text-violet-800" },
};

export function LevelBadge({ level, withHint }: { level: ValidationLevel; withHint?: boolean }) {
  const s = LEVEL_STYLE[level];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", s.className)} title={LEVEL_INFO[level].description}>
      <s.icon className="size-3.5" /> {LEVEL_INFO[level].label}
      {withHint ? <span className="font-normal opacity-80">· computed by platform</span> : null}
    </span>
  );
}

export function MetricChip({ m }: { m: { label: string; value: string; verified: boolean } }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs", m.verified ? "border-emerald-200 bg-emerald-50/60" : "border-border bg-white")}>
      <span className="font-semibold">{m.value}</span> {m.label}
      {m.verified ? <BadgeCheck className="size-3.5 text-emerald-600" aria-label="verified by platform" /> : <span className="text-[10px] text-muted-foreground">self-reported</span>}
    </span>
  );
}

export type CardListing = {
  id: string;
  kind: "project" | "idea";
  niche: string;
  licenseType: "exclusive_transfer" | "non_exclusive";
  priceType: "fixed" | "offers";
  priceCents: number;
  currency: string;
  earning: { minCents: number; maxCents: number } | null;
  sellerRating: { average: number | null; count: number };
  proof?: { facts: number; quotes: number; competitors: number; signups: number; results: number } | null;
};

/** Validation proof counted by the platform from the seller's project. Empty when there's nothing to show. */
export function ProofRow({ proof, className }: { proof: CardListing["proof"]; className?: string }) {
  const items = proof
    ? [
        { n: proof.facts, label: "sourced facts" },
        { n: proof.quotes, label: "real quotes" },
        { n: proof.competitors, label: "competitors mapped" },
        { n: proof.signups, label: "waitlist signups" },
        { n: proof.results, label: "test results" },
      ].filter((i) => i.n > 0)
    : [];
  if (!items.length) return <p className={cn("text-xs text-muted-foreground", className)}>No validation proof yet</p>;
  return (
    <div className={className}>
      <p className="flex items-center gap-1 text-xs font-medium text-emerald-700"><BadgeCheck className="size-3.5" /> Proof checked by Startum</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{items.map((i) => `${i.n} ${i.label}`).join(" · ")}</p>
    </div>
  );
}

/** "$2,000–$5,000 / month" or "Up to $5,000 / month". Always the seller's estimate. */
export function earningLabel(e: CardListing["earning"], currency: string): string {
  if (!e) return "No estimate";
  const max = formatMoney(e.maxCents, currency);
  return e.minCents > 0 && e.minCents < e.maxCents ? `${formatMoney(e.minCents, currency)}–${max} / month` : `Up to ${max} / month`;
}

export const KIND_LABEL = { project: "Full project", idea: "Idea" } as const;

/** Public card: niche, earning estimate and price only. Everything else unlocks after NDA + access. */
export function ListingCard({ l, href }: { l: CardListing; href: string }) {
  return (
    <Link href={href} className="surface group flex flex-col p-5 transition-transform hover:-translate-y-0.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={cn("rounded-full px-2 py-0.5 font-medium", l.kind === "idea" ? "bg-amber-50 text-amber-800" : "bg-violet-50 text-violet-800")}>{KIND_LABEL[l.kind]}</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">{l.licenseType === "exclusive_transfer" ? "Exclusive" : "Non-exclusive copy"}</span>
      </div>
      <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Niche</p>
      <p className="font-semibold tracking-tight">{l.niche}</p>
      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="size-3.5" /> Could make (seller&apos;s estimate)</p>
        <p className="mt-0.5 font-semibold tabular-nums">{earningLabel(l.earning, l.currency)}</p>
      </div>
      <ProofRow proof={l.proof} className="mt-3" />
      <div className="mt-auto flex items-end justify-between gap-2 pt-4">
        <div>
          <p className="text-lg font-semibold tabular-nums">{formatMoney(l.priceCents, l.currency)}</p>
          <p className="text-xs text-muted-foreground">{l.priceType === "fixed" ? "Fixed price" : "Asking price · offers welcome"}</p>
        </div>
        {l.sellerRating.count ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Star className="size-3.5 fill-amber-400 text-amber-400" /> {l.sellerRating.average?.toFixed(1)} ({l.sellerRating.count})</span> : <span className="text-xs text-muted-foreground">New seller</span>}
      </div>
    </Link>
  );
}

export function MarketplaceNav({ active }: { active: "browse" | "sell" | "deals" | "payouts" }) {
  const items = [
    { k: "browse", href: "/app/marketplace", label: "Browse" },
    { k: "sell", href: "/app/marketplace/sell", label: "Selling" },
    { k: "deals", href: "/app/marketplace/deals", label: "Deals" },
    { k: "payouts", href: "/app/marketplace/payouts", label: "Payouts" },
  ] as const;
  return (
    <nav aria-label="Marketplace" className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1 text-sm">
      {items.map((i) => (
        <Link key={i.k} href={i.href} aria-current={active === i.k ? "page" : undefined} className={cn("rounded-lg px-3.5 py-1.5", active === i.k ? "bg-[var(--plum)] text-white" : "text-muted-foreground hover:text-foreground")}>{i.label}</Link>
      ))}
    </nav>
  );
}
