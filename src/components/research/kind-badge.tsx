import { cn } from "@/lib/utils";

const STYLE = {
  FACT: "bg-emerald-50 text-emerald-700",
  ANALYSIS: "bg-violet-50 text-violet-700",
  ASSUMPTION: "bg-rose-50 text-rose-700",
} as const;

export function KindBadge({ kind }: { kind: keyof typeof STYLE }) {
  return <span className={cn("inline-flex shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide", STYLE[kind])}>{kind}</span>;
}
