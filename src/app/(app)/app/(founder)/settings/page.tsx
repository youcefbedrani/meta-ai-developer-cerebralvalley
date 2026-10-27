import { CheckCircle2, CircleAlert, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getAllIntegrationStatuses, getEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import {
  BUDGETS,
  BUSINESS_MODELS,
  GOALS,
  TECHNICAL_LEVELS,
  TIME_COMMITMENTS,
} from "@/lib/validation/onboarding";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getProfile } from "@/server/data/profiles";
import { getCreditSummary } from "@/server/billing/credits";
import { listAiUsage } from "@/server/data/usage";
import { BillingPanel } from "@/components/billing/billing-panel";
import { getIntegrationStatus } from "@/lib/env";
import { CREDIT_PACKS, PLANS } from "@/lib/plans";
import { getPlatformSettings } from "@/server/platform/settings";
import { getSubscription } from "@/server/billing/subscriptions";

export const metadata: Metadata = { title: "Settings" };

const label = (list: readonly { value: string; label: string }[], v?: string) => list.find((o) => o.value === v)?.label ?? "—";

export default async function SettingsPage({ searchParams }: PageProps<"/app/settings">) {
  const user = await requireOnboardedUser();
  const billing = (await searchParams).billing;
  const [profile, credits, usage, subscription, settings] = await Promise.all([getProfile(user.id), getCreditSummary(user.id), listAiUsage(user.id), getSubscription(user.id), getPlatformSettings()]);
  const showConfig = getEnv().NODE_ENV !== "production";
  const integrations = showConfig ? getAllIntegrationStatuses() : [];

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Your account, founder profile and plan." />

      <section className="surface p-6">
        <h2 className="font-medium">Account</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <Item term="Name" value={user.name || "—"} />
          <Item term="Email" value={user.email} />
          <Item term="Plan" value={<span className="capitalize">{user.plan}</span>} />
        </dl>
      </section>

      <section className="surface p-6" id="billing">
        <h2 className="font-medium">Plan & billing</h2>
        {billing === "success" || billing === "credits" ? (
          <p role="status" className="mt-3 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm">
            {billing === "credits" ? "Payment received. Your credits are added as soon as Stripe confirms it, usually within a few seconds." : "Thanks! Your plan updates as soon as Stripe confirms the payment."}
          </p>
        ) : null}
        <div className="mt-4">
          <BillingPanel
            plans={PLANS.map((p) => ({ id: p.id, name: p.name, price: p.priceMonthly, credits: settings.monthlyCredits[p.id], features: p.features }))}
            currentPlan={user.plan}
            subscription={subscription ? { status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd } : null}
            stripeConfigured={getIntegrationStatus("stripe").configured}
            packs={CREDIT_PACKS}
          />
        </div>
      </section>

      <section className="surface p-6" id="usage">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-medium">AI credits</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {credits.monthlyAllowance} credits each month on the <span className="capitalize">{credits.plan}</span> plan. Credits are reserved before an AI action and refunded if it fails.
            </p>
          </div>
          <p className="text-2xl font-semibold tracking-tight">
            {credits.balance}
            <span className="ml-1 text-sm font-normal text-muted-foreground">left this month</span>
          </p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="bar-grow h-full rounded-full bg-brand-gradient" style={{ width: `${Math.min(100, (credits.usedThisMonth / Math.max(1, credits.monthlyAllowance)) * 100)}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{credits.usedThisMonth} used this month</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Credit history</h3>
            <ul className="mt-2 divide-y divide-border text-sm">
              {credits.recent.length ? credits.recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="capitalize">{e.reason.replace("_", " ")}</span>
                    {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
                  </span>
                  <span className={cn("shrink-0 font-mono text-xs", e.delta > 0 ? "text-success" : "text-muted-foreground")}>
                    {e.delta > 0 ? "+" : ""}{e.delta}
                  </span>
                </li>
              )) : <li className="py-2 text-muted-foreground">No activity yet.</li>}
            </ul>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Recent AI calls</h3>
            <ul className="mt-2 divide-y divide-border text-sm">
              {usage.length ? usage.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    {u.operation.replaceAll("_", " ")}
                    <span className="text-muted-foreground"> · {u.model}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {u.status !== "success" ? <span className="text-destructive">{u.status} · </span> : null}
                    {u.tokensIn + u.tokensOut} tok{u.estimatedCostUsd ? ` · $${Number(u.estimatedCostUsd).toFixed(4)}` : ""}
                  </span>
                </li>
              )) : <li className="py-2 text-muted-foreground">No AI calls yet.</li>}
            </ul>
          </div>
        </div>
      </section>

      <section className="surface p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-medium">Founder profile</h2>
          <Link href="/onboarding" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-[10px]")}>
            <Pencil /> Edit
          </Link>
        </div>
        {profile ? (
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <Item term="Skills" value={profile.skills.join(", ")} />
            <Item term="Technical level" value={label(TECHNICAL_LEVELS, profile.technicalLevel)} />
            <Item term="Interests" value={profile.interests.join(", ")} />
            <Item term="Target markets" value={profile.targetMarkets.join(", ") || "—"} />
            <Item term="Budget" value={label(BUDGETS, profile.budget)} />
            <Item term="Time" value={label(TIME_COMMITMENTS, profile.timePerWeek)} />
            <Item term="Business models" value={profile.businessModels.map((m) => label(BUSINESS_MODELS, m)).join(", ")} />
            <Item term="Goals" value={profile.goals.map((g) => label(GOALS, g)).join(", ")} />
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No profile saved.</p>
        )}
      </section>

      {showConfig ? (
        <section className="surface p-6">
          <h2 className="font-medium">Integrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">Development only: which services are configured in your environment.</p>
          <ul className="mt-4 divide-y divide-border text-sm">
            {integrations.map((i) => (
              <li key={i.name} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2">
                  {i.configured ? <CheckCircle2 className="size-4 text-success" /> : <CircleAlert className="size-4 text-warning" />}
                  {i.label}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {i.configured ? "configured" : `missing: ${i.missing.join(", ")}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Item({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{term}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
