import Link from "next/link";
import { fmtDate, fmtDay, Pill, Section, Table } from "@/components/admin/ui";
import { StopDealButton } from "@/components/admin/marketplace-controls";
import { UnpublishAction } from "@/components/marketplace/admin";
import { earningLabel, KIND_LABEL } from "@/components/marketplace/shared";
import { formatMoney } from "@/lib/marketplace/terms";
import { listAllDeals, listAllListings, listPaymentsAndPayouts } from "@/server/admin/platform";

const stateTone = (s: string) => (s === "PAID_OUT" ? "good" : s === "DISPUTED" || s === "REFUNDED" ? "bad" : s === "CANCELLED" ? "muted" : "info") as "good" | "bad" | "muted" | "info";

export async function MarketplaceTables({ tab }: { tab: "listings" | "deals" | "payments" }) {
  if (tab === "listings") {
    const rows = await listAllListings();
    return (
      <Section title={`Listings (${rows.length})`}>
        <Table head={["Listing", "Niche", "Seller", "Status", "Could make", "Price", "Updated", ""]} empty={!rows.length}>
          {rows.map((l) => (
            <tr key={l.id}>
              <td>
                <Link href={`/app/admin/marketplace/listings/${l.id}`} className="font-medium underline-offset-4 hover:underline">{l.title}</Link>
                <p className="text-xs text-muted-foreground">{KIND_LABEL[l.kind]}</p>
              </td>
              <td className="max-w-44">{l.niche || "—"}</td>
              <td><Link href={`/app/admin/users/${l.sellerId}`} className="underline-offset-4 hover:underline">{l.sellerEmail}</Link></td>
              <td><Pill tone={l.status === "published" ? "good" : l.status === "pending_review" ? "warn" : "muted"}>{l.status.replace("_", " ")}</Pill></td>
              <td className="whitespace-nowrap text-xs">{earningLabel(l.earningMaxCents ? { minCents: l.earningMinCents ?? 0, maxCents: l.earningMaxCents } : null, l.currency)}</td>
              <td className="whitespace-nowrap">{formatMoney(l.priceCents, l.currency)} · {l.licenseType.replace("_", " ").toLowerCase()}</td>
              <td>{fmtDay(l.updatedAt)}</td>
              <td className="text-right">{l.status === "published" ? <UnpublishAction listingId={l.id} /> : null}</td>
            </tr>
          ))}
        </Table>
      </Section>
    );
  }
  if (tab === "deals") {
    const rows = await listAllDeals();
    return (
      <Section title={`Deals (${rows.length})`}>
        <Table head={["Listing", "Seller → Buyer", "State", "Amount", "Fee", "Updated", ""]} empty={!rows.length}>
          {rows.map((d) => (
            <tr key={d.id}>
              <td>
                <Link href={`/app/marketplace/deals/${d.id}`} className="font-medium underline-offset-4 hover:underline">{d.title}</Link>
                <p><Link href={`/app/admin/marketplace/listings/${d.listingId}`} className="text-xs text-muted-foreground hover:underline">listing details</Link></p>
              </td>
              <td className="text-xs">{d.seller} → {d.buyer}</td>
              <td><Pill tone={stateTone(d.state)}>{d.state}</Pill></td>
              <td>{d.amountCents ? formatMoney(d.amountCents, d.currency) : "—"}</td>
              <td>{d.feeCents ? formatMoney(d.feeCents, d.currency) : "—"}</td>
              <td>{fmtDay(d.updatedAt)}</td>
              <td className="text-right">{["DRAFT_OFFER", "ACCEPTED", "PAYMENT_HELD", "TRANSFER_IN_PROGRESS"].includes(d.state) ? <StopDealButton dealId={d.id} paid={d.state === "PAYMENT_HELD" || d.state === "TRANSFER_IN_PROGRESS"} /> : null}</td>
            </tr>
          ))}
        </Table>
      </Section>
    );
  }
  const { payments, payouts } = await listPaymentsAndPayouts();
  return (
    <div className="space-y-6">
      <Section title="Buyer payments" description="Held by the platform until the buyer confirms.">
        <Table head={["When (UTC)", "Listing", "Amount", "Fee", "Status", "Stripe ref"]} empty={!payments.length}>
          {payments.map(({ p, title }) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap">{fmtDate(p.createdAt)}</td>
              <td><Link href={`/app/marketplace/deals/${p.dealId}`} className="underline-offset-4 hover:underline">{title}</Link></td>
              <td>{formatMoney(p.amountCents, p.currency)}</td>
              <td>{formatMoney(p.feeCents, p.currency)}</td>
              <td><Pill tone={p.status === "succeeded" ? "good" : p.status === "refunded" || p.status === "failed" ? "bad" : "muted"}>{p.status}</Pill></td>
              <td className="font-mono text-[11px]">{p.paymentIntentId ?? p.checkoutSessionId}</td>
            </tr>
          ))}
        </Table>
      </Section>
      <Section title="Seller payouts" description="Blocked until the seller finishes Stripe onboarding.">
        <Table head={["When (UTC)", "Seller", "Amount", "Status"]} empty={!payouts.length}>
          {payouts.map(({ p, email }) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap">{fmtDate(p.createdAt)}</td>
              <td><Link href={`/app/admin/users/${p.sellerId}`} className="underline-offset-4 hover:underline">{email}</Link></td>
              <td>{formatMoney(p.amountCents, p.currency)}</td>
              <td><Pill tone={p.status === "paid" ? "good" : p.status === "failed" ? "bad" : "warn"}>{p.status}</Pill></td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
