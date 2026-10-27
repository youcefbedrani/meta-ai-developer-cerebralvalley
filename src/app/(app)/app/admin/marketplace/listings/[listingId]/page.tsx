import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { DeleteListingButton, EditListingForm, RepublishButton, StopDealButton } from "@/components/admin/marketplace-controls";
import { fmtDate, Pill, Section, Stat, Table } from "@/components/admin/ui";
import { BanAction, ReviewActions, UnpublishAction } from "@/components/marketplace/admin";
import { earningLabel, KIND_LABEL, LevelBadge } from "@/components/marketplace/shared";
import { label as stateLabel } from "@/lib/marketplace/deal-machine";
import { formatMoney } from "@/lib/marketplace/terms";
import { ASSET_LABELS } from "@/lib/validation/marketplace";
import { getAdminListing } from "@/server/admin/marketplace";

export const metadata: Metadata = { title: "Listing · Admin" };

const PAID = ["PAYMENT_HELD", "TRANSFER_IN_PROGRESS"];
const OPEN = ["DRAFT_OFFER", "ACCEPTED", ...PAID];

/** Admin view of one listing: everything, including what buyers only see after access. */
export default async function AdminListingPage({ params }: PageProps<"/app/admin/marketplace/listings/[listingId]">) {
  const { listingId } = await params;
  const d = await getAdminListing(listingId);
  if (!d) notFound();
  const l = d.listing;
  const earning = l.earningMaxCents ? { minCents: l.earningMinCents ?? 0, maxCents: l.earningMaxCents } : null;

  return (
    <div className="space-y-6">
      <Link href="/app/admin/marketplace?tab=listings" className="text-sm text-muted-foreground hover:text-foreground">← All listings</Link>
      <PageHeader
        title={l.title}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <Pill tone={l.status === "published" ? "good" : l.status === "pending_review" ? "warn" : "muted"}>{l.status.replace("_", " ")}</Pill>
            <Pill tone="info">{KIND_LABEL[l.kind]}</Pill>
            {l.kind === "project" ? <LevelBadge level={l.validationLevel} /> : null}
            · seller <Link href={`/app/admin/users/${d.seller.id}`} className="underline">{d.seller.email}</Link>
            {d.seller.banned ? <Pill tone="bad">seller banned</Pill> : null}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Price" value={formatMoney(l.priceCents, l.currency)} hint={l.priceType === "fixed" ? "Fixed" : "Offers"} />
        <Stat label="Could make (seller)" value={<span className="text-lg">{earningLabel(earning, l.currency)}</span>} />
        <Stat label="Views / NDAs" value={`${d.views} / ${d.ndas}`} />
        <Stat label="Deals" value={d.deals.length} hint={`${d.deals.filter((x) => OPEN.includes(x.state)).length} open`} />
      </div>

      <Section title="Controls">
        <div className="flex flex-wrap items-center gap-2">
          {l.status === "pending_review" ? <ReviewActions listingId={l.id} /> : null}
          {l.status === "published" || l.status === "pending_review" ? <UnpublishAction listingId={l.id} /> : null}
          {l.status === "unpublished" ? <RepublishButton listingId={l.id} /> : null}
          <BanAction userId={d.seller.id} banned={d.seller.banned} />
          <DeleteListingButton listingId={l.id} />
        </div>
        {l.reviewNote ? <p className="mt-3 text-sm text-muted-foreground">Last review note: {l.reviewNote}</p> : null}
        {l.similarity ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Possible duplicate: {Math.round(l.similarity.score * 100)}% similar to <Link href={`/app/admin/marketplace/listings/${l.similarity.listingId}`} className="underline">another listing</Link>.</p> : null}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Public terms" description="The only things anyone sees before NDA + access.">
          <EditListingForm listingId={l.id} initial={{ niche: l.niche, price: l.priceCents / 100, earningMin: (l.earningMinCents ?? 0) / 100, earningMax: (l.earningMaxCents ?? 0) / 100 }} />
        </Section>
        <Section title="Hidden details" description="What buyers see after access.">
          <div className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">Selling:</span> {d.project ? <>project “{d.project.name}”</> : d.idea ? <>idea “{d.idea.title}”</> : "source no longer exists"} · {l.licenseType === "exclusive_transfer" ? "exclusive" : "non-exclusive"}</p>
            <p><span className="text-muted-foreground">How the seller estimated the earnings:</span> {l.earningBasis || "—"}</p>
            {d.teaser ? (
              <dl className="grid gap-2">
                {[["Problem", d.teaser.problem], ["Market", d.teaser.market], ["Solution", d.teaser.solution], ["Ideal buyer", d.teaser.idealBuyer]].map(([k, v]) => (
                  <div key={k}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            ) : <p className="text-muted-foreground">No details written yet.</p>}
            <p><span className="text-muted-foreground">Included:</span> {d.assets.map((a) => ASSET_LABELS[a.kind] + (a.description ? ` (${a.description})` : "")).join(" · ")}</p>
            <p className="text-xs text-muted-foreground">Ownership confirmed: {l.ownershipConfirmed ? "yes" : "no"} · original work declared: {l.originalWorkDeclared ? "yes" : "no"}{l.nonCompeteMonths ? ` · non-compete ${l.nonCompeteMonths} months` : ""}</p>
          </div>
        </Section>
      </div>

      <Section title="Deals">
        <Table head={["Buyer", "State", "Amount", "Updated", ""]} empty={!d.deals.length}>
          {d.deals.map((x) => (
            <tr key={x.id}>
              <td>{x.buyerEmail}</td>
              <td><Link href={`/app/marketplace/deals/${x.id}`} className="underline-offset-4 hover:underline">{stateLabel(x.state)}</Link></td>
              <td>{x.amountCents ? formatMoney(x.amountCents, x.currency) : "—"}</td>
              <td>{fmtDate(x.updatedAt)}</td>
              <td className="text-right">{OPEN.includes(x.state) ? <StopDealButton dealId={x.id} paid={PAID.includes(x.state)} /> : null}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Access requests">
          <ul className="divide-y divide-border text-sm">
            {d.access.map((a) => <li key={a.id} className="flex justify-between py-2"><span>{a.buyerEmail}</span><span className="text-xs text-muted-foreground">{a.status} · {fmtDate(a.createdAt)}</span></li>)}
            {!d.access.length ? <li className="py-2 text-muted-foreground">None.</li> : null}
          </ul>
        </Section>
        <Section title="History">
          <ul className="divide-y divide-border text-sm">
            {d.events.map((e) => <li key={e.id} className="flex justify-between gap-2 py-2"><span>{e.action}{e.toState ? ` → ${e.toState}` : ""} <span className="text-xs text-muted-foreground">({e.actorRole})</span></span><span className="text-xs text-muted-foreground">{fmtDate(e.createdAt)}</span></li>)}
          </ul>
        </Section>
      </div>
    </div>
  );
}
