"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { generateLaunchPlaybook } from "@/server/services/launch-playbook";

export async function generateLaunchPlaybookAction(projectId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  try {
    await generateLaunchPlaybook(user.id, projectId);
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
