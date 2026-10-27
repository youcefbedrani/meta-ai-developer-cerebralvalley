"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { startResearch } from "@/server/services/research";

export async function startResearchAction(projectId: string): Promise<ActionResult<{ jobId: string }>> {
  const user = await requireOnboardedUser();
  try {
    const result = await startResearch(user.id, projectId);
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true, data: result };
  } catch (err) {
    return toActionError(err);
  }
}
