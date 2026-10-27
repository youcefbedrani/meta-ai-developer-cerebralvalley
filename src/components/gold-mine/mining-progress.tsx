"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PAIN_STAGES } from "@/lib/validation/gold-mine";
import { cn } from "@/lib/utils";

/** Shows the real stage reported by the worker and polls until the job ends. */
export function MiningProgress({ stage }: { stage: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(id);
  }, [router]);
  const idx = Math.max(0, PAIN_STAGES.findIndex((s) => s.key === stage));
  return (
    <div className="surface p-6" aria-live="polite">
      <div className="flex items-center gap-3">
        <Loader2 className="size-5 animate-spin text-primary" />
        <div>
          <p className="font-medium">Mining customer pains</p>
          <p className="text-sm text-muted-foreground">Reading public discussions takes a few minutes. You can leave this page.</p>
        </div>
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2">
        {PAIN_STAGES.map((s, i) => (
          <li key={s.key} className={cn("flex items-center gap-2.5 text-sm", i > idx && "text-muted-foreground/60")}>
            <span className={cn("grid size-5 place-items-center rounded-full border", i < idx ? "border-transparent bg-brand-gradient text-white" : i === idx ? "border-[var(--plum)]" : "border-border")}>
              {i < idx ? <Check className="size-3" /> : i === idx ? <span className="size-1.5 animate-pulse rounded-full bg-[var(--plum)]" /> : null}
            </span>
            {s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
