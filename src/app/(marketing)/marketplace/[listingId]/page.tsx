import { Lock, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/landing/marketing-page";
import { earningLabel, KIND_LABEL, ProofRow } from "@/components/marketplace/shared";
import { formatMoney } from "@/lib/marketplace/terms";
import { clientIp } from "@/server/client-ip";
import { getPublicListing, logListingView } from "@/server/data/marketplace";
import { requireMarketplace } from "@/server/marketplace/guard";
import "../../landing.css";

export const metadata: Metadata = { title: "Listing" };
export const dynamic = "force-dynamic";

/** Public page: niche, earning estimate and price only. */
export default async function PublicListingPage({ params }: PageProps<"/marketplace/[listingId]">) {
  requireMarketplace();
  const { listingId } = await params;
  const l = await getPublicListing(listingId);
  if (!l) notFound();
  await logListingView(l.id, null, "teaser", clientIp(new Request("http://local", { headers: await headers() })));
  return (
    <MarketingPage>
      <section className="pad">
        <div className="mx-auto max-w-2xl space-y-6 px-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-border px-2 py-0.5">{KIND_LABEL[l.kind]}</span>
            <span className="rounded-full border border-border px-2 py-0.5">{l.licenseType === "exclusive_transfer" ? "Exclusive" : "Non-exclusive copy"}</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider opacity-60">Niche</p>
            <h1 className="h2" style={{ textAlign: "left" }}>{l.niche}</h1>
          </div>
          <div className="card p-5">
            <p className="flex items-center gap-1.5 text-xs opacity-70"><TrendingUp className="size-3.5" /> Could make (seller&apos;s estimate, not verified)</p>
            <p className="mt-1 text-2xl font-semibold">{earningLabel(l.earning, l.currency)}</p>
            <ProofRow proof={l.proof} className="mt-3" />
          </div>
          <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl font-semibold">{formatMoney(l.priceCents, l.currency)}</p>
              <p className="text-xs opacity-70">{l.priceType === "fixed" ? "Fixed price" : "Asking price · offers welcome"} · payment held until transfer is confirmed</p>
            </div>
            <Link href={`/app/marketplace/${l.id}`} className="btn btn-dark" style={{ paddingRight: 18 }}><Lock className="size-4" /> Sign in to unlock the details</Link>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
