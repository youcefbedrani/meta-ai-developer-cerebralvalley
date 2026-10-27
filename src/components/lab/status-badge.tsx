import { cn } from "@/lib/utils";

const STYLE = {
  planned: "border-border text-muted-foreground",
  running: "border-sky-300 text-sky-700",
  completed: "border-emerald-300 text-emerald-700",
  cancelled: "border-border text-muted-foreground line-through",
} as const;

export function ExperimentStatusBadge({ status, passed }: { status: keyof typeof STYLE; passed?: boolean | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs capitalize", STYLE[status])}>{status}</span>
      {status === "completed" && passed !== null && passed !== undefined ? (
        <span className={cn("inline-flex rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold", passed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
          {passed ? "PASSED" : "FAILED"}
        </span>
      ) : null}
    </span>
  );
}
