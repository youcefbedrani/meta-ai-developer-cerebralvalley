/** Tiny inline trend chart (no axes). Real data only; renders nothing without points. */
export function Sparkline({ points, className }: { points: { month: string; value: number }[]; className?: string }) {
  if (points.length < 2) return <span className="text-xs text-muted-foreground">no data</span>;
  const w = 120;
  const h = 32;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${(h - (p.value / max) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className ?? "h-8 w-28"} role="img" aria-label={`Trend from ${points[0].month} to ${points[points.length - 1].month}`}>
      <defs>
        <linearGradient id="spark" x1="0" x2="1">
          <stop offset="0" stopColor="#f77373" />
          <stop offset="1" stopColor="#814bee" />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke="url(#spark)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
