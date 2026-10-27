"use client";

import { useState } from "react";
import { saveSettingsAction } from "@/app/(app)/app/admin/actions";
import { useRun } from "@/components/marketplace/use-run";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MODULES, type PlatformSettings, type SignupMode } from "@/lib/platform-settings";
import { cn } from "@/lib/utils";

const lines = (v: string) => v.split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-white p-3">
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--plum)]" />
    </label>
  );
}

const MODES: { value: SignupMode; label: string; hint: string }[] = [
  { value: "open", label: "Open", hint: "Anyone can create an account." },
  { value: "invite_only", label: "Invite-only", hint: "Only the emails and domains below can create an account." },
  { value: "closed", label: "Closed", hint: "Nobody new can sign up. Existing users still sign in." },
];

/** Edits one part of the platform settings; saves the whole object so other sections stay as they are. */
export function SettingsForm({ initial, section }: { initial: PlatformSettings; section: "signups" | "platform" }) {
  const { run, pending } = useRun();
  const [s, setS] = useState(initial);
  const [emails, setEmails] = useState(initial.signups.allowedEmails.join("\n"));
  const [domains, setDomains] = useState(initial.signups.allowedDomains.join("\n"));
  const set = <K extends keyof PlatformSettings>(k: K, v: Partial<PlatformSettings[K]>) => setS((p) => ({ ...p, [k]: typeof p[k] === "object" ? { ...(p[k] as object), ...v } : v }));

  const save = () =>
    run(
      () => saveSettingsAction({ ...s, signups: { ...s.signups, allowedEmails: lines(emails), allowedDomains: lines(domains) } }),
      "Settings saved",
    );

  return (
    <div className="space-y-6">
      {section === "signups" ? (
        <>
          <fieldset>
            <legend className="text-sm font-medium">Who can create an account?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => (
                <label key={m.value} className={cn("cursor-pointer rounded-xl border bg-white p-3", s.signups.mode === m.value ? "border-[var(--plum)] ring-2 ring-[var(--plum)]/15" : "border-border")}>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <input type="radio" name="signup-mode" value={m.value} checked={s.signups.mode === m.value} onChange={() => set("signups", { mode: m.value })} className="accent-[var(--plum)]" />
                    {m.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{m.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={cn("grid gap-4 sm:grid-cols-2", s.signups.mode !== "invite_only" && "opacity-60")}>
            <div>
              <Label htmlFor="allowed-emails">Invited emails</Label>
              <Textarea id="allowed-emails" rows={5} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={"ana@example.com\nsam@example.org"} className="mt-1.5 font-mono text-xs" />
              <p className="mt-1 text-xs text-muted-foreground">One per line. Used in invite-only mode.</p>
            </div>
            <div>
              <Label htmlFor="allowed-domains">Allowed domains</Label>
              <Textarea id="allowed-domains" rows={5} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder={"mycompany.com"} className="mt-1.5 font-mono text-xs" />
              <p className="mt-1 text-xs text-muted-foreground">Anyone with an email at these domains can join.</p>
            </div>
          </div>
          <div>
            <Label htmlFor="signup-message">Message on the sign-up page (optional)</Label>
            <Input id="signup-message" value={s.signups.message} onChange={(e) => set("signups", { message: e.target.value })} placeholder="We're opening more spots soon. Join the waitlist on our homepage." className="mt-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">Shown when sign-ups aren&apos;t open, and as the error when someone is refused.</p>
          </div>
        </>
      ) : (
        <>
          <div>
            <h3 className="text-sm font-medium">Modules</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Turning a module off hides it for users and blocks its paid AI actions. Admins still see it, marked as off.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {MODULES.map((m) => (
                <Toggle key={m.key} id={`mod-${m.key}`} label={m.label} checked={s.modules[m.key] !== false} onChange={(v) => setS((p) => ({ ...p, modules: { ...p.modules, [m.key]: v } }))} />
              ))}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Maintenance & safety</h3>
              <Toggle id="maintenance" label="Maintenance mode" hint="Users see a maintenance page instead of the app. Admins keep full access." checked={s.maintenance.enabled} onChange={(v) => set("maintenance", { enabled: v })} />
              <Input aria-label="Maintenance message" value={s.maintenance.message} onChange={(e) => set("maintenance", { message: e.target.value })} placeholder="Message on the maintenance page" />
              <Toggle id="ai-paused" label="Pause all AI features" hint="Blocks every paid AI action for users before any credits are charged. Use it if a provider is down or costs spike." checked={s.aiPaused} onChange={(v) => setS((p) => ({ ...p, aiPaused: v }))} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Announcement banner</h3>
              <Toggle id="announcement" label="Show a banner to every user" checked={s.announcement.enabled} onChange={(v) => set("announcement", { enabled: v })} />
              <Input aria-label="Announcement message" value={s.announcement.message} onChange={(e) => set("announcement", { message: e.target.value })} placeholder="New: Marketing Studio is live!" />
              <select aria-label="Announcement style" value={s.announcement.tone} onChange={(e) => set("announcement", { tone: e.target.value as "info" | "warning" })} className="h-9 rounded-lg border border-input bg-white px-2 text-sm">
                <option value="info">Info (violet)</option>
                <option value="warning">Warning (amber)</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium">Monthly credits per plan</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Applies to each user&apos;s next monthly grant (the 1st of the month, UTC).</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["free", "founder", "studio"] as const).map((p) => (
                  <div key={p}>
                    <Label htmlFor={`credits-${p}`} className="capitalize">{p}</Label>
                    <Input id={`credits-${p}`} inputMode="numeric" value={String(s.monthlyCredits[p])} onChange={(e) => set("monthlyCredits", { [p]: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="mt-1.5" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium">AI limits (fair use)</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Tokens each client can use per UTC day and month, checked before every AI call so no client can use up the platform&apos;s AI budget. On top of credits.</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["free", "founder", "studio"] as const).map((p) => (
                  <div key={p}>
                    <Label htmlFor={`ai-day-${p}`} className="capitalize">{p} / day</Label>
                    <Input id={`ai-day-${p}`} inputMode="numeric" value={String(s.aiLimits.dailyTokens[p])} onChange={(e) => set("aiLimits", { dailyTokens: { ...s.aiLimits.dailyTokens, [p]: Number(e.target.value.replace(/\D/g, "")) || 0 } })} className="mt-1.5" />
                  </div>
                ))}
                {(["free", "founder", "studio"] as const).map((p) => (
                  <div key={p}>
                    <Label htmlFor={`ai-month-${p}`} className="capitalize">{p} / month</Label>
                    <Input id={`ai-month-${p}`} inputMode="numeric" value={String(s.aiLimits.monthlyTokens[p])} onChange={(e) => set("aiLimits", { monthlyTokens: { ...s.aiLimits.monthlyTokens, [p]: Number(e.target.value.replace(/\D/g, "")) || 0 } })} className="mt-1.5" />
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="ai-reply">Longest Copilot reply (tokens)</Label>
                  <Input id="ai-reply" inputMode="numeric" value={String(s.aiLimits.maxReplyTokens)} onChange={(e) => set("aiLimits", { maxReplyTokens: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="ai-cap">Platform AI spend cap per day (USD, 0 = none)</Label>
                  <Input id="ai-cap" inputMode="decimal" value={String(s.aiLimits.platformDailyUsd)} onChange={(e) => set("aiLimits", { platformDailyUsd: Number(e.target.value) || 0 })} className="mt-1.5" />
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium">Marketplace</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Applies to new deals. Deals already in progress keep their fee.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="fee">Platform fee (%)</Label>
                  <Input id="fee" inputMode="decimal" value={String(s.marketplace.feePercent)} onChange={(e) => set("marketplace", { feePercent: Number(e.target.value) || 0 })} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="confirm-days">Auto-confirm after (days)</Label>
                  <Input id="confirm-days" inputMode="numeric" value={String(s.marketplace.autoConfirmDays)} onChange={(e) => set("marketplace", { autoConfirmDays: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="mt-1.5" />
                </div>
              </div>
              <div className="mt-3">
                <Label htmlFor="review-mode">New listings</Label>
                <select id="review-mode" value={s.marketplace.reviewMode} onChange={(e) => set("marketplace", { reviewMode: e.target.value as "auto" | "manual" })} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm">
                  <option value="auto">Go live when automatic checks pass (near-duplicates wait for review)</option>
                  <option value="manual">An admin approves every listing</option>
                </select>
              </div>
            </div>
          </div>
        </>
      )}
      <div className="flex justify-end border-t border-border pt-4">
        <Button variant="gradient" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
