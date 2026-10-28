"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { startAutopilot } from "@/server/services/autopilot";

export async function startAutopilotAction(projectId: string, goal: string): Promise<ActionResult<{ runId: string }>> {
  const user = await requireOnboardedUser();
  try {
    const result = await startAutopilot(user.id, projectId, { goal });
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true, data: result };
  } catch (err) {
    return toActionError(err);
  }
}
