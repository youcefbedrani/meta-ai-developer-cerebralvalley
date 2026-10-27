import Link from "next/link";
import { cn } from "@/lib/utils";

/** "2026-10-18 14:05" in UTC: stable between server and client, no locale surprises. */
export const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "—");
export const fmtDay = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
export const fmtNum = (n: number) => n.toLocaleString("en-US");
export const fmtUsd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Stat({ label, value, hint, href, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string; tone?: "warn" }) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "warn" && "text-amber-700")}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="surface block p-4 transition-colors hover:border-[var(--violet)]">
      {body}
    </Link>
  ) : (
    <div className="surface p-4">{body}</div>
  );
}

export function Section({ title, description, actions, children }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-medium">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Plain responsive table: scrolls sideways inside its card on small screens. */
export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="py-2 pr-4 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top [&_tr]:border-b [&_tr]:border-border/60">{children}</tbody>
      </table>
      {empty ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing here yet.</p> : null}
    </div>
  );
}

const PILL: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-800",
  bad: "bg-red-50 text-red-700",
  info: "bg-violet-50 text-violet-800",
  muted: "bg-muted text-muted-foreground",
};

export function Pill({ tone = "muted", children }: { tone?: keyof typeof PILL; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium", PILL[tone])}>{children}</span>;
}

/** Single-series daily bar chart. Hover a bar for its value; the same numbers are in a screen-reader table. */
export function DailyBars({ data, label }: { data: { day: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <figure>
      <div className="flex h-40 items-end gap-[2px] border-b border-border" role="img" aria-label={`${label}: ${total} in the last ${data.length} days`}>
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-[4px] bg-[var(--plum)] opacity-85 transition-opacity group-hover:opacity-100" style={{ height: d.count ? `${Math.max(3, (d.count / max) * 100)}%` : "0" }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background group-hover:block">
              {d.day}: {d.count}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="mt-1.5 flex justify-between text-xs text-muted-foreground">
        <span>{data[0]?.day}</span>
        <span>max {max}/day</span>
        <span>{data.at(-1)?.day}</span>
      </figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
