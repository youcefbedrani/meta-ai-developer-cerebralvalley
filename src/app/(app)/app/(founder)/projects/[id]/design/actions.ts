"use server";

import { revalidatePath } from "next/cache";
import { requireFounder } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { restoreCodebaseVersion, saveCodebaseEdits, startCodebase, startCodebaseChange, startCodebaseFix } from "@/server/services/codebase";
import { startDesign, startDesignEdit } from "@/server/services/design";

export async function startDesignAction(projectId: string, input: unknown): Promise<ActionResult> {
  const user = await requireFounder();
  try {
    await startDesign(user.id, projectId, input);
    revalidatePath(`/app/projects/${projectId}/design`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function editDesignAction(projectId: string, screenId: string, instruction: string): Promise<ActionResult> {
  const user = await requireFounder();
  try {
    await startDesignEdit(user.id, projectId, screenId, { instruction });
    revalidatePath(`/app/projects/${projectId}/design`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

/** The founder approves the prototype: Muse Spark turns the screens into a runnable codebase. */
export async function startCodebaseAction(projectId: string): Promise<ActionResult> {
  const user = await requireFounder();
  try {
    await startCodebase(user.id, projectId);
    revalidatePath(`/app/projects/${projectId}/design`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

const codePath = (projectId: string) => `/app/projects/${projectId}/design/code`;

/** The founder's own edits to the generated code (saved as a new version, then type-checked). */
export async function saveCodeAction(projectId: string, baseId: string, changes: Record<string, string | null>): Promise<ActionResult> {
  const user = await requireFounder();
  try {
    await saveCodebaseEdits(user.id, projectId, baseId, changes);
    revalidatePath(codePath(projectId));
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

/** Muse Spark changes the code from a plain-language request. */
export async function changeCodeAction(projectId: string, instruction: string): Promise<ActionResult> {
  const user = await requireFounder();
  try {
    await startCodebaseChange(user.id, projectId, instruction);
    revalidatePath(codePath(projectId));
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

/** Muse Spark fixes the problems the check found. */
export async function fixCodeAction(projectId: string): Promise<ActionResult> {
  const user = await requireFounder();
  try {
    await startCodebaseFix(user.id, projectId);
    revalidatePath(codePath(projectId));
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function restoreCodeAction(projectId: string, reportId: string): Promise<ActionResult> {
  const user = await requireFounder();
  try {
    await restoreCodebaseVersion(user.id, projectId, reportId);
    revalidatePath(codePath(projectId));
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
