"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/action-result";
import { requireFounder } from "@/server/auth/current-user";
import { createProjectFromInnovationIdea, deleteInnovationScan } from "@/server/services/innovation";

export async function createProjectFromIdeaAction(scanId: string, index: number): Promise<ActionResult<{ projectId: string }>> {
  const user = await requireFounder();
  try {
    const data = await createProjectFromInnovationIdea(user.id, scanId, index);
    revalidatePath("/app/projects");
    return { ok: true, data };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteScanAction(scanId: string): Promise<ActionResult> {
  const user = await requireFounder();
  try {
    await deleteInnovationScan(user.id, scanId);
    revalidatePath("/app/innovation");
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
