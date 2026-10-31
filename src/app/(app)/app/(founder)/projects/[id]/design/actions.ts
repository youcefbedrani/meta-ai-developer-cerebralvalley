"use server";

import { revalidatePath } from "next/cache";
import { requireFounder } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { startCodebase } from "@/server/services/codebase";
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
