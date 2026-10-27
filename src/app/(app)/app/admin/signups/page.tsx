import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { DailyBars, fmtDate, Pill, Section, Stat, Table } from "@/components/admin/ui";
import { getOverview, signupsByDay } from "@/server/admin/metrics";
import { getDb, schema } from "@/server/db/client";
import { getPlatformSettings } from "@/server/platform/settings";

export const metadata: Metadata = { title: "Sign-ups · Admin" };

export default async function AdminSignupsPage() {
  const [settings, daily, o, recent] = await Promise.all([
    getPlatformSettings(),
    signupsByDay(30),
    getOverview(),
    getDb()
      .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, createdAt: schema.users.createdAt, onboardedAt: schema.users.onboardedAt, suspendedAt: schema.users.suspendedAt })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(15),
  ]);
  const today = daily.at(-1)?.count ?? 0;
  return (
    <div className="space-y-6">
      <PageHeader title="Sign-ups" description="Control who can create a Startum account and watch new accounts come in." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Mode" value={<span className="capitalize">{settings.signups.mode.replace("_", "-")}</span>} />
        <Stat label="Today (UTC)" value={today} />
        <Stat label="Last 7 days" value={o.users.last7d} />
        <Stat label="Last 30 days" value={o.users.last30d} />
      </div>
      <Section title="Sign-up rules" description="Checked on the server when a new account first signs in. Emails listed in ADMIN_EMAILS can always join.">
        <SettingsForm initial={settings} section="signups" />
      </Section>
      <Section title="New accounts per day" description="Last 30 days, UTC.">
        <DailyBars data={daily} label="New accounts per day" />
      </Section>
      <Section title="Latest accounts" actions={<Link href="/app/admin/users" className="text-sm text-primary hover:underline">All users</Link>}>
        <Table head={["Email", "Name", "Joined (UTC)", "Status"]} empty={!recent.length}>
          {recent.map((u) => (
            <tr key={u.id}>
              <td><Link href={`/app/admin/users/${u.id}`} className="font-medium underline-offset-4 hover:underline">{u.email}</Link></td>
              <td>{u.name ?? "—"}</td>
              <td className="whitespace-nowrap">{fmtDate(u.createdAt)}</td>
              <td>{u.suspendedAt ? <Pill tone="bad">Suspended</Pill> : u.onboardedAt ? <Pill tone="good">Onboarded</Pill> : <Pill tone="warn">Not onboarded</Pill>}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
