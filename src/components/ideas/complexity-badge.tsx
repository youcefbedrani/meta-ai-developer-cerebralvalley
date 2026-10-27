import { cn } from "@/lib/utils";

const STYLE = {
  low: "border-emerald-300 text-emerald-700",
  medium: "border-amber-300 text-amber-700",
  high: "border-rose-300 text-rose-700",
} as const;

export function ComplexityBadge({ value }: { value: "low" | "medium" | "high" }) {
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs capitalize", STYLE[value])}>{value} complexity</span>;
}

export function HypothesisBadge() {
  return (
    <span className="inline-flex rounded-md bg-rose-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-rose-700">
      ASSUMPTION
    </span>
  );
}
