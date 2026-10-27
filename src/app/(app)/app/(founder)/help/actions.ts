"use server";

import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import type { HelpAnswer } from "@/lib/validation/help";
import { askHelp } from "@/server/services/help";

export async function askHelpAction(input: { question: string; history: { role: "user" | "assistant"; text: string }[]; pathname: string }): Promise<ActionResult<HelpAnswer>> {
  const user = await requireOnboardedUser();
  try {
    return { ok: true, data: await askHelp(user.id, input) };
  } catch (err) {
    return toActionError(err);
  }
}
