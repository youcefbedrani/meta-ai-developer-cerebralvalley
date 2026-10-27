import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfigErrorNotice } from "@/components/config-error";
import { PageHeader } from "@/components/app/page-header";
import { MarketMap } from "@/components/gold-mine/market-map";
import { GoldMineStepper } from "@/components/gold-mine/stepper";
import { getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { MAX_MARKET_DEPTH } from "@/lib/validation/gold-mine";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getMarketMap } from "@/server/data/gold-mine";

export const metadata: Metadata = { title: "Market map" };

export default async function MarketMapPage() {
  const user = await requireOnboardedUser();
  const tree = await getMarketMap(user.id);
  const ai = getIntegrationStatus("ai");
  return (
    <div className="space-y-6">
      <Link href="/app/gold-mine" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Gold Mine</Link>
      <GoldMineStepper sessionId="" current="market" viewing="market" mode="market" />
      <PageHeader title="Market map" description="Start broad and drill down. Each click expands one level, personalised to your skills and interests. Choose a specific niche to check its demand." />
      {!ai.configured ? <ConfigErrorNotice title="AI provider is not configured" missing={ai.missing} /> : null}
      <MarketMap nodes={tree.nodes} cost={CREDIT_COSTS.market_expand} maxDepth={MAX_MARKET_DEPTH} disabled={!ai.configured} />
    </div>
  );
}
