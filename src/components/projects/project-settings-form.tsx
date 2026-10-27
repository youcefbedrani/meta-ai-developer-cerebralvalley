"use client";

import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteProjectAction,
  setArchivedAction,
  updateProjectAction,
  type FormState,
} from "@/app/(app)/app/(founder)/projects/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_STAGES, type ProjectStage } from "@/lib/validation/project";

type Props = {
  project: { id: string; name: string; description: string; stage: ProjectStage; nextAction: string | null; status: "active" | "archived" };
};

export function ProjectSettingsForm({ project }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await updateProjectAction(project.id, prev, fd);
    if (result.ok) toast.success("Project saved");
    return result;
  }, {});
  const [busy, startTransition] = useTransition();
  const [confirmName, setConfirmName] = useState("");
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  return (
    <div className="space-y-6">
      <form action={action} className="surface space-y-5 p-6">
        <h2 className="font-medium">Project details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={project.name} className="h-10" />
            {err("name") ? <p className="text-xs text-destructive">{err("name")}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stage">Stage</Label>
            <select
              id="stage"
              name="stage"
              defaultValue={project.stage}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {PROJECT_STAGES.map((s) => (
                <option key={s.value} value={s.value} className="bg-popover">
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={4} defaultValue={project.description} />
          {err("description") ? <p className="text-xs text-destructive">{err("description")}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nextAction">Next action</Label>
          <Input id="nextAction" name="nextAction" defaultValue={project.nextAction ?? ""} placeholder="What's the single next step?" className="h-10" />
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" variant="gradient" className="h-10 px-5" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </form>

      <div className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium">{project.status === "archived" ? "Restore project" : "Archive project"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.status === "archived"
              ? "Move it back to your active projects."
              : "Hide it from your active list. Nothing is deleted."}
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-[10px]"
          disabled={busy}
          onClick={() =>
            startTransition(async () => {
              const r = await setArchivedAction(project.id, project.status !== "archived");
              if (r.error) toast.error(r.error);
              else toast.success(project.status === "archived" ? "Project restored" : "Project archived");
            })
          }
        >
          {project.status === "archived" ? <ArchiveRestore /> : <Archive />}
          {project.status === "archived" ? "Restore" : "Archive"}
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-destructive/30 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium text-destructive">Delete project</h2>
          <p className="mt-1 text-sm text-muted-foreground">Permanently deletes the project and everything in it.</p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button variant="destructive" className="rounded-[10px]" />}>
            <Trash2 /> Delete
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete “{project.name}”?</DialogTitle>
              <DialogDescription>
                This permanently deletes the project, its research, competitors and experiments. Type the project name to confirm.
              </DialogDescription>
            </DialogHeader>
            <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={project.name} aria-label="Project name" />
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
              <Button
                variant="destructive"
                disabled={confirmName !== project.name || busy}
                onClick={() =>
                  startTransition(async () => {
                    const r = await deleteProjectAction(project.id);
                    if (r?.error) toast.error(r.error);
                  })
                }
              >
                Delete forever
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
