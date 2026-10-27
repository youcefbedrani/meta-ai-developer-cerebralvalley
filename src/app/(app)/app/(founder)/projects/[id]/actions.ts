"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { setProjectSharing } from "@/server/data/sharing";
import { startFullValidation } from "@/server/services/research";

export async function startValidationAction(projectId: string): Promise<ActionResult<{ runId: string }>> {
  const user = await requireOnboardedUser();
  try {
    const { runId } = await startFullValidation(user.id, projectId);
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true, data: { runId } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setSharingAction(projectId: string, on: boolean): Promise<ActionResult<{ token: string | null }>> {
  const user = await requireOnboardedUser();
  if (!z.uuid().safeParse(projectId).success) return { ok: false, error: "Project not found", code: "not_found" };
  try {
    const token = await setProjectSharing(user.id, projectId, on === true);
    revalidatePath(`/app/projects/${projectId}`);
    return { ok: true, data: { token } };
  } catch (err) {
    return toActionError(err);
  }
}
