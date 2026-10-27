"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { addChannelResult, deleteChannelResult, setMarketingTaskStatus } from "@/server/data/marketing";
import {
  createAdExperiment,
  createChannel,
  createUtmLink,
  deleteAdExperiment,
  deleteAssetGroup,
  deleteChannel,
  linkAdExperimentToLab,
  saveAssetVersion,
  setAdExperimentStatus,
  updateChannel,
} from "@/server/data/marketing-studio";
import { generateMarketingPlan } from "@/server/services/marketing";
import { generateAsset, recommendNextStep } from "@/server/services/marketing-studio";

async function guard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/app", "layout");
    return { ok: true, data };
  } catch (err) {
    return toActionError(err);
  }
}

export async function generateMarketingPlanAction(projectId: string, setup: unknown) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await generateMarketingPlan(user.id, projectId, setup)));
}

export async function setTaskStatusAction(taskId: string, status: "todo" | "in_progress" | "done") {
  const user = await requireOnboardedUser();
  return guard(async () => setMarketingTaskStatus(user.id, taskId, status));
}

export async function addChannelResultAction(projectId: string, input: unknown) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await addChannelResult(user.id, projectId, input as never)));
}

export async function deleteChannelResultAction(resultId: string) {
  const user = await requireOnboardedUser();
  return guard(async () => deleteChannelResult(user.id, resultId));
}

/* Channels & budget */

export async function createChannelAction(projectId: string, input: unknown) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await createChannel(user.id, projectId, input as never)));
}

export async function updateChannelAction(channelId: string, input: unknown) {
  const user = await requireOnboardedUser();
  return guard(async () => updateChannel(user.id, channelId, input as never));
}

export async function deleteChannelAction(channelId: string) {
  const user = await requireOnboardedUser();
  return guard(async () => deleteChannel(user.id, channelId));
}

/* Assets */

export async function generateAssetAction(channelId: string, type: string) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await generateAsset(user.id, { channelId, type })));
}

export async function saveAssetVersionAction(assetId: string, input: { title?: string; content: unknown }) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await saveAssetVersion(user.id, assetId, input)));
}

export async function deleteAssetAction(groupId: string) {
  const user = await requireOnboardedUser();
  return guard(async () => deleteAssetGroup(user.id, groupId));
}

/* Ad tests */

export async function createAdExperimentAction(projectId: string, input: unknown) {
  const user = await requireOnboardedUser();
  return guard(async () => ({ id: (await createAdExperiment(user.id, projectId, input as never)).id }));
}

export async function setAdExperimentStatusAction(id: string, status: "running" | "completed" | "stopped", note?: string) {
  const user = await requireOnboardedUser();
  return guard(async () => setAdExperimentStatus(user.id, id, status, note));
}

export async function deleteAdExperimentAction(id: string) {
  const user = await requireOnboardedUser();
  return guard(async () => deleteAdExperiment(user.id, id));
}

export async function linkAdExperimentToLabAction(id: string) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await linkAdExperimentToLab(user.id, id)));
}

/* Tracking + recommendations */

export async function createUtmLinkAction(projectId: string, input: unknown) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await createUtmLink(user.id, projectId, input as never)));
}

export async function recommendNextStepAction(projectId: string) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await recommendNextStep(user.id, projectId)));
}
