"use server";

import { revalidatePath } from "next/cache";
import { requireFounder } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { getAiUsage, type AiUsage } from "@/server/ai/budget";
import { deleteCopilotThread, sendCopilotMessage, type CopilotReply } from "@/server/services/copilot";

export async function sendCopilotMessageAction(input: unknown): Promise<ActionResult<CopilotReply & { usage: AiUsage }>> {
  const user = await requireFounder();
  try {
    const reply = await sendCopilotMessage(user.id, input);
    return { ok: true, data: { ...reply, usage: await getAiUsage(user.id, user.plan) } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteCopilotThreadAction(threadId: string): Promise<ActionResult> {
  const user = await requireFounder();
  try {
    await deleteCopilotThread(user.id, threadId);
    revalidatePath("/app/copilot");
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
