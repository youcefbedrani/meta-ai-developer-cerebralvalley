"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { chooseBrandLogo, chooseBrandName, generateBrandKit } from "@/server/services/brand";
import { generateBrandVisuals } from "@/server/services/brand-visuals";

export async function generateBrandKitAction(projectId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  try {
    await generateBrandKit(user.id, projectId);
    revalidatePath(`/app/projects/${projectId}/brand`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function chooseBrandNameAction(projectId: string, index: number): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  try {
    await chooseBrandName(user.id, projectId, Number(index));
    revalidatePath(`/app/projects/${projectId}/brand`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function chooseBrandLogoAction(projectId: string, logo: unknown): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  try {
    await chooseBrandLogo(user.id, projectId, logo);
    revalidatePath(`/app/projects/${projectId}/brand`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function generateBrandVisualsAction(projectId: string): Promise<ActionResult<{ count: number }>> {
  const user = await requireOnboardedUser();
  try {
    const assets = await generateBrandVisuals(user.id, projectId);
    revalidatePath(`/app/projects/${projectId}/brand`);
    return { ok: true, data: { count: assets.length } };
  } catch (err) {
    return toActionError(err);
  }
}
