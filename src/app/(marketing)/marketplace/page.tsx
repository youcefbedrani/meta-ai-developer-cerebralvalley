import type { Metadata } from "next";
import { MarketingPage } from "@/components/landing/marketing-page";
import { ListingCard } from "@/components/marketplace/shared";
import { listPublishedListings } from "@/server/data/marketplace";
import { requireMarketplace } from "@/server/marketplace/guard";
import "../landing.css";

export const metadata: Metadata = { title: "Idea Marketplace", description: "Buy or sell SaaS ideas and validated projects. See the niche, the price and the seller's earning estimate; details unlock after an NDA." };
export const dynamic = "force-dynamic";

export default async function PublicMarketplacePage() {
  requireMarketplace();
  const listings = await listPublishedListings();
  return (
    <MarketingPage>
      <section className="pad">
        <div className="head">
          <span className="eyebrow"><i />Idea Marketplace</span>
          <h1 className="h2">Buy an idea for your next SaaS</h1>
          <p className="lead">Each listing shows only the niche, the price and what the seller estimates it can make. The idea itself unlocks after you sign an NDA and the seller grants access, so ideas stay protected.</p>
        </div>
        <div className="mx-auto grid max-w-6xl gap-4 px-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((l) => <ListingCard key={l.id} l={l} href={`/marketplace/${l.id}`} />)}
          {!listings.length ? <p className="col-span-full text-center text-sm text-muted-foreground">No listings yet.</p> : null}
        </div>
      </section>
    </MarketingPage>
  );
}
