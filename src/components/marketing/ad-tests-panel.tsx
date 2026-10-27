"use client";

import { ArrowRight, FlaskConical, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createAdExperimentAction } from "@/app/(app)/app/(founder)/marketing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { policyCheck } from "@/lib/marketing/policy";
import { AD_PLATFORMS } from "@/lib/validation/marketing";
import { cn } from "@/lib/utils";

type TestRow = { id: string; name: string; platform: string; status: string; budgetTotal: string; currency: string; durationDays: number; maxCostPerSignup: string; variantCount: number };
type Variant = { name: string; angle: string; headline: string; primaryText: string; cta: string; audienceIdea: string; assetId: string | null };
export type VariantTemplate = Omit<Variant, "name"> & { source: string };

const STATUS: Record<string, string> = { draft: "border-border text-muted-foreground", running: "border-emerald-200 bg-emerald-50 text-emerald-700", completed: "border-sky-200 bg-sky-50 text-sky-700", stopped: "border-rose-200 bg-rose-50 text-rose-700" };
const blank = (i: number): Variant => ({ name: `Variant ${String.fromCharCode(65 + i)}`, angle: "", headline: "", primaryText: "", cta: "Join waitlist", audienceIdea: "", assetId: null });

export function AdTestsPanel({ projectId, basePath, tests, paidChannels, templates, currency, hasLandingPage }: { projectId: string; basePath: string; tests: TestRow[]; paidChannels: { id: string; name: string }[]; templates: VariantTemplate[]; currency: string; hasLandingPage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(tests.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ channelId: paidChannels[0]?.id ?? "", platform: paidChannels[0]?.name ?? "Google Search", name: "", hypothesis: "", audience: "", budgetTotal: "70", currency, durationDays: "7", maxCostPerSignup: "", minClicks: "100" });
  const [variants, setVariants] = useState<Variant[]>([blank(0), blank(1)]);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const setVar = (i: number, k: keyof Variant, v: string) => setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <>
      <section className="surface p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-medium"><FlaskConical className="size-4 text-primary" /> Paid ad tests</h2>
            <p className="mt-1 text-sm text-muted-foreground">Small-budget experiments with 2–3 variants, and a stop/continue rule you set before spending. Create the ads in the platform itself; each variant gets its own tracking link.</p>
          </div>
          {!open ? <Button variant="gradient" className="h-10 shrink-0 px-4" onClick={() => setOpen(true)}><Plus /> New ad test</Button> : null}
        </div>

        {tests.length ? (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white">
            {tests.map((t) => (
              <li key={t.id}>
                <Link href={`${basePath}/ads/${t.id}`} className="flex flex-col gap-1 px-4 py-3 text-sm hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{t.platform} · {t.variantCount} variants · {t.currency} {t.budgetTotal} over {t.durationDays} days · max {t.currency} {t.maxCostPerSignup}/signup</span>
                  </span>
                  <span className="flex items-center gap-2"><span className={cn("rounded-full border px-2 py-0.5 text-xs capitalize", STATUS[t.status])}>{t.status}</span><ArrowRight className="size-4 text-muted-foreground" /></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {open ? (
        <section className="surface p-6">
          <h3 className="font-medium">New ad test</h3>
          {!hasLandingPage ? <p className="mt-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-muted-foreground">Publish a landing page first so each variant gets a tracking link. You can still create the test now.</p> : null}
          <form
            className="mt-4 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              start(async () => {
                const r = await createAdExperimentAction(projectId, { ...f, channelId: f.channelId || null, variants });
                if (!r.ok) return setError(Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error);
                toast.success("Ad test created");
                router.push(`${basePath}/ads/${r.data.id}`);
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="at-platform">Platform</Label>
                <select id="at-platform" value={f.channelId ? `ch:${f.channelId}` : `p:${f.platform}`} onChange={(e) => { const [kind, val] = [e.target.value.slice(0, e.target.value.indexOf(":")), e.target.value.slice(e.target.value.indexOf(":") + 1)]; if (kind === "ch") { set("channelId", val); set("platform", paidChannels.find((c) => c.id === val)?.name ?? ""); } else { set("channelId", ""); set("platform", val); } }} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm">
                  {paidChannels.length ? <optgroup label="Your paid channels">{paidChannels.map((c) => <option key={c.id} value={`ch:${c.id}`}>{c.name}</option>)}</optgroup> : null}
                  <optgroup label="Other platforms">{AD_PLATFORMS.filter((p) => !paidChannels.some((c) => c.name === p)).map((p) => <option key={p} value={`p:${p}`}>{p}</option>)}</optgroup>
                </select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="at-name">Test name</Label><Input id="at-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Pain vs time-saved angle" className="h-10" /></div>
              <div className="space-y-1.5 md:col-span-2"><Label htmlFor="at-hyp">Hypothesis</Label><Input id="at-hyp" value={f.hypothesis} onChange={(e) => set("hypothesis", e.target.value)} placeholder="Agency owners respond more to the pain angle than to time saved" className="h-10" /></div>
              <div className="space-y-1.5 md:col-span-2"><Label htmlFor="at-aud">Audience</Label><Input id="at-aud" value={f.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Who will see the ads (targeting)" className="h-10" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="space-y-1.5"><Label htmlFor="at-budget">Total budget ({f.currency})</Label><Input id="at-budget" inputMode="decimal" value={f.budgetTotal} onChange={(e) => set("budgetTotal", e.target.value)} className="h-10" /></div>
              <div className="space-y-1.5"><Label htmlFor="at-days">Duration (days)</Label><Input id="at-days" inputMode="numeric" value={f.durationDays} onChange={(e) => set("durationDays", e.target.value)} className="h-10" /></div>
              <div className="space-y-1.5"><Label htmlFor="at-cps">Max cost per signup</Label><Input id="at-cps" inputMode="decimal" value={f.maxCostPerSignup} onChange={(e) => set("maxCostPerSignup", e.target.value)} placeholder="you decide" className="h-10" /></div>
              <div className="space-y-1.5"><Label htmlFor="at-clicks">Decide after (clicks)</Label><Input id="at-clicks" inputMode="numeric" value={f.minClicks} onChange={(e) => set("minClicks", e.target.value)} className="h-10" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Stop/continue rule: after {f.minClicks || "N"} clicks, a variant whose cost per signup is above {f.maxCostPerSignup ? `${f.currency} ${f.maxCostPerSignup}` : "your maximum"} stops. Set this before you spend; there are no “typical” numbers to rely on.</p>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Variants ({variants.length}/3)</p>
                {templates.length ? (
                  <select aria-label="Fill a variant from your generated ads" value="" onChange={(e) => { const t = templates[Number(e.target.value)]; if (!t) return; const i = variants.findIndex((v) => !v.headline); const idx = i === -1 ? variants.length - 1 : i; setVariants((vs) => vs.map((x, j) => (j === idx ? { ...x, ...t } : x))); }} className="h-9 rounded-lg border border-input bg-white px-2 text-sm">
                    <option value="">Fill from generated ads…</option>
                    {templates.map((t, i) => <option key={i} value={i}>{t.source}: {t.headline.slice(0, 50)}</option>)}
                  </select>
                ) : null}
              </div>
              {variants.map((v, i) => {
                const warnings = policyCheck(`${v.headline}\n${v.primaryText}\n${v.cta}`);
                return (
                  <div key={i} className="rounded-xl border border-border bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Input aria-label={`Variant ${i + 1} name`} value={v.name} onChange={(e) => setVar(i, "name", e.target.value)} className="h-8 w-40 font-medium" />
                      {variants.length > 2 ? <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove variant ${i + 1}`} onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}><Trash2 /></Button> : null}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="space-y-1"><Label htmlFor={`v${i}-angle`} className="text-xs">Angle</Label><Input id={`v${i}-angle`} value={v.angle} onChange={(e) => setVar(i, "angle", e.target.value)} className="h-9" /></div>
                      <div className="space-y-1"><Label htmlFor={`v${i}-headline`} className="text-xs">Headline</Label><Input id={`v${i}-headline`} value={v.headline} onChange={(e) => setVar(i, "headline", e.target.value)} className="h-9" /></div>
                      <div className="space-y-1 md:col-span-2"><Label htmlFor={`v${i}-text`} className="text-xs">Primary text</Label><textarea id={`v${i}-text`} value={v.primaryText} onChange={(e) => setVar(i, "primaryText", e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm" /></div>
                      <div className="space-y-1"><Label htmlFor={`v${i}-cta`} className="text-xs">CTA</Label><Input id={`v${i}-cta`} value={v.cta} onChange={(e) => setVar(i, "cta", e.target.value)} className="h-9" /></div>
                      <div className="space-y-1"><Label htmlFor={`v${i}-aud`} className="text-xs">Audience idea</Label><Input id={`v${i}-aud`} value={v.audienceIdea} onChange={(e) => setVar(i, "audienceIdea", e.target.value)} className="h-9" /></div>
                    </div>
                    {warnings.length ? <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> {warnings.map((w) => `${w.category} (“${w.match}”)`).join(" · ")}: {warnings[0].advice}</p> : null}
                  </div>
                );
              })}
              {variants.length < 3 ? <Button type="button" variant="outline" className="rounded-[10px]" onClick={() => setVariants((vs) => [...vs, blank(vs.length)])}><Plus /> Add variant</Button> : null}
            </div>

            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              {tests.length ? <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button> : null}
              <Button type="submit" variant="gradient" className="h-10 px-5" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null} Create ad test</Button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}
