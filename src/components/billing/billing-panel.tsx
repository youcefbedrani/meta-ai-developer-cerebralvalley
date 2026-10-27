"use client";

import { Coins, CreditCard, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { buyCreditsAction, checkoutAction, portalAction } from "@/app/(app)/app/(founder)/settings/actions";
import type { CreditPackId } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Plan = { id: "free" | "founder" | "studio"; name: string; price: number; credits: number; features: readonly string[] };

export function BillingPanel({
  plans,
  currentPlan,
  subscription,
  stripeConfigured,
  packs,
}: {
  plans: Plan[];
  currentPlan: Plan["id"];
  subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  stripeConfigured: boolean;
  packs: readonly { id: CreditPackId; credits: number; priceUsd: number; label: string }[];
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const go = (key: string, fn: () => Promise<{ ok: boolean; error?: string } | undefined>) => {
    setBusy(key);
    setError(null);
    start(async () => {
      const r = await fn();
      if (r && !r.ok) setError(r.error ?? "Something went wrong");
      setBusy(null);
    });
  };
  const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

  return (
    <div className="space-y-4">
      {subscription ? (
        <p className="text-sm text-muted-foreground">
          Subscription <span className="capitalize text-foreground">{subscription.status.replace("_", " ")}</span>
          {subscription.currentPeriodEnd ? <> · {subscription.cancelAtPeriodEnd ? "ends" : "renews"} {fmt.format(new Date(subscription.currentPeriodEnd))}</> : null}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => {
          const current = p.id === currentPlan;
          return (
            <div key={p.id} className={cn("rounded-xl border border-border p-4", current && "border-primary/60 bg-primary/5")}>
              <div className="flex items-center justify-between">
                <p className="font-medium">{p.name}</p>
                {current ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Current</span> : null}
              </div>
              <p className="mt-1 text-2xl font-semibold">
                ${p.price}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="text-xs text-muted-foreground">{p.credits} AI credits / month</p>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {p.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              {p.id !== "free" && !current && currentPlan === "free" ? (
                <Button variant="gradient" className="mt-4 h-9 w-full" disabled={!stripeConfigured || pending} onClick={() => go(p.id, () => checkoutAction(p.id as "founder" | "studio"))}>
                  {busy === p.id ? <Loader2 className="animate-spin" /> : null} Upgrade to {p.name}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border border-border p-4">
        <p className="flex items-center gap-2 font-medium"><Coins className="size-4 text-primary" /> Need more credits this month?</p>
        <p className="mt-1 text-sm text-muted-foreground">Buy a one-time pack on any plan. Pack credits never expire.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {packs.map((p) => (
            <Button key={p.id} variant="outline" className="h-9 rounded-[10px]" disabled={!stripeConfigured || pending} onClick={() => go(p.id, () => buyCreditsAction(p.id))}>
              {busy === p.id ? <Loader2 className="animate-spin" /> : null} {p.credits.toLocaleString("en")} credits · ${p.priceUsd}
              <span className="text-xs text-muted-foreground">{p.label}</span>
            </Button>
          ))}
        </div>
      </div>
      {currentPlan !== "free" || subscription ? (
        <Button variant="outline" className="rounded-[10px]" disabled={!stripeConfigured || pending} onClick={() => go("portal", portalAction)}>
          {busy === "portal" ? <Loader2 className="animate-spin" /> : <CreditCard />} Manage billing, invoices & cancellation
        </Button>
      ) : null}
      {!stripeConfigured ? <p className="text-xs text-muted-foreground">Billing isn&apos;t enabled yet, so everyone is on the Free plan for now.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
