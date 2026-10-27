"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createExperimentAction, updateExperimentAction } from "@/app/(app)/app/(founder)/lab/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EXPERIMENT_TYPES } from "@/lib/validation/experiments";

type Values = {
  type: string;
  title: string;
  hypothesis: string;
  audience: string;
  successCriteria: string;
  procedure: string;
  startDate: string;
  endDate: string;
};

type Props =
  | { mode: "create"; projects: { id: string; name: string }[]; defaultProjectId?: string }
  | { mode: "edit"; experimentId: string; initial: Values };

const empty: Values = { type: "interview", title: "", hypothesis: "", audience: "", successCriteria: "", procedure: "", startDate: "", endDate: "" };

export function ExperimentForm(props: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(props.mode === "edit" ? props.initial : empty);
  const [projectId, setProjectId] = useState(props.mode === "create" ? (props.defaultProjectId ?? props.projects[0]?.id ?? "") : "");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Values, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const err = (k: string) => errors[k]?.[0];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    start(async () => {
      const r = props.mode === "create" ? await createExperimentAction(projectId, values) : await updateExperimentAction(props.experimentId, values);
      if (r && !r.ok) {
        setError(r.error);
        setErrors(r.fieldErrors ?? {});
        return;
      }
      if (props.mode === "edit") {
        toast.success("Experiment saved");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="surface space-y-5 p-6" noValidate>
      {props.mode === "create" ? (
        <div className="space-y-1.5">
          <Label htmlFor="exp-project">Project</Label>
          <select id="exp-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm">
            {props.projects.map((p) => <option key={p.id} value={p.id} className="bg-popover">{p.name}</option>)}
          </select>
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
        <div className="space-y-1.5">
          <Label htmlFor="exp-title">Title</Label>
          <Input id="exp-title" value={values.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 10 problem interviews with freelancers" className="h-10" />
          {err("title") ? <p className="text-xs text-destructive">{err("title")}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-type">Type</Label>
          <select id="exp-type" value={values.type} onChange={(e) => set("type", e.target.value)} className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm">
            {EXPERIMENT_TYPES.map((t) => <option key={t.value} value={t.value} className="bg-popover">{t.label}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-hypothesis">Hypothesis</Label>
        <Textarea id="exp-hypothesis" rows={2} value={values.hypothesis} onChange={(e) => set("hypothesis", e.target.value)} placeholder="We believe [customer] struggles with [problem] and would [behaviour]." />
        {err("hypothesis") ? <p className="text-xs text-destructive">{err("hypothesis")}</p> : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="exp-audience">Audience</Label>
          <Input id="exp-audience" value={values.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Who you'll test with" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-success">Success criteria</Label>
          <Input id="exp-success" value={values.successCriteria} onChange={(e) => set("successCriteria", e.target.value)} placeholder="e.g. 6 of 10 describe the problem unprompted" className="h-10" />
          {err("successCriteria") ? <p className="text-xs text-destructive">{err("successCriteria")}</p> : null}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-procedure">Procedure</Label>
        <Textarea id="exp-procedure" rows={values.procedure.length > 300 ? 10 : 4} value={values.procedure} onChange={(e) => set("procedure", e.target.value)} placeholder="How you'll run it. For interviews you can generate a script on the experiment page." className="font-mono text-xs" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="exp-start">Start date</Label>
          <Input id="exp-start" type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-end">End date</Label>
          <Input id="exp-end" type="date" value={values.endDate} onChange={(e) => set("endDate", e.target.value)} className="h-10" />
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" variant="gradient" className="h-10 px-5" disabled={pending || (props.mode === "create" && !projectId)}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {props.mode === "create" ? "Create experiment" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
