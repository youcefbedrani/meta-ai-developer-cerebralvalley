import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { DailyBars, fmtDate, fmtNum, fmtUsd, Pill, Section, Stat } from "@/components/admin/ui";
import { formatMoney } from "@/lib/marketplace/terms";
import { MODULES } from "@/lib/platform-settings";
import { listAdminAudit } from "@/server/admin/audit";
import { getOverview, signupsByDay } from "@/server/admin/metrics";
import { isMarketplaceEnabled } from "@/server/marketplace/config";
import { getPlatformSettings } from "@/server/platform/settings";

export const metadata: Metadata = { title: "Admin console" };

export default async function AdminOverviewPage() {
  const [o, daily, settings, audit] = await Promise.all([getOverview(), signupsByDay(30), getPlatformSettings(), listAdminAudit({ limit: 8 })]);
  const offModules = MODULES.filter((m) => settings.modules[m.key] === false);
  const marketplace = isMarketplaceEnabled();
  const queue = o.marketplace.pending + o.marketplace.openReports + o.marketplace.openDisputes;

  return (
    <div className="space-y-6">
      <PageHeader title="Admin console" description="Everything running on Startum: users, sign-ups, projects, AI jobs, billing and the marketplace. All numbers are counted from live data." />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/app/admin/signups"><Pill tone={settings.signups.mode === "open" ? "good" : "warn"}>Sign-ups: {settings.signups.mode.replace("_", "-")}</Pill></Link>
        {settings.maintenance.enabled ? <Pill tone="bad">Maintenance mode on</Pill> : null}
        {settings.aiPaused ? <Pill tone="bad">AI paused</Pill> : null}
        {settings.announcement.enabled ? <Pill tone="info">Announcement live</Pill> : null}
        {offModules.length ? <Link href="/app/admin/settings"><Pill tone="warn">Off: {offModules.map((m) => m.label).join(", ")}</Pill></Link> : <Pill tone="good">All modules on</Pill>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Users" value={fmtNum(o.users.total)} hint={`+${o.users.last7d} this week · +${o.users.last30d} in 30 days`} href="/app/admin/users" />
        <Stat label="Active (7 days)" value={fmtNum(o.users.active7d)} hint="Used at least one AI feature" />
        <Stat label="Finished onboarding" value={o.users.total ? `${Math.round((o.users.onboarded / o.users.total) * 100)}%` : "—"} hint={`${o.users.onboarded} of ${o.users.total}`} href="/app/admin/users?status=not_onboarded" />
        <Stat label="Suspended" value={fmtNum(o.users.suspended)} href="/app/admin/users?status=suspended" tone={o.users.suspended ? "warn" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="New accounts per day" description="Last 30 days, UTC.">
            <DailyBars data={daily} label="New accounts per day" />
          </Section>
        </div>
        <Section title="Plans">
          <ul className="space-y-2 text-sm">
            {(["free", "founder", "studio"] as const).map((p) => (
              <li key={p} className="flex items-center justify-between">
                <Link href={`/app/admin/users?plan=${p}`} className="capitalize underline-offset-4 hover:underline">{p}</Link>
                <span className="tabular-nums">{fmtNum(o.plans[p])}</span>
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-border pt-2 text-muted-foreground">
              <span>Active Stripe subscriptions</span>
              <span className="tabular-nums">{o.plans.activeSubscriptions}</span>
            </li>
          </ul>
        </Section>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Projects" value={fmtNum(o.projects.total)} hint={`+${o.projects.last30d} in 30 days`} href="/app/admin/projects" />
        <Stat label="Waitlist sign-ups" value={fmtNum(o.projects.waitlistSignups)} hint={`${o.projects.pagesPublished} published landing pages`} />
        <Stat label="Research jobs (30 days)" value={fmtNum(o.jobs.last30d)} hint={`${o.jobs.failed30d} failed · ${o.jobs.active} running now`} href="/app/admin/jobs" tone={o.jobs.failed30d ? "warn" : undefined} />
        <Stat label="AI cost (30 days)" value={fmtUsd(o.ai.costUsd30d)} hint={`${fmtNum(o.ai.calls30d)} calls · ${o.ai.errors30d} errors · ${fmtNum(o.ai.creditsUsed30d)} credits used`} href="/app/admin/jobs" />
      </div>

      {marketplace ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Needs review" value={fmtNum(queue)} hint={`${o.marketplace.pending} listings · ${o.marketplace.openReports} reports · ${o.marketplace.openDisputes} disputes`} href="/app/admin/marketplace" tone={queue ? "warn" : undefined} />
          <Stat label="Live listings" value={fmtNum(o.marketplace.published)} href="/app/admin/marketplace?tab=listings" />
          <Stat label="Open deals" value={fmtNum(o.marketplace.openDeals)} href="/app/admin/marketplace?tab=deals" />
          <Stat label="Sales / platform fees" value={formatMoney(o.marketplace.gmvCents, "usd")} hint={`${formatMoney(o.marketplace.feesCents, "usd")} in fees`} href="/app/admin/marketplace?tab=payments" />
        </div>
      ) : null}

      <Section title="Recent admin activity" actions={<Link href="/app/admin/audit" className="text-sm text-primary underline-offset-4 hover:underline">Full audit log</Link>}>
        <ul className="divide-y divide-border text-sm">
          {audit.map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span><span className="font-medium">{a.action}</span> <span className="text-muted-foreground">by {a.actorEmail}</span></span>
              <span className="text-xs text-muted-foreground">{fmtDate(a.createdAt)} UTC</span>
            </li>
          ))}
          {!audit.length ? <li className="py-2 text-muted-foreground">No admin actions yet.</li> : null}
        </ul>
      </Section>
    </div>
  );
}
