import { BadgeCheck, ChevronLeft, Lock, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, notInArray } from "drizzle-orm";
import { BuyerPanel } from "@/components/marketplace/buyer-panel";
import { earningLabel, KIND_LABEL, LevelBadge, MetricChip, ProofRow } from "@/components/marketplace/shared";
import { formatMoney, NDA_TEXT } from "@/lib/marketplace/terms";
import { LEVEL_INFO } from "@/lib/marketplace/validation-level";
import { ASSET_LABELS } from "@/lib/validation/marketplace";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { clientIp } from "@/server/client-ip";
import { getDb, schema } from "@/server/db/client";
import { getPublicListing, logListingView } from "@/server/data/marketplace";
import { requireMarketplace } from "@/server/marketplace/guard";
import { getListingPackage } from "@/server/marketplace/package";

export const metadata: Metadata = { title: "Listing" };

export default async function ListingPage({ params }: PageProps<"/app/marketplace/[listingId]">) {
  requireMarketplace();
  const user = await requireOnboardedUser();
  const { listingId } = await params;
  const listing = await getPublicListing(listingId);
  if (!listing) notFound();
  const ip = clientIp(new Request("http://local", { headers: await headers() }));
  const isSeller = listing.sellerId === user.id;
  if (!isSeller) await logListingView(listing.id, user.id, "teaser", ip);
  const view = isSeller ? null : await getListingPackage(user.id, listing.id, ip);
  const access = view?.access ?? { nda: false, access: "none" as const, hasDeal: false, full: false };
  const details = view && "details" in view ? view.details : null;
  const pkg = view?.pkg ?? null;
  const idea = view && "idea" in view ? view.idea : null;
  const [deal] = await getDb()
    .select({ id: schema.deals.id })
    .from(schema.deals)
    .where(and(eq(schema.deals.listingId, listing.id), eq(schema.deals.buyerId, user.id), notInArray(schema.deals.state, ["CANCELLED", "REFUNDED"])))
    .limit(1);
  const [row] = await getDb().select({ min: schema.listings.minPriceCents, max: schema.listings.maxPriceCents }).from(schema.listings).where(eq(schema.listings.id, listing.id));

  return (
    <div className="space-y-6">
      <Link href="/app/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Marketplace</Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="surface p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={listing.kind === "idea" ? "rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800" : "rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-800"}>{KIND_LABEL[listing.kind]}</span>
              <span className="rounded-full border border-border px-2 py-0.5">
                {listing.licenseType === "exclusive_transfer" ? `Exclusive: it moves to you${listing.kind === "project" ? ", with a non-compete" : ""}` : "Non-exclusive copy (may be sold more than once)"}
              </span>
              {listing.status === "sold" ? <span className="rounded-full bg-[var(--plum)] px-2 py-0.5 text-white">Sold</span> : null}
            </div>
            <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Niche</p>
            <h1 className="text-2xl font-semibold tracking-tight">{listing.niche}</h1>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="size-3.5" /> Could make</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{earningLabel(listing.earning, listing.currency)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Seller&apos;s estimate. Startum hasn&apos;t verified it.</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(listing.priceCents, listing.currency)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{listing.priceType === "fixed" ? "Fixed price" : "Asking price · offers welcome"} · payment held until you confirm the transfer</p>
              </div>
            </div>
            <ProofRow proof={listing.proof} className="mt-4 rounded-xl border border-border p-4" />
          </section>

          {details ? (
            <section className="surface space-y-5 p-6" aria-label="Full details">
              <h2 className="flex items-center gap-2 font-medium"><BadgeCheck className="size-4 text-emerald-600" /> Full details (under NDA)</h2>
              <div>
                <p className="text-lg font-semibold">{details.title}</p>
                {listing.kind === "project" ? <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><LevelBadge level={details.validationLevel} withHint /> {LEVEL_INFO[details.validationLevel].description}</p> : null}
              </div>
              {details.earningBasis ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">How the seller estimated the earnings</p>
                  <p className="mt-1">{details.earningBasis}</p>
                </div>
              ) : null}
              {idea ? (
                <dl className="grid gap-4 text-sm md:grid-cols-2">
                  {[["Problem", idea.problem], ["Target customer", idea.targetCustomer], ["Solution", idea.solution], ["Differentiation", idea.differentiationHypothesis], ["Monetization", idea.monetization], ["First experiment", `${idea.firstExperiment.description} (success: ${idea.firstExperiment.successCriteria})`]].map(([k, v]) => (
                    <div key={k}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="mt-1">{v}</dd></div>
                  ))}
                  {idea.currentAlternatives.length ? <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">How people solve it today</dt><dd className="mt-1">{idea.currentAlternatives.join(" · ")}</dd></div> : null}
                  {idea.risks.length ? <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Risks</dt><dd className="mt-1">{idea.risks.join(" · ")}</dd></div> : null}
                  <p className="text-xs text-muted-foreground md:col-span-2">This idea is a hypothesis unless the seller&apos;s notes say otherwise. Test it before you build.</p>
                </dl>
              ) : details.teaser ? (
                <dl className="grid gap-4 text-sm md:grid-cols-2">
                  {[["Problem", details.teaser.problem], ["Market", details.teaser.market], ["Solution", details.teaser.solution], ["Ideal buyer", details.teaser.idealBuyer]].map(([k, v]) => (
                    <div key={k}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="mt-1">{v}</dd></div>
                  ))}
                  <ul className="list-disc space-y-1 pl-5 md:col-span-2">{details.teaser.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
                </dl>
              ) : null}
              {details.metrics.length ? (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Metrics</p>
                  <p className="mt-1 text-xs text-muted-foreground"><BadgeCheck className="inline size-3.5 text-emerald-600" /> verified = tracked on Startum pages. Everything else is self-reported.</p>
                  <div className="mt-2 flex flex-wrap gap-2">{details.metrics.map((m) => <MetricChip key={m.label} m={m} />)}</div>
                </div>
              ) : null}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">What&apos;s included</p>
                <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">{details.assets.map((a) => <li key={a.kind} className="rounded-lg border border-border bg-white px-3 py-2">{ASSET_LABELS[a.kind]}</li>)}</ul>
              </div>
              {pkg ? (
                <>
                  {pkg.research ? (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Research summary</p>
                      <p className="mt-1 text-sm">{pkg.research.summary ?? "—"}</p>
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{pkg.research.sources.map((s) => <li key={s.url}>{s.title ?? s.domain} · {s.domain}</li>)}</ul>
                    </div>
                  ) : null}
                  {pkg.competitors.length ? <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Competitors</p><p className="mt-1 text-sm">{pkg.competitors.map((c) => `${c.name} (${c.type})`).join(" · ")}</p></div> : null}
                  {pkg.quotes.length ? <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Customer pain quotes</p><ul className="mt-1 space-y-1 text-sm italic">{pkg.quotes.slice(0, 8).map((q, i) => <li key={i}>“{q.quote}” <span className="not-italic text-xs text-muted-foreground">({q.platform})</span></li>)}</ul></div> : null}
                  {pkg.experiments.length ? <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Experiments (self-reported results)</p><ul className="mt-1 space-y-1 text-sm">{pkg.experiments.map((e, i) => <li key={i}>{e.title} · {e.status}{e.passed === null ? "" : e.passed ? " · passed" : " · did not pass"}</li>)}</ul></div> : null}
                  {pkg.waitlist ? <p className="text-sm"><b>Waitlist:</b> {pkg.waitlist.total} signups ({pkg.waitlist.consented} consented to transfer; only those emails are handed over).</p> : null}
                  {pkg.external.length ? <div><p className="text-xs uppercase tracking-wider text-muted-foreground">External assets</p><ul className="mt-1 space-y-1 text-sm">{pkg.external.map((x) => <li key={x.label}>{x.label}{x.description ? `: ${x.description}` : ""}</li>)}</ul></div> : null}
                </>
              ) : null}
            </section>
          ) : !isSeller ? (
            <section className="surface flex items-start gap-3 p-6 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-5 shrink-0" />
              <span>Everything else ({listing.kind === "idea" ? "the idea itself, how it works and how the seller estimated the earnings" : "the project, research, evidence and included assets"}) is hidden. Sign the NDA, then ask the seller for access or make an offer.</span>
            </section>
          ) : (
            <p className="surface p-6 text-sm text-muted-foreground">This is your listing. Buyers see only the niche, price and earning estimate until you grant access. <Link href={`/app/marketplace/sell/${listing.id}`} className="underline">Manage it</Link></p>
          )}
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <BuyerPanel
            listingId={listing.id}
            ndaText={NDA_TEXT}
            access={access}
            priceType={listing.priceType}
            priceLabel={formatMoney(listing.priceCents, listing.currency)}
            minPrice={row.min === null ? null : row.min / 100}
            maxPrice={row.max === null ? null : row.max / 100}
            currency={listing.currency}
            dealId={deal?.id ?? null}
            isSeller={isSeller}
          />
        </div>
      </div>
    </div>
  );
}
