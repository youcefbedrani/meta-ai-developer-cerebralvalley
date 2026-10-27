"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { addManualCompetitor, deleteCompetitor } from "@/server/data/competitors";
import { startCompetitorScan } from "@/server/services/research";
import type { ManualCompetitorInput } from "@/lib/validation/competitors";

async function run<T>(projectId: string, fn: (userId: Awaited<ReturnType<typeof requireOnboardedUser>>["id"]) => Promise<T>): Promise<ActionResult<T>> {
  const user = await requireOnboardedUser();
  try {
    const data = await fn(user.id);
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true, data };
  } catch (err) {
    return toActionError(err);
  }
}

export const startCompetitorScanAction = async (projectId: string) => run(projectId, (uid) => startCompetitorScan(uid, projectId));
export const addCompetitorAction = async (projectId: string, input: ManualCompetitorInput) => run(projectId, (uid) => addManualCompetitor(uid, projectId, input));
export const deleteCompetitorAction = async (projectId: string, competitorId: string) =>
  run(projectId, (uid) => deleteCompetitor(uid, projectId, z.uuid().parse(competitorId)));
