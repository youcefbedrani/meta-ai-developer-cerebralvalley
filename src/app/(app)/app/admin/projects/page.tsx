import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { ProjectStatusButton } from "@/components/admin/row-actions";
import { fmtDay, Pill, Section, Table } from "@/components/admin/ui";
import { listAllProjects } from "@/server/admin/platform";

export const metadata: Metadata = { title: "Projects · Admin" };

export default async function AdminProjectsPage({ searchParams }: PageProps<"/app/admin/projects">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 200) : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const rows = await listAllProjects({ q, status });
  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Every client project across Startum (latest 200 shown). Project contents stay private to their owner; you can archive or restore a project." />
      <Section title={`${rows.length} project${rows.length === 1 ? "" : "s"}`}>
        <form className="mb-4 flex flex-wrap gap-2" action="/app/admin/projects">
          <input name="q" defaultValue={q} placeholder="Search project or owner email" aria-label="Search projects" className="h-9 min-w-56 flex-1 rounded-lg border border-input bg-white px-3 text-sm" />
          <select name="status" defaultValue={status ?? ""} aria-label="Status" className="h-9 rounded-lg border border-input bg-white px-2 text-sm">
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <button className="h-9 rounded-lg bg-[var(--plum)] px-4 text-sm font-medium text-white">Filter</button>
        </form>
        <Table head={["Project", "Owner", "Stage", "Waitlist", "Updated", ""]} empty={!rows.length}>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>
                <span className="font-medium">{p.name}</span>
                <span className="ml-1.5 space-x-1">
                  {p.status === "archived" ? <Pill>archived</Pill> : null}
                  {p.decision ? <Pill tone={p.decision === "build" ? "good" : p.decision === "drop" ? "bad" : "warn"}>{p.decision}</Pill> : null}
                  {p.listed ? <Pill tone="info">listed</Pill> : null}
                </span>
              </td>
              <td><Link href={`/app/admin/users/${p.ownerId}`} className="underline-offset-4 hover:underline">{p.ownerEmail}</Link></td>
              <td className="capitalize">{p.stage}</td>
              <td className="tabular-nums">{p.signups}</td>
              <td>{fmtDay(p.updatedAt)}</td>
              <td className="text-right"><ProjectStatusButton projectId={p.id} status={p.status} /></td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
