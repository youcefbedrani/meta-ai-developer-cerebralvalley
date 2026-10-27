"use client";

import { Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createChannelAction, deleteChannelAction, updateChannelAction } from "@/app/(app)/app/(founder)/marketing/actions";
import { CopyButton } from "@/components/gold-mine/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AD_PLATFORMS } from "@/lib/validation/marketing";
import { cn } from "@/lib/utils";

export type ChannelRow = {
  id: string;
  name: string;
  type: "organic" | "paid";
  role: "primary" | "test" | "later";
  status: "planned" | "active" | "paused" | "stopped";
  monthlyBudget: number | null;
  currency: string;
  spentThisMonth: number;
  trackingUrl: string | null;
  signups: number;
};

const ORGANIC_SUGGESTIONS = ["SEO / content", "Reddit communities", "Facebook groups", "Discord / Slack communities", "LinkedIn content", "X (Twitter) content", "TikTok content", "YouTube content", "Instagram content", "Cold email", "LinkedIn DMs", "Product Hunt launch", "Directories", "Newsletters (guest posts)", "Partnerships / affiliates", "Building in public"];
const ROLE: Record<ChannelRow["role"], { label: string; className: string }> = {
  primary: { label: "Primary", className: "bg-[var(--plum)] text-white" },
  test: { label: "Test", className: "border border-amber-200 bg-amber-50 text-amber-800" },
  later: { label: "Later", className: "border border-border text-muted-foreground" },
};
const fmt = (n: number, c: string) => `${c} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** Every channel the founder runs, with its own monthly budget, status and tracking link. */
export function ChannelsBudget({ projectId, channels, monthlyBudget, currency }: { projectId: string; channels: ChannelRow[]; monthlyBudget: number | null; currency: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", type: "paid" as "organic" | "paid", monthlyBudget: "" });
  const [error, setError] = useState<string | null>(null);
  const allocated = channels.filter((c) => c.status !== "stopped").reduce((a, c) => a + (c.monthlyBudget ?? 0), 0);
  const spent = channels.reduce((a, c) => a + c.spentThisMonth, 0);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Something went wrong");
      else if (ok) toast.success(ok);
      router.refresh();
    });

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Monthly budget (setup)" value={monthlyBudget === null ? "—" : fmt(monthlyBudget, currency)} />
        <Stat label="Allocated to channels" value={fmt(allocated, currency)} warn={monthlyBudget !== null && allocated > monthlyBudget ? "More than your monthly budget" : undefined} />
        <Stat label="Spent this month (logged)" value={fmt(spent, currency)} />
      </section>

      <section className="surface p-6">
        <h2 className="flex items-center gap-2 font-medium"><Wallet className="size-4 text-primary" /> Channels & budget</h2>
        <p className="mt-1 text-sm text-muted-foreground">Add every platform you run, set a monthly budget for each, and follow spend against it. Spend comes from the results you log; signups come from tracked links.</p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-2.5">Channel</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Monthly budget</th><th className="px-4 py-2.5">Spent this month</th><th className="px-4 py-2.5 text-right">Tracked signups</th><th className="px-4 py-2.5">Tracking link</th><th className="px-2 py-2.5" /></tr>
            </thead>
            <tbody>
              {channels.map((c) => {
                const pct = c.monthlyBudget ? Math.min(100, Math.round((c.spentThisMonth / c.monthlyBudget) * 100)) : null;
                return (
                  <tr key={c.id} className="border-t border-border align-middle">
                    <td className="px-4 py-2.5"><p className="font-medium">{c.name}</p><p className="text-xs capitalize text-muted-foreground">{c.type}</p></td>
                    <td className="px-4 py-2.5">
                      <select aria-label={`Role for ${c.name}`} value={c.role} onChange={(e) => run(() => updateChannelAction(c.id, { role: e.target.value }))} className={cn("rounded-full px-2 py-0.5 text-xs", ROLE[c.role].className)}>
                        {Object.entries(ROLE).map(([k, r]) => <option key={k} value={k} className="bg-white text-foreground">{r.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <select aria-label={`Status for ${c.name}`} value={c.status} onChange={(e) => run(() => updateChannelAction(c.id, { status: e.target.value }))} className="rounded-lg border border-border bg-white px-2 py-1 text-xs capitalize">
                        {["planned", "active", "paused", "stopped"].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{c.currency}</span>
                        <Input
                          aria-label={`Monthly budget for ${c.name}`}
                          defaultValue={c.monthlyBudget ?? ""}
                          placeholder="—"
                          inputMode="decimal"
                          className="h-8 w-24"
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (next === String(c.monthlyBudget ?? "")) return;
                            run(() => updateChannelAction(c.id, { monthlyBudget: next === "" ? null : next }), "Budget saved");
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <p>{fmt(c.spentThisMonth, c.currency)}</p>
                      {pct !== null ? (
                        <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-muted" title={`${pct}% of budget`}>
                          <div className={cn("h-full rounded-full", pct >= 100 ? "bg-destructive" : "bg-brand-gradient")} style={{ width: `${pct}%` }} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{c.signups}</td>
                    <td className="px-4 py-2.5">{c.trackingUrl ? <span className="flex items-center gap-1"><code className="max-w-44 truncate text-xs text-muted-foreground">{c.trackingUrl.replace(/^https?:\/\//, "")}</code><CopyButton text={c.trackingUrl} /></span> : <span className="text-xs text-muted-foreground">Publish a page first</span>}</td>
                    <td className="px-2 py-2.5"><Button variant="ghost" size="icon-sm" aria-label={`Remove ${c.name}`} onClick={() => run(() => deleteChannelAction(c.id), "Channel removed")}><Trash2 /></Button></td>
                  </tr>
                );
              })}
              {!channels.length ? <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">No channels yet. Add one below.</td></tr> : null}
            </tbody>
          </table>
        </div>

        <form
          className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await createChannelAction(projectId, { ...form, currency });
              if (!r.ok) return setError(Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error);
              toast.success("Channel added");
              setForm({ name: "", type: form.type, monthlyBudget: "" });
              router.refresh();
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ch-name">Add a channel or ad platform</Label>
            <Input id="ch-name" list="ch-suggestions" value={form.name} onChange={(e) => { const name = e.target.value; setForm((f) => ({ ...f, name, type: (AD_PLATFORMS as readonly string[]).includes(name) ? "paid" : ORGANIC_SUGGESTIONS.includes(name) ? "organic" : f.type })); }} placeholder="e.g. Meta (Facebook & Instagram)" className="h-10" />
            <datalist id="ch-suggestions">{[...AD_PLATFORMS, ...ORGANIC_SUGGESTIONS].map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-type">Type</Label>
            <select id="ch-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "organic" | "paid" }))} className="h-10 rounded-lg border border-input bg-white px-3 text-sm">
              <option value="paid">Paid</option>
              <option value="organic">Organic</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-budget">Monthly budget ({currency})</Label>
            <Input id="ch-budget" inputMode="decimal" value={form.monthlyBudget} onChange={(e) => setForm((f) => ({ ...f, monthlyBudget: e.target.value }))} placeholder="optional" className="h-10 w-32" />
          </div>
          <Button type="submit" variant="outline" className="h-10 rounded-[10px]" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Plus />} Add channel</Button>
          {error ? <p role="alert" className="text-sm text-destructive sm:col-span-4">{error}</p> : null}
        </form>
      </section>
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: string }) {
  return (
    <div className="surface p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {warn ? <p className="mt-1 text-xs text-destructive">{warn}</p> : null}
    </div>
  );
}
