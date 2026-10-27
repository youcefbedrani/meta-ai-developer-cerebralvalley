import { Handshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { MarketplaceNav } from "@/components/marketplace/shared";
import { label } from "@/lib/marketplace/deal-machine";
import { formatMoney } from "@/lib/marketplace/terms";
import { requireFounder } from "@/server/auth/current-user";
import { requireMarketplace } from "@/server/marketplace/guard";
import { listDealsForUser } from "@/server/marketplace/deals";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage() {
  requireMarketplace();
  const user = await requireFounder();
  const deals = await listDealsForUser(user.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Deals" description="Everything you're buying or selling: offers, payment held in escrow, transfers and payouts." />
      <MarketplaceNav active="deals" />
      {deals.length ? (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
          {deals.map(({ deal, listingTitle }) => (
            <li key={deal.id}>
              <Link href={`/app/marketplace/deals/${deal.id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                <span><span className="font-medium">{listingTitle}</span> <span className="text-xs text-muted-foreground">· you&apos;re the {deal.buyerId === user.id ? "buyer" : "seller"}</span></span>
                <span className="text-sm text-muted-foreground">{deal.amountCents ? `${formatMoney(deal.amountCents, deal.currency)} · ` : ""}<span className="rounded-full border border-border px-2 py-0.5 text-xs">{label(deal.state)}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Handshake} title="No deals yet" description="Make an offer on a listing, or list a project for buyers to find." action={<Link href="/app/marketplace" className="text-sm underline-offset-4 hover:underline">Browse listings</Link>} />
      )}
    </div>
  );
}
