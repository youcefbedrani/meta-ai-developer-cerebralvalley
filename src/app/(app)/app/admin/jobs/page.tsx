import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { JobButtons } from "@/components/admin/row-actions";
import { fmtDate, fmtNum, fmtUsd, Pill, Section, Table } from "@/components/admin/ui";
import { aiUsageByOperation, listJobs, recentAiErrors, topAiUsers } from "@/server/admin/platform";
import { platformSpendToday } from "@/server/ai/budget";
import { getPlatformSettings } from "@/server/platform/settings";

export const metadata: Metadata = { title: "Jobs & AI · Admin" };

const FILTERS = ["", "queued", "running", "failed", "succeeded", "cancelled"];
const tone = (s: string) => (s === "succeeded" ? "good" : s === "failed" ? "bad" : s === "running" || s === "queued" ? "info" : "muted") as "good" | "bad" | "info" | "muted";

export default async function AdminJobsPage({ searchParams }: PageProps<"/app/admin/jobs">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const [jobs, usage, errors, top, spent, settings] = await Promise.all([listJobs(status), aiUsageByOperation(30), recentAiErrors(15), topAiUsers(15), platformSpendToday(), getPlatformSettings()]);
  const limits = settings.aiLimits;
  const totals = usage.reduce((a, u) => ({ calls: a.calls + u.calls, cost: a.cost + u.cost }), { calls: 0, cost: 0 });
  return (
    <div className="space-y-6">
      <PageHeader title="Jobs & AI" description="Research jobs from the background worker and every AI call. Cancelling refunds the user's credits; retrying is free for them." />
      <Section title="Research jobs" description="Latest 100.">
        <div className="mb-3 flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link key={f} href={f ? `/app/admin/jobs?status=${f}` : "/app/admin/jobs"} className={`rounded-lg px-2.5 py-1 text-xs ${status === f ? "bg-[var(--plum)] text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {f || "all"}
            </Link>
          ))}
        </div>
        <Table head={["Created (UTC)", "User", "Project", "Status", "Detail", ""]} empty={!jobs.length}>
          {jobs.map(({ job, email, project }) => (
            <tr key={job.id}>
              <td className="whitespace-nowrap">{fmtDate(job.createdAt)}</td>
              <td><Link href={`/app/admin/users/${job.userId}`} className="underline-offset-4 hover:underline">{email}</Link></td>
              <td>{project}</td>
              <td><Pill tone={tone(job.status)}>{job.status}</Pill></td>
              <td className="max-w-64 text-xs text-muted-foreground">{job.error ?? job.currentStage ?? "—"}</td>
              <td className="text-right"><JobButtons jobId={job.id} status={job.status} /></td>
            </tr>
          ))}
        </Table>
      </Section>
      <Section
        title="AI budget"
        description={`Today (UTC): ${fmtUsd(spent)} spent${limits.platformDailyUsd > 0 ? ` of the ${fmtUsd(limits.platformDailyUsd)} daily cap. AI pauses for clients when the cap is reached.` : " (no daily cap set)."} Per-client limits and the cap are in Settings.`}
      >
        <Table head={["Top AI users this month", "Plan", "Calls", "Tokens used / monthly limit", "Est. cost"]} empty={!top.length}>
          {top.map((u) => (
            <tr key={u.userId}>
              <td><Link href={`/app/admin/users/${u.userId}`} className="underline-offset-4 hover:underline">{u.email}</Link></td>
              <td className="capitalize">{u.plan}</td>
              <td className="tabular-nums">{fmtNum(u.calls)}</td>
              <td className="tabular-nums">{fmtNum(u.tokens)} / {fmtNum(limits.monthlyTokens[u.plan])}{u.tokens >= limits.monthlyTokens[u.plan] ? <span className="ml-2 text-red-700">at limit</span> : null}</td>
              <td className="tabular-nums">{fmtUsd(u.cost)}</td>
            </tr>
          ))}
        </Table>
      </Section>
      <Section title="AI usage by feature" description={`Last 30 days · ${fmtNum(totals.calls)} calls · ${fmtUsd(totals.cost)} estimated provider cost.`}>
        <Table head={["Operation", "Calls", "Errors", "Tokens in / out", "Avg time", "Est. cost"]} empty={!usage.length}>
          {usage.map((u) => (
            <tr key={u.operation}>
              <td className="font-medium">{u.operation}</td>
              <td className="tabular-nums">{fmtNum(u.calls)}</td>
              <td className="tabular-nums">{u.errors ? <span className="text-red-700">{u.errors}</span> : 0}</td>
              <td className="tabular-nums">{fmtNum(u.tokensIn)} / {fmtNum(u.tokensOut)}</td>
              <td className="tabular-nums">{(u.avgMs / 1000).toFixed(1)}s</td>
              <td className="tabular-nums">{fmtUsd(u.cost)}</td>
            </tr>
          ))}
        </Table>
      </Section>
      <Section title="Recent AI errors">
        <Table head={["When (UTC)", "Operation", "User", "Provider / model", "Error"]} empty={!errors.length}>
          {errors.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap">{fmtDate(e.createdAt)}</td>
              <td>{e.operation}</td>
              <td>{e.email ?? "—"}</td>
              <td className="text-xs">{e.provider} / {e.model}</td>
              <td className="text-xs text-red-700">{e.status}{e.errorCode ? `: ${e.errorCode}` : ""}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
