import { ChevronLeft, Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { AccessDecision, TeaserEditor, UnpublishButton } from "@/components/marketplace/listing-manager";
import { earningLabel, KIND_LABEL, LevelBadge, MarketplaceNav } from "@/components/marketplace/shared";
import { label as stateLabel } from "@/lib/marketplace/deal-machine";
import { formatMoney } from "@/lib/marketplace/terms";
import { CREDIT_COSTS } from "@/lib/plans";
import { ASSET_LABELS } from "@/lib/validation/marketplace";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getDb, schema } from "@/server/db/client";
import { getOwnListing, listAccessRequests, parseTeaser } from "@/server/data/marketplace";
import { requireMarketplace } from "@/server/marketplace/guard";
import { listDealsForListing } from "@/server/marketplace/deals";

export const metadata: Metadata = { title: "Manage listing" };

export default async function ManageListingPage({ params }: PageProps<"/app/marketplace/sell/[listingId]">) {
  requireMarketplace();
  const user = await requireOnboardedUser();
  const { listingId } = await params;
  const listing = await getOwnListing(user.id, listingId);
  if (!listing) notFound();
  const [requests, deals, [views]] = await Promise.all([listAccessRequests(user.id, listing.id), listDealsForListing(user.id, listing.id), getDb().select({ n: count() }).from(schema.listingViews).where(eq(schema.listingViews.listingId, listing.id))]);
  const editable = ["draft", "rejected", "unpublished"].includes(listing.status);

  return (
    <div className="space-y-6">
      <Link href="/app/marketplace/sell" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Selling</Link>
      <MarketplaceNav active="sell" />
      <section className="surface p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{KIND_LABEL[listing.kind]}</span>
              {listing.kind === "project" ? <LevelBadge level={listing.validationLevel} withHint /> : null} {listing.licenseType === "exclusive_transfer" ? "Exclusive transfer" : "Non-exclusive"} · {formatMoney(listing.priceCents, listing.currency)} {listing.priceType === "offers" ? "(offers)" : "(fixed)"}
              <span className="flex items-center gap-1"><Eye className="size-3.5" /> {views.n} views logged</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border px-3 py-1 text-sm capitalize">{listing.status.replace("_", " ")}</span>
            {listing.status === "published" ? <Link href={`/app/marketplace/${listing.id}`} className="text-sm underline-offset-4 hover:underline">View public page</Link> : null}
            {listing.status === "published" || listing.status === "pending_review" ? <UnpublishButton listingId={listing.id} /> : null}
          </div>
        </div>
        {listing.status === "pending_review" ? <p className="mt-4 rounded-xl bg-muted/40 px-4 py-3 text-sm">An admin is reviewing the listing. It goes live once approved.</p> : null}
        {listing.reviewNote ? <p className="mt-4 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm"><b>Review note:</b> {listing.reviewNote}</p> : null}
        <div className="mt-4 rounded-xl border border-[var(--violet)]/30 bg-[var(--violet)]/5 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What the public sees</p>
          <p className="mt-1"><b>Niche:</b> {listing.niche || "not set"} · <b>Price:</b> {formatMoney(listing.priceCents, listing.currency)} · <b>Could make:</b> {earningLabel(listing.earningMaxCents ? { minCents: listing.earningMinCents ?? 0, maxCents: listing.earningMaxCents } : null, listing.currency)} <span className="text-xs text-muted-foreground">(seller&apos;s estimate)</span></p>
          {listing.earningBasis ? <p className="mt-1 text-xs text-muted-foreground">Your estimate note (buyers with access only): {listing.earningBasis}</p> : null}
        </div>
        <p className="mt-4 text-sm text-muted-foreground"><b className="text-foreground">Included:</b> {listing.assets.map((a) => ASSET_LABELS[a.kind] + (a.description ? ` (${a.description})` : "")).join(" · ")}</p>
      </section>

      <TeaserEditor listingId={listing.id} initial={parseTeaser(listing) ?? { title: listing.title }} editable={editable} cost={CREDIT_COSTS.marketplace_teaser} aiDraft={listing.kind === "project"} />

      <section className="surface p-6">
        <h2 className="font-medium">Access requests</h2>
        {requests.length ? (
          <ul className="mt-3 divide-y divide-border text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span><b>{r.buyerName ?? r.buyerEmail}</b>{r.message ? `: “${r.message}”` : ""} <span className="text-xs text-muted-foreground">(signed the NDA)</span></span>
                {r.status === "requested" ? <AccessDecision accessId={r.id} /> : <span className="text-xs capitalize text-muted-foreground">{r.status}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-muted-foreground">No requests yet.</p>}
      </section>

      <section className="surface p-6">
        <h2 className="font-medium">Offers & deals</h2>
        {deals.length ? (
          <ul className="mt-3 divide-y divide-border text-sm">
            {deals.map(({ deal, buyerName, buyerEmail }) => (
              <li key={deal.id}><Link href={`/app/marketplace/deals/${deal.id}`} className="flex items-center justify-between py-3 hover:underline"><span>{buyerName ?? buyerEmail}</span><span className="text-xs">{stateLabel(deal.state)}{deal.amountCents ? ` · ${formatMoney(deal.amountCents, deal.currency)}` : ""}</span></Link></li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-muted-foreground">No offers yet.</p>}
      </section>
    </div>
  );
}
