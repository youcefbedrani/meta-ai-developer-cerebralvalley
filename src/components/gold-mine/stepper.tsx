import { Check } from "lucide-react";
import Link from "next/link";
import { GOLD_MINE_STEPS, type GoldMineStep } from "@/lib/validation/gold-mine";
import { cn } from "@/lib/utils";

/** Progress stepper shown on every Gold Mine step. Mode B starts at Demand (Market is skipped). */
export function GoldMineStepper({ sessionId, current, viewing, mode }: { sessionId: string; current: GoldMineStep; viewing: GoldMineStep; mode: "market" | "idea" }) {
  const order = GOLD_MINE_STEPS.map((s) => s.key);
  const reached = order.indexOf(current);
  return (
    <nav aria-label="Gold Mine steps" className="surface flex gap-1 overflow-x-auto p-2">
      {GOLD_MINE_STEPS.map((s, i) => {
        const skipped = s.key === "market" && mode === "idea";
        const done = i < reached || (s.key === "market" && mode === "market");
        const available = !skipped && s.key !== "market" && i <= reached;
        const content = (
          <>
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold", done ? "border-transparent bg-brand-gradient text-white" : viewing === s.key ? "border-[var(--plum)] text-[var(--plum)]" : "border-border text-muted-foreground")}>
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className="whitespace-nowrap">{s.label}{skipped ? " (skipped)" : ""}</span>
          </>
        );
        const cls = cn("flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm", viewing === s.key ? "bg-accent font-medium text-foreground" : "text-muted-foreground", skipped && "opacity-50");
        return available ? (
          <Link key={s.key} href={`/app/gold-mine/${sessionId}?step=${s.key}`} className={cn(cls, "hover:bg-accent/70")} aria-current={viewing === s.key ? "step" : undefined}>
            {content}
          </Link>
        ) : (
          <span key={s.key} className={cls} aria-disabled="true">
            {content}
          </span>
        );
      })}
    </nav>
  );
}
