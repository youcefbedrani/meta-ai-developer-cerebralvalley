"use client";

import { Check, Code2, Download, FileCode2, Loader2, MousePointerClick, Play, RefreshCw, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import { startCodebaseAction } from "@/app/(app)/app/(founder)/projects/[id]/design/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CodebaseJob = { status: "queued" | "running" | "succeeded" | "failed" | "cancelled"; stage: string | null; error: string | null } | null;
export type CodebaseSummary = { createdAt: string; files: number; screens: { name: string; route: string }[]; entities: string[]; failedScreens: string[] } | null;

/** Design → clickable prototype → approve → code. The last step runs as a background job. */
export function CodebasePanel({ projectId, screens, job, codebase, cost, balance, designBusy }: { projectId: string; screens: number; job: CodebaseJob; codebase: CodebaseSummary; cost: number; balance: number; designBusy: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = job?.status === "queued" || job?.status === "running";
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [active, router]);

  const base = `/app/projects/${projectId}/design`;
  const approve = () =>
    start(async () => {
      const r = await startCodebaseAction(projectId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Approved. Muse Spark is writing your code");
      router.refresh();
    });

  return (
    <section id="code" className="surface ambient-glow p-5">
      <ol className="grid gap-3 sm:grid-cols-3">
        <Step n={1} done icon={<Wand2 className="size-4" />} title="Design" text={`${screens} screen${screens === 1 ? "" : "s"} designed`} />
        <Step n={2} done={!!codebase || active} icon={<MousePointerClick className="size-4" />} title="Click through the prototype" text="Buttons lead to the right screens, like a Figma prototype." action={<Link href={`${base}/prototype`} className="text-xs font-medium text-primary hover:underline">Open the prototype →</Link>} />
        <Step n={3} done={!!codebase} icon={<Code2 className="size-4" />} title="Approve → generate the code" text="A runnable Next.js app: one page per screen, a data model with sample data, your brand." />
      </ol>

      <div className="mt-5 border-t border-border pt-4">
        {active ? (
          <div className="flex items-center gap-3" aria-live="polite">
            <Loader2 className="size-5 animate-spin text-primary" />
            <div>
              <p className="font-medium">Muse Spark is writing your code…</p>
              <p className="text-sm text-muted-foreground">{job?.stage ?? "Starting"} · usually 2 to 5 minutes. You can leave this page.</p>
            </div>
          </div>
        ) : codebase ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm">
              <p className="flex items-center gap-2 font-medium"><FileCode2 className="size-4 text-primary" /> Your MVP code is ready</p>
              <p className="mt-1 text-muted-foreground">
                {codebase.screens.length} pages ({codebase.screens.map((s) => s.route).join(", ")}) · {codebase.entities.length} data {codebase.entities.length === 1 ? "entity" : "entities"} · {codebase.files} files · Next.js + Tailwind
              </p>
              {codebase.failedScreens.length ? <p className="mt-1 text-xs text-amber-700">Shown as the design for now (conversion failed): {codebase.failedScreens.join(", ")}. Regenerate, or ask your AI coding tool to rebuild them.</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`${base}/code`} className="btn-shine inline-flex h-10 items-center gap-2 rounded-[10px] bg-[var(--plum)] px-4 text-sm font-medium text-white shadow-glow"><Play className="size-4" /> View & run the code</Link>
              <a href={`${base}/code/download`} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-border px-4 text-sm hover:bg-muted"><Download className="size-4" /> Download .zip</a>
              <Button variant="outline" className="h-10 rounded-[10px]" disabled={pending || designBusy || balance < cost} onClick={approve}>{pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Regenerate · {cost} credits</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {job?.status === "failed" ? <span className="text-destructive">{job.error} </span> : null}
              Happy with the prototype? Approve it and Muse Spark turns every screen into real code you can run, download, or keep building with Claude Code or Cursor.
            </p>
            <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
              <Button variant="gradient" className="h-10 px-5" disabled={pending || designBusy || balance < cost} onClick={approve}>{pending ? <Loader2 className="animate-spin" /> : <Check />} Approve & generate the code</Button>
              <span className="text-center text-xs text-muted-foreground">{cost} credits · {balance} left</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Step({ n, done, icon, title, text, action }: { n: number; done: boolean; icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <li className={cn("rounded-xl border p-3", done ? "border-success/30 bg-success/5" : "border-border")}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className={cn("grid size-6 place-items-center rounded-full text-xs", done ? "bg-success text-white" : "bg-muted text-muted-foreground")}>{done ? <Check className="size-3.5" /> : n}</span>
        {icon} {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </li>
  );
}
