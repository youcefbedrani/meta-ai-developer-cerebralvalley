import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MockOnboardingButton } from "@/components/marketplace/mock-pay";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { paymentsMode } from "@/server/marketplace/config";
import { requireMarketplace } from "@/server/marketplace/guard";

export const metadata: Metadata = { title: "Test onboarding" };

export default async function MockOnboardingPage() {
  requireMarketplace();
  if (paymentsMode() !== "mock") notFound();
  await requireOnboardedUser();
  return (
    <div className="mx-auto max-w-md space-y-4 pt-8">
      <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><FlaskConical className="size-4" /> Test mode: this stands in for Stripe Connect onboarding (identity and bank details).</p>
      <section className="surface space-y-4 p-6">
        <p className="font-medium">Seller payout onboarding</p>
        <p className="text-sm text-muted-foreground">In production, Stripe collects identity and bank details here, and payouts unlock once it verifies them.</p>
        <MockOnboardingButton />
      </section>
    </div>
  );
}
