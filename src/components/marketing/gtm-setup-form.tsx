"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateMarketingPlanAction } from "@/app/(app)/app/(founder)/marketing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GTM_GOALS, type GtmSetup } from "@/lib/validation/marketing";
import { cn } from "@/lib/utils";

type Values = { monthlyBudget: string; currency: string; hoursPerWeek: string; goal: GtmSetup["goal"]; customGoal: string; skills: string; geography: string; audienceType: GtmSetup["audienceType"] };

/** Go-to-market setup: budget, time, goal and audience. The plan is generated from these plus the project's research. */
export function GtmSetupForm({ projectId, defaults, cost, regenerate, disabled }: { projectId: string; defaults: Partial<GtmSetup>; cost: number; regenerate?: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [v, setV] = useState<Values>({
    monthlyBudget: String(defaults.monthlyBudget ?? 0),
    currency: defaults.currency ?? "USD",
    hoursPerWeek: String(defaults.hoursPerWeek ?? 5),
    goal: defaults.goal ?? "100_signups",
    customGoal: defaults.customGoal ?? "",
    skills: (defaults.skills ?? []).join(", "),
    geography: defaults.geography ?? "",
    audienceType: defaults.audienceType ?? "b2b",
  });
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = (k: string) => (errors[k] ? <p className="text-xs text-destructive">{errors[k]}</p> : null);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        setFormError(null);
        start(async () => {
          const r = await generateMarketingPlanAction(projectId, { ...v, skills: v.skills.split(",").map((s) => s.trim()).filter(Boolean) });
          if (!r.ok) {
            setErrors(Object.fromEntries(Object.entries(r.fieldErrors ?? {}).map(([k, m]) => [k, m?.[0]])));
            return setFormError(r.error);
          }
          toast.success("Marketing plan ready");
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="gtm-budget">Monthly ad budget</Label>
          <div className="flex gap-2">
            <Input id="gtm-budget" inputMode="decimal" value={v.monthlyBudget} onChange={(e) => set("monthlyBudget", e.target.value)} className="h-10" />
            <Input aria-label="Currency" value={v.currency} onChange={(e) => set("currency", e.target.value.toUpperCase().slice(0, 3))} className="h-10 w-20" />
          </div>
          <p className="text-xs text-muted-foreground">0 is fine: you&apos;ll get an organic-only plan.</p>
          {err("monthlyBudget")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gtm-hours">Hours per week for marketing</Label>
          <Input id="gtm-hours" inputMode="numeric" value={v.hoursPerWeek} onChange={(e) => set("hoursPerWeek", e.target.value)} className="h-10" />
          {err("hoursPerWeek")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gtm-geo">Where are your customers?</Label>
          <Input id="gtm-geo" value={v.geography} onChange={(e) => set("geography", e.target.value)} placeholder="e.g. US & UK, worldwide, Germany" className="h-10" />
          {err("geography")}
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Goal</legend>
        <div className="flex flex-wrap gap-2">
          {GTM_GOALS.map((g) => (
            <label key={g.value} className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-sm", v.goal === g.value ? "border-[var(--violet)] bg-[var(--violet)]/10 text-[var(--plum)]" : "border-border bg-white")}>
              <input type="radio" name="goal" value={g.value} checked={v.goal === g.value} onChange={() => set("goal", g.value)} className="sr-only" />
              {g.label}
            </label>
          ))}
        </div>
        {v.goal === "custom" ? <Input aria-label="Custom goal" value={v.customGoal} onChange={(e) => set("customGoal", e.target.value)} placeholder="e.g. 5 paid pilots in 6 weeks" className="h-10 max-w-md" /> : null}
        {err("customGoal")}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="gtm-skills">Your skills (comma separated)</Label>
          <Input id="gtm-skills" value={v.skills} onChange={(e) => set("skills", e.target.value)} placeholder="writing, design, video" className="h-10" />
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Selling to</legend>
          <div className="flex gap-2">
            {(["b2b", "b2c", "both"] as const).map((a) => (
              <label key={a} className={cn("cursor-pointer rounded-lg border px-3 py-2 text-sm uppercase", v.audienceType === a ? "border-[var(--violet)] bg-[var(--violet)]/10" : "border-border bg-white")}>
                <input type="radio" name="audience" value={a} checked={v.audienceType === a} onChange={() => set("audienceType", a)} className="sr-only" />
                {a === "both" ? "Both" : a}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Uses your project&apos;s research, customer quotes, competitors and pricing.</p>
        <Button type="submit" variant="gradient" className="h-10 px-5" disabled={pending || disabled}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {regenerate ? "Regenerate plan" : "Create marketing plan"} · {cost} credits
        </Button>
      </div>
    </form>
  );
}
