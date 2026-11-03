"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Step = { step: string; pain: string };
type Idea = { title: string; replacesSteps: number[] };

/**
 * Today's process as a row of numbered steps, and under it one row per proposed idea with a dot under every step it
 * replaces — the "which software fixes which part of the work" picture, before the reader opens any idea.
 * A step's shade is how many ideas automate it (one hue, darker = more). Hover or focus an idea to light up its steps.
 */
export function ProcessMap({ steps, ideas }: { steps: Step[]; ideas: Idea[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (!steps.length || !ideas.length) return null;
  const covered = steps.map((_, i) => ideas.filter((idea) => idea.replacesSteps.includes(i + 1)).length);
  const max = Math.max(1, ...covered);
  const cols = `minmax(9rem, 13rem) repeat(${steps.length}, minmax(3.25rem, 1fr))`;
  const lit = (i: number) => active === null || ideas[active].replacesSteps.includes(i + 1);

  return (
    <section className="surface p-5">
      <h2 className="font-medium">From today&apos;s steps to software</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Each dot is a step an idea replaces or automates. Darker steps are the ones most ideas fix.</p>
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="grid min-w-max items-center gap-x-1 gap-y-2" style={{ gridTemplateColumns: cols }}>
          <span className="pr-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Today</span>
          {/* The step row, joined by a line that draws itself left to right. */}
          <div className="relative grid" style={{ gridColumn: "2 / -1", gridTemplateColumns: `repeat(${steps.length}, minmax(3.25rem, 1fr))` }}>
            <div aria-hidden="true" className="viz-draw absolute top-[18px] h-0.5 bg-border" style={{ left: `calc(100% / ${steps.length} / 2)`, right: `calc(100% / ${steps.length} / 2)` }} />
            {steps.map((s, i) => {
              const share = covered[i] / max;
              return (
                <div key={i} className="viz-pop relative flex flex-col items-center gap-1 px-1 text-center" style={{ animationDelay: `${0.1 + i * 0.12}s` }} title={`${i + 1}. ${s.step} — ${s.pain}`}>
                  <span
                    className={cn("grid size-9 place-items-center rounded-full border-2 border-card text-sm font-semibold tabular-nums shadow-sm transition-opacity", share > 0.5 ? "text-white" : "text-foreground", !lit(i) && "opacity-25")}
                    style={{ background: covered[i] ? `color-mix(in srgb, var(--primary) ${Math.round(25 + share * 75)}%, var(--card))` : "var(--muted)" }}
                  >
                    {i + 1}
                  </span>
                  <span className={cn("line-clamp-2 max-w-[7rem] text-[11px] leading-tight text-muted-foreground transition-opacity", !lit(i) && "opacity-40")}>{s.step}</span>
                </div>
              );
            })}
          </div>

          {ideas.map((idea, r) => (
            <div
              key={r}
              role="group"
              tabIndex={0}
              aria-label={`${idea.title} replaces steps ${idea.replacesSteps.join(", ") || "none"}`}
              onMouseEnter={() => setActive(r)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(r)}
              onBlur={() => setActive(null)}
              className={cn("col-span-full grid cursor-default items-center rounded-lg py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50", active === r ? "bg-primary/8" : "hover:bg-muted/50")}
              style={{ gridTemplateColumns: cols }}
            >
              <span className="truncate pl-2 pr-3 text-sm font-medium" title={idea.title}>{idea.title}</span>
              {steps.map((_, i) => {
                const on = idea.replacesSteps.includes(i + 1);
                return (
                  <span key={i} className="flex justify-center">
                    {on ? (
                      <span className="viz-pop size-3 rounded-full bg-primary ring-2 ring-card" style={{ animationDelay: `${0.5 + r * 0.1 + i * 0.03}s` }} />
                    ) : (
                      <span className="size-1.5 rounded-full bg-border" />
                    )}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-primary" /> Replaced by this idea</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full" style={{ background: "color-mix(in srgb, var(--primary) 30%, var(--card))" }} />
          <span className="size-3 rounded-full bg-primary" /> Fewer → more ideas fix this step
        </span>
      </p>
    </section>
  );
}
