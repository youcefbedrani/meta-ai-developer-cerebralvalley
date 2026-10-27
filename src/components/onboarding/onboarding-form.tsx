"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { saveOnboardingAction } from "@/app/(onboarding)/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  BUDGETS,
  BUSINESS_MODELS,
  GOALS,
  onboardingSchema,
  parseTags,
  TECHNICAL_LEVELS,
  TIME_COMMITMENTS,
  type OnboardingAnswers,
  type OnboardingInput,
} from "@/lib/validation/onboarding";

type Option = { value: string; label: string };

export function OnboardingForm({ defaultValues, redirectTo }: { defaultValues?: OnboardingAnswers; redirectTo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<OnboardingInput, unknown, OnboardingAnswers>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: defaultValues ?? {
      skills: [],
      interests: [],
      targetMarkets: [],
      businessModels: [],
      goals: [],
      notes: "",
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveOnboardingAction(values);
      if (result.fieldErrors) {
        for (const [key, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.[0]) form.setError(key as FieldPath<OnboardingInput>, { message: messages[0] });
        }
        toast.error("Please fix the highlighted fields.");
        return;
      }
      toast.success("Profile saved");
      router.replace(redirectTo);
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Section title="Your skills" hint="What can you do yourself? e.g. React, copywriting, sales, data analysis" error={errors.skills?.message}>
        <Controller control={form.control} name="skills" render={({ field }) => <TagInput value={field.value} onChange={field.onChange} placeholder="Type a skill and press Enter" />} />
      </Section>

      <Section title="Technical level" error={errors.technicalLevel?.message}>
        <Controller control={form.control} name="technicalLevel" render={({ field }) => <ChoiceGroup options={TECHNICAL_LEVELS} value={field.value ? [field.value] : []} onChange={(v) => field.onChange(v[0])} />} />
      </Section>

      <Section title="Interests" hint="Industries or topics you care about" error={errors.interests?.message}>
        <Controller control={form.control} name="interests" render={({ field }) => <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. developer tools, fitness, real estate" />} />
      </Section>

      <Section title="Target markets" hint="Optional: who or where you'd like to sell" error={errors.targetMarkets?.message}>
        <Controller control={form.control} name="targetMarkets" render={({ field }) => <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. US SMBs, agencies, solo creators" />} />
      </Section>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Budget to start" error={errors.budget?.message}>
          <Controller control={form.control} name="budget" render={({ field }) => <ChoiceGroup options={BUDGETS} value={field.value ? [field.value] : []} onChange={(v) => field.onChange(v[0])} columns={1} />} />
        </Section>
        <Section title="Time available" error={errors.timePerWeek?.message}>
          <Controller control={form.control} name="timePerWeek" render={({ field }) => <ChoiceGroup options={TIME_COMMITMENTS} value={field.value ? [field.value] : []} onChange={(v) => field.onChange(v[0])} columns={1} />} />
        </Section>
      </div>

      <Section title="Preferred business models" hint="Pick any that fit" error={errors.businessModels?.message}>
        <Controller control={form.control} name="businessModels" render={({ field }) => <ChoiceGroup multiple options={BUSINESS_MODELS} value={field.value ?? []} onChange={field.onChange} />} />
      </Section>

      <Section title="Goals" error={errors.goals?.message}>
        <Controller control={form.control} name="goals" render={({ field }) => <ChoiceGroup multiple options={GOALS} value={field.value ?? []} onChange={field.onChange} />} />
      </Section>

      <Section title="Anything else?" hint="Optional: constraints, ideas you've already tried, deal-breakers" error={errors.notes?.message}>
        <Textarea rows={3} maxLength={1000} {...form.register("notes")} />
      </Section>

      <div className="flex justify-end pt-2">
        <Button type="submit" variant="gradient" className="h-11 px-6" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save and continue
        </Button>
      </div>
    </form>
  );
}

function Section({ title, hint, error, children }: { title: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <fieldset className={cn("surface p-5", error && "border-destructive/40")}>
      <legend className="sr-only">{title}</legend>
      <p className="font-medium">{title}</p>
      {hint ? <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p> : null}
      <div className="mt-4">{children}</div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </fieldset>
  );
}

function ChoiceGroup({
  options,
  value,
  onChange,
  multiple,
  columns = 2,
}: {
  options: readonly Option[];
  value: string[];
  onChange: (v: string[]) => void;
  multiple?: boolean;
  columns?: 1 | 2;
}) {
  return (
    <div role={multiple ? "group" : "radiogroup"} className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
      {options.map((o) => {
        const selected = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={selected}
            onClick={() =>
              onChange(multiple ? (selected ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])
            }
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5 text-left text-sm transition-colors hover:border-primary/40",
              selected && "border-primary/60 bg-primary/10",
            )}
          >
            {o.label}
            <span
              className={cn(
                "grid size-4.5 shrink-0 place-items-center border border-border",
                multiple ? "rounded-md" : "rounded-full",
                selected && "border-transparent bg-brand-gradient text-white",
              )}
            >
              {selected ? <Check className="size-3" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TagInput({ value = [], onChange, placeholder }: { value?: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const tags = parseTags(draft);
    if (tags.length) onChange([...new Set([...value, ...tags])]);
    setDraft("");
  };
  return (
    <div>
      {value.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {value.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-1.5 text-sm">
              {tag}
              <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))} className="rounded-full p-0.5 hover:bg-primary/20">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <Input
        value={draft}
        placeholder={placeholder}
        className="h-10"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
      />
    </div>
  );
}
