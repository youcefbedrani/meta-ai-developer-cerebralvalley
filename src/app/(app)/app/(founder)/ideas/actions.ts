"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ideaInputsSchema } from "@/lib/validation/ideas";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { convertIdeaToProject, setIdeaStatus } from "@/server/data/ideas";
import { generateIdeas } from "@/server/services/ideas";

export async function generateIdeasAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const user = await requireOnboardedUser();
  const parsed = ideaInputsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", code: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  try {
    const ideas = await generateIdeas(user.id, parsed.data);
    revalidatePath("/app/ideas");
    return { ok: true, data: { count: ideas.length } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setIdeaStatusAction(ideaId: string, status: "saved" | "generated" | "dismissed"): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  if (!["saved", "generated", "dismissed"].includes(status)) return { ok: false, error: "Invalid status", code: "validation" };
  try {
    await setIdeaStatus(user.id, ideaId, status);
    revalidatePath("/app/ideas", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function convertIdeaAction(ideaId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  let projectId: string;
  try {
    ({ projectId } = await convertIdeaToProject(user.id, ideaId));
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/app", "layout");
  redirect(`/app/projects/${projectId}`);
}
