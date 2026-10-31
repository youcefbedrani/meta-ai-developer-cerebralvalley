import "server-only";
import { eq } from "drizzle-orm";
import { storyboardSchema, type VideoAngle } from "@/lib/validation/launch-video";
import { generateImage } from "@/server/ai/image";
import { buildLaunchVideoPrompt, LAUNCH_VIDEO_SYSTEM, mockStoryboard, sceneImagePrompt } from "@/server/ai/prompts/launch-video";
import { callStructured } from "@/server/ai/run";
import { refundCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { unsafeToUserId } from "@/server/data/user-id";
import { launchVideoContext, launchVideoCreditRef } from "@/server/services/launch-video";
import { readUpload, saveUpload } from "@/server/storage";
import { renderLaunchVideo } from "@/server/video/render";

type Job = typeof schema.researchJobs.$inferSelect;

const DEFAULT_PALETTE = { primary: "#4F46E5", secondary: "#0EA5E9", accent: "#F59E0B", background: "#F8FAFC", text: "#0F172A" };

/**
 * A launch video: Muse Spark writes the storyboard and the posts, Muse Image draws every scene (in parallel),
 * the worker renders the MP4 with ffmpeg. A scene whose image fails is dropped, as long as two remain.
 */
export async function runLaunchVideoJob(job: Job): Promise<void> {
  const db = getDb();
  const userId = unsafeToUserId(job.userId);
  const input = job.input as { angle?: VideoAngle; notes?: string };
  const stage = (currentStage: string) => db.update(schema.researchJobs).set({ currentStage }).where(eq(schema.researchJobs.id, job.id));
  const [video] = await db.select({ id: schema.launchVideos.id }).from(schema.launchVideos).where(eq(schema.launchVideos.jobId, job.id)).limit(1);
  await db.update(schema.researchJobs).set({ status: "running", startedAt: new Date(), currentStage: "Writing the storyboard", error: null }).where(eq(schema.researchJobs.id, job.id));
  if (video) await db.update(schema.launchVideos).set({ status: "running" }).where(eq(schema.launchVideos.id, video.id));
  try {
    if (!video) throw new Error("The video row is gone.");
    const ctx = await launchVideoContext(userId, job.projectId);
    const storyboard = await callStructured({
      userId,
      projectId: job.projectId,
      operation: "launch_video_script",
      tier: "smart",
      schema: storyboardSchema,
      system: LAUNCH_VIDEO_SYSTEM,
      prompt: buildLaunchVideoPrompt({
        angle: input.angle ?? "problem",
        notes: input.notes || null,
        project: { name: ctx.name, description: ctx.context.description, research: ctx.context.research },
        brand: ctx.brand ? { name: ctx.name, tagline: ctx.brand.tagline, voice: ctx.brand.voice, palette: ctx.brand.palette } : null,
        quotes: ctx.quotes,
        link: ctx.link,
      }),
      mock: mockStoryboard,
      maxOutputTokens: 6_000,
    });
    await db.update(schema.launchVideos).set({ script: storyboard as unknown as Record<string, unknown> }).where(eq(schema.launchVideos.id, video.id));

    await stage(`Drawing ${storyboard.scenes.length} scenes with Muse Image`);
    const palette = ctx.brand?.palette ?? DEFAULT_PALETTE;
    const usage = { userId, projectId: job.projectId, operation: "launch_video" };
    const drawn = await Promise.allSettled(storyboard.scenes.map((s) => generateImage(sceneImagePrompt(s.visual, palette), { ...usage, size: "1080x1920" })));
    const scenes = storyboard.scenes.flatMap((s, i) => (drawn[i].status === "fulfilled" ? [{ image: (drawn[i] as PromiseFulfilledResult<Buffer>).value, caption: s.caption, seconds: s.seconds }] : []));
    if (scenes.length < 2) throw new Error("Not enough scenes could be drawn.");

    await stage("Rendering the video");
    const logo = ctx.logoKey ? await readUpload(ctx.logoKey).catch(() => null) : null;
    const out = await renderLaunchVideo(scenes, { name: ctx.name, palette, logo }, { line: storyboard.cta.line, sub: storyboard.cta.sub, url: ctx.link });
    const [videoKey, thumbKey] = await Promise.all([saveUpload("videos", "mp4", out.mp4), saveUpload("images", "jpg", out.thumb)]);
    await db.update(schema.launchVideos).set({ status: "succeeded", videoKey, thumbKey, durationSec: out.seconds, error: null }).where(eq(schema.launchVideos.id, video.id));
    await db.update(schema.researchJobs).set({ status: "succeeded", currentStage: null, finishedAt: new Date() }).where(eq(schema.researchJobs.id, job.id));
  } catch (err) {
    console.error(`[launch-video] job ${job.id} failed:`, err instanceof Error ? err.message : err);
    const error = "The video couldn't be made. Your credits were refunded; please try again.";
    if (video) await db.update(schema.launchVideos).set({ status: "failed", error }).where(eq(schema.launchVideos.id, video.id));
    await db.update(schema.researchJobs).set({ status: "failed", currentStage: null, error, finishedAt: new Date() }).where(eq(schema.researchJobs.id, job.id));
    await refundCredits(userId, launchVideoCreditRef(job.id), "launch video failed");
  }
}
