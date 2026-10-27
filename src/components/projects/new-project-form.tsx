"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { createProjectAction, type FormState } from "@/app/(app)/app/(founder)/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewProjectForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createProjectAction, {});
  return (
    <form action={action} className="surface space-y-5 p-6">
      <div className="space-y-1.5">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" name="name" placeholder="e.g. Postgres ⇄ CRM sync for RevOps" className="h-11" required minLength={2} maxLength={80} />
        {state.fieldErrors?.name ? <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Describe the idea</Label>
        <Textarea
          id="description"
          name="description"
          rows={5}
          maxLength={2000}
          placeholder="Who has the problem, what they do today, and what you'd build. Rough notes are fine."
        />
        {state.fieldErrors?.description ? <p className="text-xs text-destructive">{state.fieldErrors.description[0]}</p> : null}
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" variant="gradient" className="h-10 px-5" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Create project
        </Button>
      </div>
    </form>
  );
}
