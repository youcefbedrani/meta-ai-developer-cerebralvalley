import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { parseStoredBrand } from "@/lib/brand-kit";
import { ConfigError, getEnv, getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { videoAngleSchema, type Storyboard } from "@/lib/validation/launch-video";
import { isImageConfigured } from "@/server/ai/image";
import { refundCredits, reserveCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError, UserFacingError } from "@/server/data/errors";
import { requireProject } from "@/server/data/projects";
import type { UserId } from "@/server/data/user-id";
import { enqueueResearch } from "@/server/jobs/queue";
import { enforceAiLimits } from "@/server/rate-limit";
import { getProjectCustomerLanguage } from "./gold-mine";
import { getProjectContext } from "./project-context";

/*
 * Launch videos for organic social: queued as a background job (research queue, input.kind = "launch_video")
 * because drawing the scenes and rendering take a minute or two.
 */

export type LaunchVideo = typeof schema.launchVideos.$inferSelect;
export const launchVideoCreditRef = (jobId: string) => `launch_video:${jobId}`;

/** The published landing page, if any: the link the video and the posts send people to. */
export async function projectLink(projectId: string): Promise<string | null> {
  const [page] = await getDb()
    .select({ slug: schema.landingPages.slug })
    .from(schema.landingPages)
    .where(and(eq(schema.landingPages.projectId, projectId), eq(schema.landingPages.published, true)))
    .limit(1);
  return page ? `${getEnv().APP_URL.replace(/\/$/, "")}/p/${page.slug}` : null;
}

/** Everything the storyboard and the renderer need about the product. */
export async function launchVideoContext(userId: UserId, projectId: string) {
  const { project, context } = await getProjectContext(userId, projectId);
  const brand = parseStoredBrand(project.brand);
  const [language, link, logo] = await Promise.all([
    getProjectCustomerLanguage(userId, project.id),
    projectLink(project.id),
    getDb()
      .select({ cutoutKey: schema.brandAssets.cutoutKey })
      .from(schema.brandAssets)
      .where(and(eq(schema.brandAssets.projectId, project.id), eq(schema.brandAssets.kind, "logo"), sql`${schema.brandAssets.cutoutKey} is not null`))
      .orderBy(desc(schema.brandAssets.createdAt))
      .limit(1),
  ]);
  const quotes = language.flatMap((g) => g.quotes.map((q) => q.quote)).filter((q) => q.length <= 220).slice(0, 10);
  const name = brand ? (brand.names[brand.chosen]?.name ?? brand.names[0].name) : project.name;
  return { project, context, brand, name, quotes, link, logoKey: logo[0]?.cutoutKey ?? null };
}

export async function startLaunchVideo(userId: UserId, projectId: string, raw: { angle: unknown; notes?: unknown }) {
  const angle = videoAngleSchema.parse(raw.angle);
  const notes = typeof raw.notes === "string" ? raw.notes.trim().slice(0, 600) : "";
  const project = await requireProject(userId, projectId);
  if (!isImageConfigured()) throw new ConfigError("ai", ["AI_BASE_URL=https://api.meta.ai/v1 and AI_API_KEY (videos use Muse Image)"]);
  const redis = getIntegrationStatus("redis");
  if (!redis.configured) throw new ConfigError("redis", redis.missing);
  await enforceAiLimits(userId);
  const db = getDb();
  const active = await db
    .select({ id: schema.researchJobs.id })
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.projectId, project.id), inArray(schema.researchJobs.status, ["queued", "running"]), sql`${schema.researchJobs.input}->>'kind' = 'launch_video'`))
    .limit(1);
  if (active.length) throw new UserFacingError("A video is already being made for this project. Wait for it to finish.");

  const [job] = await db
    .insert(schema.researchJobs)
    .values({ userId, projectId: project.id, status: "queued", currentStage: "queued", creditsReserved: CREDIT_COSTS.launch_video, input: { kind: "launch_video", angle, notes } })
    .returning({ id: schema.researchJobs.id });
  const [video] = await db.insert(schema.launchVideos).values({ userId, projectId: project.id, jobId: job.id, angle }).returning({ id: schema.launchVideos.id });
  try {
    await reserveCredits(userId, CREDIT_COSTS.launch_video, launchVideoCreditRef(job.id), "launch_video");
  } catch (err) {
    await db.delete(schema.launchVideos).where(eq(schema.launchVideos.id, video.id));
    await db.delete(schema.researchJobs).where(eq(schema.researchJobs.id, job.id));
    throw err;
  }
  try {
    await enqueueResearch(job.id);
  } catch {
    await refundCredits(userId, launchVideoCreditRef(job.id), "launch video could not be queued");
    await db.update(schema.launchVideos).set({ status: "failed", error: "Could not queue the job." }).where(eq(schema.launchVideos.id, video.id));
    await db.update(schema.researchJobs).set({ status: "failed", error: "Could not queue the job. Your credits were refunded.", finishedAt: new Date() }).where(eq(schema.researchJobs.id, job.id));
    throw new ConfigError("redis", ["REDIS_URL (queue unavailable — is Redis running?)"]);
  }
  return { videoId: video.id };
}

export async function listLaunchVideos(userId: UserId, projectId: string) {
  return getDb()
    .select({ video: schema.launchVideos, stage: schema.researchJobs.currentStage })
    .from(schema.launchVideos)
    .leftJoin(schema.researchJobs, eq(schema.researchJobs.id, schema.launchVideos.jobId))
    .where(and(eq(schema.launchVideos.projectId, projectId), eq(schema.launchVideos.userId, userId)))
    .orderBy(desc(schema.launchVideos.createdAt))
    .limit(20);
}

export async function getLaunchVideo(userId: UserId, videoId: string): Promise<LaunchVideo> {
  if (!/^[0-9a-f-]{36}$/.test(videoId)) throw new NotFoundError("Video");
  const [row] = await getDb().select().from(schema.launchVideos).where(and(eq(schema.launchVideos.id, videoId), eq(schema.launchVideos.userId, userId))).limit(1);
  if (!row) throw new NotFoundError("Video");
  return row;
}

export const storyboardOf = (v: Pick<LaunchVideo, "script">) => (v.script as unknown as Storyboard | null) ?? null;
