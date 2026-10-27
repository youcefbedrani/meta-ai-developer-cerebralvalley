"use client";

import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { connectOnboardingAction, syncConnectAction } from "@/app/(app)/app/marketplace/actions";
import { Button } from "@/components/ui/button";
import { useRun } from "./use-run";

export function ConnectButtons({ onboarded }: { onboarded: boolean }) {
  const { run, pending, router } = useRun();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={onboarded ? "outline" : "gradient"} className="h-10" disabled={pending} onClick={() => run(() => connectOnboardingAction(), undefined, (d) => (d.url.startsWith("/") ? router.push(d.url) : window.location.assign(d.url)))}>
        {pending ? <Loader2 className="animate-spin" /> : <ExternalLink />} {onboarded ? "Update payout details" : "Set up payouts with Stripe"}
      </Button>
      <Button variant="ghost" className="h-10" disabled={pending} onClick={() => run(() => syncConnectAction(), "Status refreshed")}><RefreshCw /> Refresh status</Button>
    </div>
  );
}
