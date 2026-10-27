"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LandingContent } from "@/lib/validation/experiments";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import {
  addResult,
  cancelExperiment,
  completeExperiment,
  createExperiment,
  deleteExperiment,
  deleteResult,
  getExperiment,
  reopenExperiment,
  setDecision,
  startExperiment,
  updateExperiment,
} from "@/server/data/experiments";
import { NotFoundError } from "@/server/data/errors";
import {
  createLandingPage,
  deleteLandingPage,
  setLandingPublished,
  updateLandingPage,
} from "@/server/data/landing-pages";
import { getLatestValidationReport } from "@/server/data/research";
import { analyzeInterviewNotes, generateInterviewScript, generateLandingCopy } from "@/server/services/validation";

const refresh = () => revalidatePath("/app", "layout");

async function guard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (err) {
    return toActionError(err);
  }
}

export async function createExperimentAction(projectId: string, input: unknown): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  let id: string;
  try {
    ({ id } = await createExperiment(user.id, projectId, input as never));
  } catch (err) {
    return toActionError(err);
  }
  refresh();
  redirect(`/app/lab/${id}`);
}

export async function addRecommendedExperimentAction(projectId: string, index: number): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  let id: string;
  try {
    const report = await getLatestValidationReport(user.id, projectId);
    const rec = report?.report.recommendedExperiments[index];
    if (!rec) throw new NotFoundError("Recommended experiment");
    ({ id } = await createExperiment(user.id, projectId, {
      type: rec.type,
      title: rec.title.replace(/^\[Mock\]\s*/, ""),
      hypothesis: rec.hypothesis,
      successCriteria: rec.successCriteria,
    }));
  } catch (err) {
    return toActionError(err);
  }
  refresh();
  redirect(`/app/lab/${id}`);
}

export async function updateExperimentAction(id: string, input: unknown) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await updateExperiment(user.id, id, input as never)));
}

export async function experimentStatusAction(id: string, action: "start" | "cancel" | "reopen") {
  const user = await requireOnboardedUser();
  return guard(async () => {
    if (action === "start") await startExperiment(user.id, id);
    else if (action === "cancel") await cancelExperiment(user.id, id);
    else await reopenExperiment(user.id, id);
  });
}

export async function completeExperimentAction(id: string, input: unknown) {
  const user = await requireOnboardedUser();
  return guard(async () => completeExperiment(user.id, id, input as never));
}

export async function deleteExperimentAction(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  let projectId: string;
  try {
    ({ projectId } = await deleteExperiment(user.id, id));
  } catch (err) {
    return toActionError(err);
  }
  refresh();
  redirect(`/app/projects/${projectId}/validation`);
}

export async function addResultAction(id: string, input: unknown) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await addResult(user.id, id, input as never)));
}

export async function deleteResultAction(resultId: string) {
  const user = await requireOnboardedUser();
  return guard(async () => deleteResult(user.id, resultId));
}

export async function generateScriptAction(id: string) {
  const user = await requireOnboardedUser();
  return guard(async () => generateInterviewScript(user.id, id));
}

export async function analyzeNotesAction(id: string, notes: string) {
  const user = await requireOnboardedUser();
  return guard(async () => analyzeInterviewNotes(user.id, id, notes));
}

export async function setDecisionAction(projectId: string, input: unknown) {
  const user = await requireOnboardedUser();
  return guard(async () => setDecision(user.id, projectId, input as never));
}

/* ------------------------------------------------------- landing pages */

export async function generateLandingCopyAction(projectId: string) {
  const user = await requireOnboardedUser();
  return guard(async () => generateLandingCopy(user.id, projectId));
}

export async function createLandingPageAction(
  projectId: string,
  input: { content: LandingContent; slug: string; experimentId: string | null; successCriteria?: string },
): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  let pageId: string;
  try {
    let experimentId = input.experimentId;
    if (experimentId && !(await getExperiment(user.id, experimentId))) throw new NotFoundError("Experiment");
    if (!experimentId) {
      // Every landing page is an experiment: create one so results are tracked.
      const exp = await createExperiment(user.id, projectId, {
        type: "waitlist",
        title: `Waitlist: ${input.content.headline}`.slice(0, 160),
        hypothesis: `Visitors who match the target customer will join the waitlist for: ${input.content.subheadline}`.slice(0, 1000),
        successCriteria: input.successCriteria?.trim() || "At least 5% of unique visitors join the waitlist",
      });
      experimentId = exp.id;
    }
    ({ id: pageId } = await createLandingPage(user.id, projectId, { content: input.content, slug: input.slug, experimentId }));
  } catch (err) {
    return toActionError(err);
  }
  refresh();
  redirect(`/app/lab/pages/${pageId}`);
}

export async function updateLandingPageAction(pageId: string, input: { content: LandingContent; slug: string }) {
  const user = await requireOnboardedUser();
  return guard(async () => void (await updateLandingPage(user.id, pageId, input)));
}

export async function publishLandingPageAction(pageId: string, published: boolean) {
  const user = await requireOnboardedUser();
  return guard(async () => setLandingPublished(user.id, pageId, published));
}

export async function deleteLandingPageAction(pageId: string, projectId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  try {
    await deleteLandingPage(user.id, pageId);
  } catch (err) {
    return toActionError(err);
  }
  refresh();
  redirect(`/app/projects/${projectId}/validation`);
}
