"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/action-result";
import { requireFounder } from "@/server/auth/current-user";
import { startLaunchVideo } from "@/server/services/launch-video";
import { disconnect, startSocialPost } from "@/server/services/social";

const page = (projectId: string) => `/app/projects/${projectId}/videos`;

export async function startLaunchVideoAction(projectId: string, angle: string, notes: string): Promise<ActionResult> {
  const user = await requireFounder();
  try {
    await startLaunchVideo(user.id, projectId, { angle, notes });
    revalidatePath(page(projectId));
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function postVideoAction(projectId: string, videoId: string, connectionId: string, caption: string): Promise<ActionResult> {
  const user = await requireFounder();
  try {
    await startSocialPost(user.id, videoId, connectionId, caption);
    revalidatePath(page(projectId));
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function disconnectSocialAction(projectId: string, connectionId: string): Promise<ActionResult> {
  const user = await requireFounder();
  try {
    await disconnect(user.id, connectionId);
    revalidatePath(page(projectId));
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
