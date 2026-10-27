"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createProjectSchema, projectIdSchema, updateProjectSchema } from "@/lib/validation/project";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { NotFoundError } from "@/server/data/errors";
import { createProject, deleteProject, setProjectStatus, updateProject } from "@/server/data/projects";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; ok?: boolean };

const fieldErrors = (err: z.ZodError) => z.flattenError(err).fieldErrors as Record<string, string[] | undefined>;

export async function createProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireOnboardedUser();
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const project = await createProject(user.id, parsed.data);
  revalidatePath("/app", "layout");
  redirect(`/app/projects/${project.id}`);
}

export async function updateProjectAction(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireOnboardedUser();
  const nextAction = String(formData.get("nextAction") ?? "").trim();
  const parsed = updateProjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    stage: formData.get("stage"),
    nextAction: nextAction || null,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  try {
    await updateProject(user.id, projectId, parsed.data);
  } catch (err) {
    if (err instanceof NotFoundError) return { error: "Project not found." };
    throw err;
  }
  revalidatePath(`/app/projects/${projectId}`, "layout");
  return { ok: true };
}

export async function setArchivedAction(projectId: string, archived: boolean): Promise<FormState> {
  const user = await requireOnboardedUser();
  if (!projectIdSchema.safeParse(projectId).success) return { error: "Project not found." };
  try {
    await setProjectStatus(user.id, projectId, archived ? "archived" : "active");
  } catch (err) {
    if (err instanceof NotFoundError) return { error: "Project not found." };
    throw err;
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function deleteProjectAction(projectId: string): Promise<FormState> {
  const user = await requireOnboardedUser();
  try {
    await deleteProject(user.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) return { error: "Project not found." };
    throw err;
  }
  revalidatePath("/app", "layout");
  redirect("/app/projects");
}
