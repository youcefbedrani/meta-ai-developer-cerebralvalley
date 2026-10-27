import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { fmtDate, fmtDay, fmtNum, Pill, Section, Stat, Table } from "@/components/admin/ui";
import { creditTotalsByReason, listSubscriptions, recentLedger } from "@/server/admin/platform";

export const metadata: Metadata = { title: "Billing · Admin" };

export default async function AdminBillingPage() {
  const [subs, ledger, totals] = await Promise.all([listSubscriptions(), recentLedger(50), creditTotalsByReason(30)]);
  const by = (r: string) => totals.find((t) => t.reason === r)?.total ?? 0;
  const used = -(by("reservation") + by("refund") + by("usage"));
  return (
    <div className="space-y-6">
      <PageHeader title="Billing & credits" description="Stripe subscriptions and the credit ledger. To give or remove credits, or change a plan, open the user." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Credits granted (30 days)" value={fmtNum(by("monthly_grant"))} hint="Monthly plan allowances" />
        <Stat label="Credits used (30 days)" value={fmtNum(used)} hint="After refunds" />
        <Stat label="Credits refunded (30 days)" value={fmtNum(by("refund"))} />
        <Stat label="Gifted / adjusted (30 days)" value={fmtNum(by("purchase") + by("adjustment"))} />
      </div>
      <Section title="Subscriptions" description="Synced from Stripe webhooks.">
        <Table head={["User", "Plan", "Status", "Renews", "Stripe id"]} empty={!subs.length}>
          {subs.map(({ sub, email, userId }) => (
            <tr key={sub.id}>
              <td><Link href={`/app/admin/users/${userId}`} className="underline-offset-4 hover:underline">{email}</Link></td>
              <td className="capitalize">{sub.plan}</td>
              <td><Pill tone={sub.status === "active" || sub.status === "trialing" ? "good" : "warn"}>{sub.status}</Pill>{sub.cancelAtPeriodEnd ? <span className="ml-1 text-xs text-muted-foreground">cancels</span> : null}</td>
              <td>{fmtDay(sub.currentPeriodEnd)}</td>
              <td className="font-mono text-xs">{sub.stripeSubscriptionId}</td>
            </tr>
          ))}
        </Table>
      </Section>
      <Section title="Credit ledger" description="Latest 50 entries across all users.">
        <Table head={["When (UTC)", "User", "Change", "Reason", "Note"]} empty={!ledger.length}>
          {ledger.map(({ row, email }) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap">{fmtDate(row.createdAt)}</td>
              <td><Link href={`/app/admin/users/${row.userId}`} className="underline-offset-4 hover:underline">{email}</Link></td>
              <td className={row.delta > 0 ? "tabular-nums text-emerald-700" : "tabular-nums"}>{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
              <td>{row.reason.replace("_", " ")}</td>
              <td className="text-xs text-muted-foreground">{row.note ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
