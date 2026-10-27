"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { archiveSession } from "@/server/data/gold-mine";
import {
  continueToPains,
  createGoldLandingDraft,
  expandMarketNode,
  generateGoldIdeas,
  runDemandCheck,
  startFromIdea,
  startFromMarket,
  startPainMining,
} from "@/server/services/gold-mine";

const refresh = () => revalidatePath("/app/gold-mine", "layout");

async function guard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (err) {
    return toActionError(err);
  }
}

export async function expandNodeAction(nodeId: string) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await expandMarketNode(user.id, nodeId)));
}

export async function chooseNicheAction(nodeId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  let id: string;
  try {
    ({ id } = await startFromMarket(user.id, nodeId));
  } catch (err) {
    return toActionError(err);
  }
  refresh();
  redirect(`/app/gold-mine/${id}`);
}

export async function startFromIdeaAction(input: unknown): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  let id: string;
  try {
    ({ id } = await startFromIdea(user.id, input));
  } catch (err) {
    return toActionError(err);
  }
  refresh();
  redirect(`/app/gold-mine/${id}`);
}

export async function runDemandAction(sessionId: string) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await runDemandCheck(user.id, sessionId)));
}

export async function continueToPainsAction(sessionId: string, acknowledgeWeak: boolean) {
  const user = await requireOnboardedUser();
  return guard(async () => continueToPains(user.id, sessionId, acknowledgeWeak));
}

export async function startMiningAction(sessionId: string) {
  const user = await requireOnboardedUser();
  return guard(async () => startPainMining(user.id, sessionId));
}

export async function generateIdeasAction(sessionId: string) {
  const user = await requireOnboardedUser();
  return guard(async () => generateGoldIdeas(user.id, sessionId));
}

export async function landingDraftAction(sessionId: string, ideaId: string) {
  const user = await requireOnboardedUser();
  return guard(async () => createGoldLandingDraft(user.id, sessionId, ideaId));
}

export async function archiveSessionAction(sessionId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  try {
    await archiveSession(user.id, sessionId);
  } catch (err) {
    return toActionError(err);
  }
  refresh();
  redirect("/app/gold-mine");
}
