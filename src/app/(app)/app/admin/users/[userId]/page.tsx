import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { AccessControls, CreditControls, PlanRoleControls } from "@/components/admin/user-controls";
import { fmtDate, fmtDay, fmtUsd, Pill, Section, Stat, Table } from "@/components/admin/ui";
import { formatMoney } from "@/lib/marketplace/terms";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getUserDetail } from "@/server/admin/users";
import { FounderProfileView } from "@/components/profile/founder-profile";
import { getFounderData } from "@/server/data/founder-data";
import { unsafeToUserId } from "@/server/data/user-id";
import { isMarketplaceEnabled } from "@/server/marketplace/config";

export const metadata: Metadata = { title: "User · Admin" };

export default async function AdminUserPage({ params }: PageProps<"/app/admin/users/[userId]">) {
  const { userId } = await params;
  const [me, d] = await Promise.all([requireOnboardedUser(), getUserDetail(userId)]);
  if (!d) notFound();
  const founder = await getFounderData(unsafeToUserId(d.user.id));
  const { user } = d;
  const target = {
    id: user.id,
    email: user.email,
    plan: user.plan,
    role: user.role,
    suspended: !!user.suspendedAt,
    banned: !!user.marketplaceBannedAt,
    isSelf: user.id === me.id,
    envAdmin: d.envAdmin,
    marketplace: isMarketplaceEnabled(),
  };

  return (
    <div className="space-y-6">
      <Link href="/app/admin/users" className="text-sm text-muted-foreground hover:text-foreground">← All users</Link>
      <PageHeader
        title={user.name || user.email}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            {user.email} · joined {fmtDay(user.createdAt)}
            {user.suspendedAt ? <Pill tone="bad">Suspended {fmtDay(user.suspendedAt)}{user.suspendedReason ? `: ${user.suspendedReason}` : ""}</Pill> : <Pill tone="good">Active</Pill>}
            {d.envAdmin ? <Pill tone="info">Admin</Pill> : null}
            {!user.onboardedAt ? <Pill tone="warn">Not onboarded</Pill> : null}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Credit balance" value={d.balance} hint={`${user.plan} plan`} />
        <Stat label="Projects" value={d.projects.length} />
        <Stat label="AI calls" value={d.ai.calls} hint={`${d.ai.errors} errors · last ${fmtDay(d.ai.last)}`} />
        <Stat label="AI cost (all time)" value={fmtUsd(Number(d.ai.cost))} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Plan & role">
          <PlanRoleControls user={target} />
          {d.subscription ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Stripe subscription: {d.subscription.plan} · {d.subscription.status}
              {d.subscription.currentPeriodEnd ? ` · renews ${fmtDay(d.subscription.currentPeriodEnd)}` : ""}
              {d.subscription.cancelAtPeriodEnd ? " · cancels at period end" : ""}
            </p>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">No Stripe subscription.</p>
          )}
        </Section>
        <Section title="Access">
          <AccessControls user={target} />
        </Section>
      </div>

      <Section title="Credits" description="Every change is a row in the credit ledger.">
        <CreditControls userId={user.id} />
        <div className="mt-5">
          <Table head={["When (UTC)", "Change", "Reason", "Note"]} empty={!d.ledger.length}>
            {d.ledger.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{fmtDate(l.createdAt)}</td>
                <td className={l.delta > 0 ? "tabular-nums text-emerald-700" : "tabular-nums"}>{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                <td>{l.reason.replace("_", " ")}</td>
                <td className="text-muted-foreground">{l.note ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </div>
      </Section>

      <Section title="Projects">
        <Table head={["Project", "Stage", "Status", "Updated"]} empty={!d.projects.length}>
          {d.projects.map((p) => (
            <tr key={p.id}>
              <td className="font-medium">{p.name}</td>
              <td className="capitalize">{p.stage}</td>
              <td>{p.status}</td>
              <td>{fmtDay(p.updatedAt)}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Research jobs" description="Latest 10.">
          <ul className="divide-y divide-border text-sm">
            {d.jobs.map((j) => (
              <li key={j.id} className="flex justify-between gap-2 py-2">
                <span>{fmtDate(j.createdAt)}</span>
                <Pill tone={j.status === "succeeded" ? "good" : j.status === "failed" ? "bad" : "muted"}>{j.status}</Pill>
              </li>
            ))}
            {!d.jobs.length ? <li className="py-2 text-muted-foreground">None.</li> : null}
          </ul>
        </Section>

      </div>

      {target.marketplace && (d.listings.length || d.deals.length) ? (
        <Section title="Marketplace">
          <ul className="space-y-1 text-sm">
            {d.listings.map((l) => (
              <li key={l.id}>Listing: <Link href={`/app/marketplace/${l.id}`} className="underline-offset-4 hover:underline">{l.title}</Link> <Pill>{l.status}</Pill></li>
            ))}
            {d.deals.map((x) => (
              <li key={x.id}>Deal ({x.sellerId === user.id ? "seller" : "buyer"}): <Link href={`/app/marketplace/deals/${x.id}`} className="underline-offset-4 hover:underline">{x.state}</Link> {x.amountCents ? formatMoney(x.amountCents, x.currency) : ""}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <FounderProfileView data={founder} viewer="admin" />

      <Section title="Admin history for this user">
        <ul className="divide-y divide-border text-sm">
          {d.audit.map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span><span className="font-medium">{a.action}</span> <span className="text-muted-foreground">by {a.actorEmail}</span>{a.data && "reason" in a.data ? <span className="text-muted-foreground">: {String(a.data.reason)}</span> : null}</span>
              <span className="text-xs text-muted-foreground">{fmtDate(a.createdAt)} UTC</span>
            </li>
          ))}
          {!d.audit.length ? <li className="py-2 text-muted-foreground">No admin actions yet.</li> : null}
        </ul>
      </Section>
    </div>
  );
}
