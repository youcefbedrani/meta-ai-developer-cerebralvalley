"use client";

import { Loader2 } from "lucide-react";
import { mockOnboardingAction, mockPayAction } from "@/app/(app)/app/marketplace/actions";
import { Button } from "@/components/ui/button";
import { useRun } from "./use-run";

export function MockPayButton({ dealId, sessionId, label }: { dealId: string; sessionId: string; label: string }) {
  const { run, pending, router } = useRun();
  return (
    <Button variant="gradient" className="h-11 w-full" disabled={pending} onClick={() => run(() => mockPayAction(dealId, sessionId), "Payment received (test mode)", () => router.push(`/app/marketplace/deals/${dealId}`))}>
      {pending ? <Loader2 className="animate-spin" /> : null} Pay {label} (test mode)
    </Button>
  );
}

export function MockOnboardingButton() {
  const { run, pending, router } = useRun();
  return (
    <Button variant="gradient" className="h-11" disabled={pending} onClick={() => run(() => mockOnboardingAction(), "Payouts enabled (test mode)", () => router.push("/app/marketplace/payouts"))}>
      {pending ? <Loader2 className="animate-spin" /> : null} Complete onboarding (test mode)
    </Button>
  );
}
