"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { startMarketVoices } from "@/server/services/research";

export async function startMarketVoicesAction(projectId: string): Promise<ActionResult<{ jobId: string }>> {
  const user = await requireOnboardedUser();
  try {
    const data = await startMarketVoices(user.id, projectId);
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true, data };
  } catch (err) {
    return toActionError(err);
  }
}
