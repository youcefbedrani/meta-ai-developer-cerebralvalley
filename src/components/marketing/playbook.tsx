"use client";

import { Check, CircleDot, Megaphone, Sprout } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setTaskStatusAction } from "@/app/(app)/app/(founder)/marketing/actions";
import { cn } from "@/lib/utils";

type Task = { id: string; week: number; channel: string; channelType: "organic" | "paid"; title: string; description: string; successMetric: string | null; expectedOutput: string | null; dueDate: string | null; status: "todo" | "in_progress" | "done" };
const NEXT: Record<Task["status"], Task["status"]> = { todo: "in_progress", in_progress: "done", done: "todo" };

/** Week-by-week playbook. Click a step's circle to move it todo → in progress → done. */
export function Playbook({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state, u: { id: string; status: Task["status"] }) => state.map((t) => (t.id === u.id ? { ...t, status: u.status } : t)));
  const done = optimistic.filter((t) => t.status === "done").length;
  const weeks = [...new Set(optimistic.map((t) => t.week))].sort((a, b) => a - b);

  const cycle = (t: Task) =>
    start(async () => {
      const status = NEXT[t.status];
      setOptimistic({ id: t.id, status });
      const r = await setTaskStatusAction(t.id, status);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });

  return (
    <section className="surface p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-medium">Step-by-step playbook</h2>
          <p className="mt-1 text-sm text-muted-foreground">Work through it week by week. Click the circle to mark a step in progress, then done.</p>
        </div>
        <p className="text-sm"><span className="text-2xl font-semibold">{done}</span><span className="text-muted-foreground"> / {optimistic.length} done</span></p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${optimistic.length ? (done / optimistic.length) * 100 : 0}%` }} />
      </div>
      <div className="mt-6 space-y-6">
        {weeks.map((w) => (
          <div key={w}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{w === 0 ? "Week 0 · Setup" : `Week ${w}`}</p>
            <ol className="space-y-2">
              {optimistic.filter((t) => t.week === w).map((t) => (
                <li key={t.id} className={cn("flex items-start gap-3 rounded-xl border border-border bg-white p-3.5", t.status === "done" && "bg-muted/40")}>
                  <button
                    type="button"
                    onClick={() => cycle(t)}
                    aria-label={`Mark "${t.title}" as ${NEXT[t.status].replace("_", " ")}`}
                    className={cn(
                      "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                      t.status === "done" ? "border-transparent bg-brand-gradient text-white" : t.status === "in_progress" ? "border-[var(--violet)] text-[var(--violet)]" : "border-border hover:border-[var(--violet)]",
                    )}
                  >
                    {t.status === "done" ? <Check className="size-3.5" /> : t.status === "in_progress" ? <CircleDot className="size-3.5" /> : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn("font-medium", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</p>
                      <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", t.channelType === "paid" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
                        {t.channelType === "paid" ? <Megaphone className="size-3" /> : <Sprout className="size-3" />} {t.channel}
                      </span>
                      {t.status === "in_progress" ? <span className="text-xs text-[var(--violet)]">in progress</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                      {t.expectedOutput ? <span><span className="text-muted-foreground">Output:</span> {t.expectedOutput}</span> : null}
                      {t.successMetric ? <span><span className="text-muted-foreground">Success:</span> {t.successMetric}</span> : null}
                      {t.dueDate ? <span className={cn(t.status !== "done" && new Date(t.dueDate) < new Date() && "font-medium text-destructive")}><span className="text-muted-foreground">Due:</span> {t.dueDate.slice(0, 10)}</span> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
