import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { fmtDay, fmtNum, Pill, Section, Table } from "@/components/admin/ui";
import { listUsers, userFilterSchema } from "@/server/admin/users";

export const metadata: Metadata = { title: "Users · Admin" };

const STATUSES = [
  ["", "All"],
  ["active", "Active"],
  ["suspended", "Suspended"],
  ["not_onboarded", "Not onboarded"],
  ["admin", "Admins"],
  ["banned", "Marketplace banned"],
] as const;

export default async function AdminUsersPage({ searchParams }: PageProps<"/app/admin/users">) {
  const sp = await searchParams;
  const filter = userFilterSchema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined])));
  const { rows, total, page, pages } = await listUsers(filter);
  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filter, ...patch })) if (v !== undefined && v !== "") p.set(k, String(v));
    return `/app/admin/users${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Every client account. Open one to change its plan, credits or role, suspend it, or delete it." />
      <Section title={`${fmtNum(total)} user${total === 1 ? "" : "s"}`}>
        <form className="mb-4 flex flex-wrap gap-2" action="/app/admin/users">
          <input name="q" defaultValue={filter.q} placeholder="Search email or name" aria-label="Search users" className="h-9 min-w-56 flex-1 rounded-lg border border-input bg-white px-3 text-sm" />
          <select name="plan" defaultValue={filter.plan ?? ""} aria-label="Plan" className="h-9 rounded-lg border border-input bg-white px-2 text-sm">
            <option value="">Any plan</option>
            <option value="free">Free</option>
            <option value="founder">Founder</option>
            <option value="studio">Studio</option>
          </select>
          <select name="status" defaultValue={filter.status ?? ""} aria-label="Status" className="h-9 rounded-lg border border-input bg-white px-2 text-sm">
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button className="h-9 rounded-lg bg-[var(--plum)] px-4 text-sm font-medium text-white">Filter</button>
        </form>
        <Table head={["User", "Plan", "Status", "Projects", "Joined", "Last AI use"]} empty={!rows.length}>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>
                <Link href={`/app/admin/users/${u.id}`} className="font-medium underline-offset-4 hover:underline">{u.email}</Link>
                <p className="text-xs text-muted-foreground">{u.name ?? "—"}</p>
              </td>
              <td className="capitalize">{u.plan}</td>
              <td className="space-x-1">
                {u.suspendedAt ? <Pill tone="bad">Suspended</Pill> : <Pill tone="good">Active</Pill>}
                {u.envAdmin ? <Pill tone="info">Admin</Pill> : null}
                {!u.onboardedAt ? <Pill tone="warn">Not onboarded</Pill> : null}
                {u.marketplaceBannedAt ? <Pill tone="bad">Market ban</Pill> : null}
              </td>
              <td className="tabular-nums">{u.projects}</td>
              <td>{fmtDay(u.createdAt)}</td>
              <td>{fmtDay(u.lastActive)}</td>
            </tr>
          ))}
        </Table>
        {pages > 1 ? (
          <div className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? <Link href={qs({ page: page - 1 })} className="text-primary hover:underline">← Previous</Link> : <span />}
            <span className="text-muted-foreground">Page {page} of {pages}</span>
            {page < pages ? <Link href={qs({ page: page + 1 })} className="text-primary hover:underline">Next →</Link> : <span />}
          </div>
        ) : null}
      </Section>
    </div>
  );
}
