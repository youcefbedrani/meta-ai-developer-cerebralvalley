import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeViewer } from "@/components/design/code-viewer";
import { codebaseFileOrder } from "@/lib/codebase";
import { requireFounder } from "@/server/auth/current-user";
import { getProject } from "@/server/data/projects";
import { CREDIT_COSTS } from "@/lib/plans";
import { getBalance } from "@/server/billing/credits";
import { getCodebaseState, getCodebaseVersions } from "@/server/services/codebase";

/** The codebase generated from the approved prototype. */
export default async function CodePage({ params }: PageProps<"/app/projects/[id]/design/code">) {
  const user = await requireFounder();
  const { id } = await params;
  if (!(await getProject(user.id, id))) notFound();
  const [{ job, codebase }, versions, balance] = await Promise.all([getCodebaseState(user.id, id), getCodebaseVersions(user.id, id), getBalance(user.id)]);
  if (!codebase) {
    return (
      <div className="surface p-8 text-center">
        <p className="font-medium">No code yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Design your screens, click through the prototype, then approve it to generate the code.</p>
        <Link href={`/app/projects/${id}/design`} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Go to Design →</Link>
      </div>
    );
  }
  const active = job?.status === "queued" || job?.status === "running";
  return (
    <CodeViewer
      key={codebase.id}
      projectId={id}
      versionId={codebase.id}
      version={codebase.version ?? versions.length}
      note={codebase.note ?? "Generated from the approved prototype"}
      summary={codebase.summary ?? null}
      name={codebase.name}
      files={codebase.files}
      order={codebaseFileOrder(Object.keys(codebase.files))}
      generatedAt={codebase.createdAt.toISOString()}
      check={codebase.check ?? null}
      job={active ? { stage: job.stage, mode: job.mode } : null}
      lastError={job?.status === "failed" && job.kind === "codebase_edit" ? job.error : null}
      versions={versions.map((v) => ({ id: v.id, version: v.version, note: v.note, ok: v.ok, createdAt: v.createdAt.toISOString() }))}
      costs={{ change: CREDIT_COSTS.codebase_edit, fix: CREDIT_COSTS.codebase_fix }}
      balance={balance}
    />
  );
}
