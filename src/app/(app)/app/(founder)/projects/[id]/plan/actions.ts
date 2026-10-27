"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { generateBusinessModel, generateMvpPlan } from "@/server/services/planning";

export async function generateBusinessModelAction(projectId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  try {
    await generateBusinessModel(user.id, projectId);
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function generateMvpPlanAction(projectId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  try {
    await generateMvpPlan(user.id, projectId);
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
