import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { refundCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { unsafeToUserId } from "@/server/data/user-id";
import { getDesignProvider } from "@/server/design";
import { designCreditRef, getDesignContext } from "@/server/services/design";
import type { DesignMeta } from "@/server/design";

type Job = typeof schema.researchJobs.$inferSelect;

const safe = (err: unknown) => {
  const msg = err instanceof Error ? err.message : "";
  if (/RATE_LIMITED|quota|429/i.test(msg)) return "Stitch's usage limit was reached. Your credits were refunded; try again later.";
  if (/AUTH|401|403|api key/i.test(msg)) return "Stitch rejected the API key. Your credits were refunded.";
  return "The design couldn't be generated. Your credits were refunded; please try again.";
};

/**
 * Generates (or edits) the job's screens one at a time with the design provider (Google Stitch).
 * Each screen succeeds or fails on its own and refunds its own credits on failure.
 */
export async function runDesignJob(job: Job): Promise<void> {
  const db = getDb();
  const userId = unsafeToUserId(job.userId);
  await db.update(schema.researchJobs).set({ status: "running", startedAt: new Date(), currentStage: "designing", error: null }).where(eq(schema.researchJobs.id, job.id));
  const rows = await db.select().from(schema.designScreens).where(and(eq(schema.designScreens.jobId, job.id), eq(schema.designScreens.status, "queued"))).orderBy(asc(schema.designScreens.position));
  let succeeded = 0;
  let lastError: string | null = null;
  try {
    const provider = getDesignProvider();
    const [project] = await db.select({ id: schema.projects.id, name: schema.projects.name, designProjectId: schema.projects.designProjectId }).from(schema.projects).where(eq(schema.projects.id, job.projectId));
    if (!project) throw new Error("The project no longer exists.");
    let designProjectId = project.designProjectId;
    if (!designProjectId && provider.name === "stitch") {
      designProjectId = await provider.createProject(project.name);
      await db.update(schema.projects).set({ designProjectId }).where(eq(schema.projects.id, project.id));
    }

    // The built-in designer draws from the project's data, not just the prompt.
    const ctx = provider.name === "builtin" ? (await getDesignContext(userId, project.id)).ctx : null;
    const meta = (name: string, prompt: string): DesignMeta | undefined => (ctx ? { ctx, name, purpose: prompt.match(/What this screen must do: (.+)/)?.[1] ?? "" } : undefined);

    for (const [i, row] of rows.entries()) {
      await db.update(schema.researchJobs).set({ currentStage: `screen ${i + 1} of ${rows.length}` }).where(eq(schema.researchJobs.id, job.id));
      await db.update(schema.designScreens).set({ status: "running" }).where(eq(schema.designScreens.id, row.id));
      try {
        let result;
        if (row.replacesId) {
          const [old] = await db.select().from(schema.designScreens).where(eq(schema.designScreens.id, row.replacesId));
          if (!old?.html) throw new Error("The screen to edit is gone.");
          result = await provider.edit(designProjectId, old.providerScreenId, old.html, row.prompt, row.device, meta(old.name, old.prompt));
        } else {
          result = await provider.generate(designProjectId, row.prompt, row.device, meta(row.name, row.prompt));
        }
        await db.transaction(async (tx) => {
          await tx.update(schema.designScreens).set({ status: "succeeded", html: result.html, imageUrl: result.imageUrl, providerScreenId: result.screenId, error: null }).where(eq(schema.designScreens.id, row.id));
          if (row.replacesId) await tx.update(schema.designScreens).set({ archived: true }).where(eq(schema.designScreens.id, row.replacesId));
        });
        succeeded++;
      } catch (err) {
        console.error(`[design] screen ${row.id} failed:`, err instanceof Error ? err.message : err);
        lastError = safe(err);
        await db.update(schema.designScreens).set({ status: "failed", error: lastError }).where(eq(schema.designScreens.id, row.id));
        await refundCredits(userId, designCreditRef(row.id), "design screen failed");
      }
    }
  } catch (err) {
    // Setup failed (no provider, no project): fail and refund every screen that hasn't run.
    console.error(`[design] job ${job.id} failed:`, err instanceof Error ? err.message : err);
    lastError = safe(err);
    for (const row of rows) {
      const [cur] = await db.select({ status: schema.designScreens.status }).from(schema.designScreens).where(eq(schema.designScreens.id, row.id));
      if (cur?.status === "succeeded") continue;
      await db.update(schema.designScreens).set({ status: "failed", error: lastError }).where(eq(schema.designScreens.id, row.id));
      await refundCredits(userId, designCreditRef(row.id), "design job failed");
    }
  }
  await db
    .update(schema.researchJobs)
    .set({ status: succeeded ? "succeeded" : "failed", currentStage: null, finishedAt: new Date(), error: succeeded ? null : lastError })
    .where(eq(schema.researchJobs.id, job.id));
}
