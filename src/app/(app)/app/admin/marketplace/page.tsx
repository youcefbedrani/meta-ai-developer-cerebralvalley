import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/app/page-header";
import { BanAction, DisputeActions, ReportActions, ReviewActions, UnpublishAction } from "@/components/marketplace/admin";
import { earningLabel, KIND_LABEL, LevelBadge } from "@/components/marketplace/shared";
import { formatMoney } from "@/lib/marketplace/terms";
import { getDb, schema } from "@/server/db/client";
import { parseTeaser } from "@/server/data/marketplace";
import { isMarketplaceEnabled } from "@/server/marketplace/config";
import { MarketplaceTables } from "./tables";

export const metadata: Metadata = { title: "Marketplace · Admin" };

const TABS = [
  ["queue", "Review queue"],
  ["listings", "All listings"],
  ["deals", "Deals"],
  ["payments", "Payments & payouts"],
] as const;

export default async function AdminMarketplacePage({ searchParams }: PageProps<"/app/admin/marketplace">) {
  if (!isMarketplaceEnabled()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Marketplace" description="The marketplace isn't deployed on this server. Set MARKETPLACE_ENABLED=true in the environment and restart to turn it on." />
      </div>
    );
  }
  const sp = await searchParams;
  const tab = TABS.find(([k]) => k === sp.tab)?.[0] ?? "queue";
  const header = (
    <>
      <PageHeader title="Marketplace" description="Review queue, every listing, deal and payment. Every action is written to the audit log." />
      <div className="flex flex-wrap gap-1">
        {TABS.map(([k, label]) => (
          <Link key={k} href={k === "queue" ? "/app/admin/marketplace" : `/app/admin/marketplace?tab=${k}`} className={`rounded-lg px-3 py-1.5 text-sm ${tab === k ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </Link>
        ))}
      </div>
    </>
  );
  if (tab !== "queue") {
    return (
      <div className="space-y-6">
        {header}
        <MarketplaceTables tab={tab} />
      </div>
    );
  }
  const db = getDb();
  const [pending, reports, disputes] = await Promise.all([
    db.select({ l: schema.listings, sellerEmail: schema.users.email, banned: schema.users.marketplaceBannedAt }).from(schema.listings).innerJoin(schema.users, eq(schema.users.id, schema.listings.sellerId)).where(eq(schema.listings.status, "pending_review")).orderBy(desc(schema.listings.updatedAt)),
    db.select({ r: schema.listingReports, title: schema.listings.title, listingStatus: schema.listings.status, sellerId: schema.listings.sellerId }).from(schema.listingReports).innerJoin(schema.listings, eq(schema.listings.id, schema.listingReports.listingId)).where(eq(schema.listingReports.status, "open")).orderBy(desc(schema.listingReports.createdAt)),
    db.select({ d: schema.disputes, deal: schema.deals, title: schema.listings.title }).from(schema.disputes).innerJoin(schema.deals, eq(schema.deals.id, schema.disputes.dealId)).innerJoin(schema.listings, eq(schema.listings.id, schema.deals.listingId)).where(eq(schema.disputes.status, "open")).orderBy(desc(schema.disputes.createdAt)),
  ]);
  const similarIds = pending.map((p) => p.l.similarity?.listingId).filter((x): x is string => !!x);
  const similar = similarIds.length ? await db.select({ id: schema.listings.id, title: schema.listings.title }).from(schema.listings).where(inArray(schema.listings.id, similarIds)) : [];

  return (
    <div className="space-y-6">
      {header}
      <section className="surface p-6">
        <h2 className="font-medium">Review queue ({pending.length})</h2>
        <ul className="mt-3 space-y-4">
          {pending.map(({ l, sellerEmail, banned }) => {
            const t = parseTeaser(l);
            const match = similar.find((s) => s.id === l.similarity?.listingId);
            return (
              <li key={l.id} className="rounded-xl border border-border bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p><Link href={`/app/admin/marketplace/listings/${l.id}`} className="font-medium underline-offset-4 hover:underline">{l.title}</Link> <span className="text-xs text-muted-foreground">({KIND_LABEL[l.kind]})</span></p>
                  <span className="flex items-center gap-2"><LevelBadge level={l.validationLevel} /> {formatMoney(l.priceCents, l.currency)} · {l.licenseType.replace("_", " ")}</span>
                </div>
                <p className="mt-1 text-sm"><span className="text-muted-foreground">Public:</span> {l.niche || "no niche"} · could make {earningLabel(l.earningMaxCents ? { minCents: l.earningMinCents ?? 0, maxCents: l.earningMaxCents } : null, l.currency)} (seller estimate)</p>
                {l.earningBasis ? <p className="text-xs text-muted-foreground">Estimate basis: {l.earningBasis}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">Seller: {sellerEmail} · ownership confirmed: {l.ownershipConfirmed ? "yes" : "no"} · original work: {l.originalWorkDeclared ? "yes" : "no"}</p>
                {t ? <p className="mt-2">{t.problem}</p> : null}
                {l.similarity ? <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Possible duplicate: {Math.round(l.similarity.score * 100)}% similar to “{match?.title ?? l.similarity.listingId}”.</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-2"><ReviewActions listingId={l.id} /><BanAction userId={l.sellerId} banned={!!banned} /></div>
              </li>
            );
          })}
          {!pending.length ? <li className="text-sm text-muted-foreground">Nothing to review.</li> : null}
        </ul>
      </section>
      <section className="surface p-6">
        <h2 className="font-medium">Reports ({reports.length})</h2>
        <ul className="mt-3 space-y-3">
          {reports.map(({ r, title, listingStatus, sellerId }) => (
            <li key={r.id} className="rounded-xl border border-border bg-white p-4 text-sm">
              <p><Link href={`/app/marketplace/${r.listingId}`} className="font-medium underline-offset-4 hover:underline">{title}</Link> <span className="text-xs text-muted-foreground">({listingStatus})</span></p>
              <p className="mt-1">{r.reason}</p>
              <div className="mt-2 flex flex-wrap gap-2">{listingStatus === "published" ? <UnpublishAction listingId={r.listingId} /> : null}<BanAction userId={sellerId} banned={false} /><ReportActions reportId={r.id} /></div>
            </li>
          ))}
          {!reports.length ? <li className="text-sm text-muted-foreground">No open reports.</li> : null}
        </ul>
      </section>
      <section className="surface p-6">
        <h2 className="font-medium">Disputes ({disputes.length})</h2>
        <ul className="mt-3 space-y-3">
          {disputes.map(({ d, deal, title }) => (
            <li key={d.id} className="rounded-xl border border-border bg-white p-4 text-sm">
              <p><Link href={`/app/marketplace/deals/${deal.id}`} className="font-medium underline-offset-4 hover:underline">{title}</Link> · {deal.amountCents ? formatMoney(deal.amountCents, deal.currency) : ""} · was {deal.stateBeforeDispute}</p>
              <p className="mt-1">{d.reason}</p>
              <div className="mt-2"><DisputeActions disputeId={d.id} canResume={deal.stateBeforeDispute === "TRANSFER_IN_PROGRESS" || deal.stateBeforeDispute === "PAYMENT_HELD"} /></div>
            </li>
          ))}
          {!disputes.length ? <li className="text-sm text-muted-foreground">No open disputes.</li> : null}
        </ul>
      </section>
    </div>
  );
}
