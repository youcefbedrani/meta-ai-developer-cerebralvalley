"use client";

import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateIdeasAction } from "@/app/(app)/app/(founder)/ideas/actions";
import { ConfigErrorNotice } from "@/components/config-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { IdeaInputsInput } from "@/lib/validation/ideas";

type Props = {
  defaults: IdeaInputsInput;
  cost: number;
  balance: number;
  aiConfigured: boolean;
  aiMissing: string[];
  startOpen: boolean;
};

const FIELDS: { name: keyof IdeaInputsInput; label: string; placeholder: string }[] = [
  { name: "niche", label: "Niche or industry", placeholder: "e.g. dental clinics, devtools, real estate" },
  { name: "customer", label: "Target customer", placeholder: "e.g. solo accountants, RevOps teams" },
  { name: "geography", label: "Geography", placeholder: "e.g. US, EU, worldwide" },
  { name: "skills", label: "Skills to use", placeholder: "e.g. React, sales, data analysis" },
  { name: "budget", label: "Budget", placeholder: "e.g. under $500" },
  { name: "businessModel", label: "Business model", placeholder: "e.g. subscription, usage-based" },
  { name: "timeAvailable", label: "Time available", placeholder: "e.g. 10 hours/week" },
];

export function IdeaGenerator({ defaults, cost, balance, aiConfigured, aiMissing, startOpen }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [values, setValues] = useState<IdeaInputsInput>(defaults);
  const [error, setError] = useState<{ message: string; missing?: string[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (name: keyof IdeaInputsInput, value: string | number) => setValues((v) => ({ ...v, [name]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await generateIdeasAction(values);
      if (!result.ok) {
        setError({ message: result.error, missing: result.code === "config" ? result.missing : undefined });
        return;
      }
      toast.success(`${result.data.count} ideas generated`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="surface ambient-glow overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-4 p-5 text-left" aria-expanded={open}>
        <span className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
            <Sparkles className="size-4" />
          </span>
          <span>
            <span className="block font-medium">Generate ideas</span>
            <span className="block text-sm text-muted-foreground">
              Tailored to your founder profile · {cost} credits · {balance} left this month
            </span>
          </span>
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <form onSubmit={submit} className="space-y-5 border-t border-border p-5">
          {!aiConfigured ? (
            <ConfigErrorNotice title="AI provider is not configured" missing={aiMissing} hint="Set AI_PROVIDER, AI_API_KEY and the two model names. For local testing without a key you can set AI_PROVIDER=mock (development only)." />
          ) : null}
          <div className="stagger grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={`idea-${f.name}`}>{f.label}</Label>
                <Input id={`idea-${f.name}`} value={String(values[f.name] ?? "")} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} className="h-10" />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="idea-complexity">Build complexity</Label>
              <select id="idea-complexity" value={values.complexity ?? "any"} onChange={(e) => set("complexity", e.target.value)} className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm">
                {["any", "low", "medium", "high"].map((c) => (
                  <option key={c} value={c} className="bg-popover capitalize">
                    {c === "any" ? "Any" : c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idea-constraints">Constraints</Label>
            <Textarea id="idea-constraints" rows={2} value={String(values.constraints ?? "")} placeholder="Anything to avoid: regulated industries, hardware, marketplaces…" onChange={(e) => set("constraints", e.target.value)} />
          </div>
          {error ? (
            error.missing ? (
              <ConfigErrorNotice title={error.message} missing={error.missing} />
            ) : (
              <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error.message}
              </p>
            )
          ) : null}
          <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">Ideas are AI-generated hypotheses, not research. Validate before you build.</p>
            <div className="flex items-center gap-3">
              <Label htmlFor="idea-count" className="text-sm text-muted-foreground">How many</Label>
              <select id="idea-count" value={Number(values.count ?? 4)} onChange={(e) => set("count", Number(e.target.value))} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm">
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n} className="bg-popover">{n}</option>
                ))}
              </select>
              <Button type="submit" variant="gradient" className="h-10 px-5" disabled={pending || !aiConfigured || balance < cost}>
                {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {pending ? "Generating…" : "Generate"}
              </Button>
            </div>
          </div>
          {balance < cost ? <p className="text-right text-xs text-warning">Not enough credits this month.</p> : null}
        </form>
      ) : null}
    </div>
  );
}
