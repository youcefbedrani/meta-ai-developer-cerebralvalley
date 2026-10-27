import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { fmtDate, Section, Table } from "@/components/admin/ui";
import { listAdminAudit, listMarketplaceAudit } from "@/server/admin/audit";

export const metadata: Metadata = { title: "Audit log · Admin" };

const summary = (data: Record<string, unknown> | null) => (data ? JSON.stringify(data).slice(0, 220) : "—");

export default async function AdminAuditPage({ searchParams }: PageProps<"/app/admin/audit">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const [adminRows, marketRows] = await Promise.all([listAdminAudit({ q, limit: 200 }), listMarketplaceAudit(100)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Append-only record of every admin action and every marketplace state change." />
      <Section title="Admin actions" description="Latest 200.">
        <form className="mb-4 flex gap-2" action="/app/admin/audit">
          <input name="q" defaultValue={q} placeholder="Filter by action, admin email or target id" aria-label="Filter audit log" className="h-9 flex-1 rounded-lg border border-input bg-white px-3 text-sm" />
          <button className="h-9 rounded-lg bg-[var(--plum)] px-4 text-sm font-medium text-white">Filter</button>
        </form>
        <Table head={["When (UTC)", "Admin", "Action", "Target", "Details"]} empty={!adminRows.length}>
          {adminRows.map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap">{fmtDate(a.createdAt)}</td>
              <td>{a.actorEmail}</td>
              <td className="font-medium">{a.action}</td>
              <td className="text-xs">{a.targetType}{a.targetId ? ` · ${a.targetId.slice(0, 8)}` : ""}</td>
              <td className="max-w-80 break-all font-mono text-[11px] text-muted-foreground">{summary(a.data)}</td>
            </tr>
          ))}
        </Table>
      </Section>
      <Section title="Marketplace events" description="Latest 100: listing reviews, deal transitions, payments.">
        <Table head={["When (UTC)", "Actor", "Action", "State change", "Details"]} empty={!marketRows.length}>
          {marketRows.map(({ row, actorEmail }) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap">{fmtDate(row.createdAt)}</td>
              <td>{actorEmail ?? row.actorRole}</td>
              <td className="font-medium">{row.action}</td>
              <td className="text-xs">{row.fromState || row.toState ? `${row.fromState ?? "—"} → ${row.toState ?? "—"}` : "—"}</td>
              <td className="max-w-80 break-all font-mono text-[11px] text-muted-foreground">{summary(row.data)}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
