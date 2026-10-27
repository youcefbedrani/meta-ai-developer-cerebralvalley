"use server";

import { revalidatePath } from "next/cache";
import { requireFounder } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
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
