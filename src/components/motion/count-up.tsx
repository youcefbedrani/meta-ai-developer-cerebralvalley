"use client";

import { useEffect, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts from 0 to `value` once, when it mounts. Shows the final number immediately for reduced motion. */
export function CountUp({ value, duration = 900, className }: { value: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduced() || value <= 0) return;
    let raf = 0;
    let t0 = 0;
    // Every frame (including the first) is set from inside requestAnimationFrame; cleanup always lands on the final value.
    const tick = (t: number) => {
      t0 ||= t;
      const p = Math.min(1, (t - t0) / duration);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setShown(value);
    };
  }, [value, duration]);
  return <span className={className}>{shown.toLocaleString("en")}</span>;
}

/** A ring that draws itself around the score as it counts up. */
export function ScoreRing({ score, tone }: { score: number; tone: "go" | "pivot" | "drop" | "incomplete" }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const color = { go: "var(--success)", pivot: "var(--warning)", drop: "var(--destructive)", incomplete: "var(--muted-foreground)" }[tone];
  return (
    <div className="relative size-24 shrink-0" role="img" aria-label={`Evidence score ${score} out of 100`}>
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--muted)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="score-ring-arc" style={{ ["--ring-full" as string]: `${c}` }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center" aria-hidden="true">
        <div>
          <CountUp value={score} className="block text-3xl font-semibold tabular-nums leading-none tracking-tight" />
          <span className="text-[11px] text-muted-foreground">of 100</span>
        </div>
      </div>
    </div>
  );
}
