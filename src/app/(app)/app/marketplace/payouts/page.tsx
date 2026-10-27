import { CheckCircle2, Clock } from "lucide-react";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/app/page-header";
import { ConnectButtons } from "@/components/marketplace/payouts";
import { MarketplaceNav } from "@/components/marketplace/shared";
import { formatMoney } from "@/lib/marketplace/terms";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getDb, schema } from "@/server/db/client";
import { paymentsMode } from "@/server/marketplace/config";
import { getPlatformSettings } from "@/server/platform/settings";
import { requireMarketplace } from "@/server/marketplace/guard";
import { getConnectAccount } from "@/server/marketplace/payments";

export const metadata: Metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  requireMarketplace();
  const user = await requireOnboardedUser();
  const [account, payouts] = await Promise.all([getConnectAccount(user.id), getDb().select().from(schema.payouts).where(eq(schema.payouts.sellerId, user.id)).orderBy(desc(schema.payouts.createdAt))]);
  let mode: string;
  try {
    mode = paymentsMode();
  } catch {
    mode = "unconfigured";
  }
  const { feePercent, autoConfirmDays } = (await getPlatformSettings()).marketplace;
  return (
    <div className="space-y-6">
      <PageHeader title="Payouts" description={`Sellers are paid through Stripe Connect. Payment is held until the buyer confirms the transfer (or ${autoConfirmDays} days pass without a dispute), then paid out minus the ${feePercent}% platform fee.`} />
      <MarketplaceNav active="payouts" />
      <section className="surface space-y-4 p-6">
        {mode === "mock" ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Test mode: onboarding and payouts are simulated.</p> : null}
        {mode === "unconfigured" ? <p className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">Stripe isn&apos;t configured on this server (STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET).</p> : null}
        <div className="flex items-center gap-3">
          {account?.payoutsEnabled ? <CheckCircle2 className="size-6 text-emerald-600" /> : <Clock className="size-6 text-muted-foreground" />}
          <div>
            <p className="font-medium">{account?.payoutsEnabled ? "Payouts enabled" : account ? "Onboarding not finished" : "Not set up"}</p>
            <p className="text-sm text-muted-foreground">{account?.payoutsEnabled ? "Your payouts are released automatically when deals complete." : "Payouts stay blocked until Stripe has verified your identity and bank details."}</p>
          </div>
        </div>
        {mode !== "unconfigured" ? <ConnectButtons onboarded={!!account?.payoutsEnabled} /> : null}
      </section>
      <section className="surface p-6">
        <h2 className="font-medium">Your payouts</h2>
        {payouts.length ? (
          <ul className="mt-3 divide-y divide-border text-sm">
            {payouts.map((p) => <li key={p.id} className="flex justify-between py-2"><span>{formatMoney(p.amountCents, p.currency)} · {p.createdAt.toISOString().slice(0, 10)}</span><span className="capitalize">{p.status}{p.note ? ` · ${p.note}` : ""}</span></li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-muted-foreground">No payouts yet.</p>}
      </section>
    </div>
  );
}
