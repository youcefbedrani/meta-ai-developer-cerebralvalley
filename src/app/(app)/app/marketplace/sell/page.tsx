import { Plus, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { LevelBadge, MarketplaceNav } from "@/components/marketplace/shared";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/marketplace/terms";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { listOwnListings } from "@/server/data/marketplace";
import { requireMarketplace } from "@/server/marketplace/guard";

export const metadata: Metadata = { title: "Selling" };

const STATUS: Record<string, string> = { draft: "Draft", pending_review: "In review", published: "Published", rejected: "Changes needed", unpublished: "Unpublished", sold: "Sold" };

export default async function SellPage() {
  requireMarketplace();
  const user = await requireOnboardedUser();
  const listings = await listOwnListings(user.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Selling" description="Your listings, their review status, access requests and offers." actions={<Link href="/app/marketplace/sell/new" className={cn(buttonVariants({ variant: "gradient" }), "h-10 px-4")}><Plus /> Sell an idea or project</Link>} />
      <MarketplaceNav active="sell" />
      {listings.length ? (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
          {listings.map((l) => (
            <li key={l.id}>
              <Link href={`/app/marketplace/sell/${l.id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{l.title}</span>
                <span className="flex items-center gap-3 text-sm text-muted-foreground"><LevelBadge level={l.validationLevel} /> {formatMoney(l.priceCents, l.currency)} <span className="rounded-full border border-border px-2 py-0.5 text-xs">{STATUS[l.status]}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Store} title="Nothing listed yet" description="Turn a researched or validated project into a package someone can buy." action={<Link href="/app/marketplace/sell/new" className={cn(buttonVariants({ variant: "gradient" }), "h-10 px-5")}>Sell an idea or project</Link>} />
      )}
    </div>
  );
}
