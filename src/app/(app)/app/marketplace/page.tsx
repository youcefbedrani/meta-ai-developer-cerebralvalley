import { Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ListingCard, MarketplaceNav } from "@/components/marketplace/shared";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireFounder } from "@/server/auth/current-user";
import { listPublishedListings } from "@/server/data/marketplace";
import { requireMarketplace } from "@/server/marketplace/guard";

export const metadata: Metadata = { title: "Marketplace" };

const KINDS = [
  ["all", "Everything"],
  ["idea", "Ideas"],
  ["project", "Full projects"],
] as const;

export default async function MarketplacePage({ searchParams }: PageProps<"/app/marketplace">) {
  requireMarketplace();
  await requireFounder();
  const sp = await searchParams;
  const kind = sp.kind === "idea" || sp.kind === "project" ? sp.kind : undefined;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const listings = await listPublishedListings({ kind, q: q || undefined });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Idea Marketplace"
        description="Buy an idea or a full project for your SaaS, or sell yours. Listings show only the niche, the price and what the seller estimates it can make. Details unlock after you sign the NDA and the seller grants access (or you make an offer)."
        actions={<Link href="/app/marketplace/sell/new" className={cn(buttonVariants({ variant: "gradient" }), "h-10 px-4")}>Sell an idea or project</Link>}
      />
      <MarketplaceNav active="browse" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {KINDS.map(([k, label]) => {
          const params = new URLSearchParams({ ...(k !== "all" ? { kind: k } : {}), ...(q ? { q } : {}) });
          return (
            <Link key={k} href={`/app/marketplace${params.size ? `?${params}` : ""}`} className={cn("rounded-full border px-3 py-1", (kind ?? "all") === k ? "border-[var(--violet)] bg-[var(--violet)]/10" : "border-border bg-white")}>
              {label}
            </Link>
          );
        })}
        <form action="/app/marketplace" className="ml-auto flex gap-2">
          {kind ? <input type="hidden" name="kind" value={kind} /> : null}
          <input name="q" defaultValue={q} placeholder="Search by niche" aria-label="Search by niche" className="h-9 w-56 rounded-lg border border-input bg-white px-3 text-sm" />
        </form>
      </div>
      {listings.length ? (
        <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">{listings.map((l) => <ListingCard key={l.id} l={l} href={`/app/marketplace/${l.id}`} />)}</div>
      ) : (
        <EmptyState icon={Store} title={q || kind ? "Nothing matches" : "No listings yet"} description={q || kind ? "Try another niche or show everything." : "Be the first to list an idea or a project."} action={<Link href="/app/marketplace/sell/new" className={cn(buttonVariants({ variant: "gradient" }), "h-10 px-5")}>Sell an idea or project</Link>} />
      )}
    </div>
  );
}
