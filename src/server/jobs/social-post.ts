import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db/client";
import { storyboardOf } from "@/server/services/launch-video";
import { publicVideoUrl } from "@/server/services/social";
import { decryptToken, encryptToken } from "@/server/social/crypto";
import { PUBLISHERS, refreshIfNeeded, SocialError } from "@/server/social/providers";
import { readUpload } from "@/server/storage";

type Job = typeof schema.researchJobs.$inferSelect;

/** Posts one launch video to one connected account (input.kind = "social_post"). */
export async function runSocialPostJob(job: Job): Promise<void> {
  const db = getDb();
  const postId = String((job.input as { postId?: string }).postId ?? "");
  await db.update(schema.researchJobs).set({ status: "running", startedAt: new Date(), currentStage: "posting" }).where(eq(schema.researchJobs.id, job.id));
  const [post] = await db.select().from(schema.socialPosts).where(eq(schema.socialPosts.id, postId)).limit(1);
  try {
    if (!post) throw new Error("The post is gone.");
    await db.update(schema.socialPosts).set({ status: "posting", error: null }).where(eq(schema.socialPosts.id, post.id));
    const [conn] = post.connectionId ? await db.select().from(schema.socialConnections).where(eq(schema.socialConnections.id, post.connectionId)).limit(1) : [];
    if (!conn) throw new SocialError("The account was disconnected.");
    const [video] = await db.select().from(schema.launchVideos).where(eq(schema.launchVideos.id, post.videoId)).limit(1);
    if (!video?.videoKey) throw new SocialError("The video file is gone.");

    let accessToken = decryptToken(conn.accessTokenEnc);
    const fresh = await refreshIfNeeded(conn.provider, conn.refreshTokenEnc ? decryptToken(conn.refreshTokenEnc) : null, conn.expiresAt);
    if (fresh) {
      accessToken = fresh.accessToken;
      await db.update(schema.socialConnections).set({ accessTokenEnc: encryptToken(fresh.accessToken), refreshTokenEnc: encryptToken(fresh.refreshToken), expiresAt: fresh.expiresAt }).where(eq(schema.socialConnections.id, conn.id));
    }
    const result = await PUBLISHERS[conn.provider]({
      accountId: conn.accountId,
      accessToken,
      caption: post.caption,
      title: storyboardOf(video)?.title ?? "Launch video",
      video: await readUpload(video.videoKey),
      publicUrl: publicVideoUrl(video.id),
    });
    await db.update(schema.socialPosts).set({ status: result.status, externalId: result.externalId, url: result.url }).where(eq(schema.socialPosts.id, post.id));
    await db.update(schema.researchJobs).set({ status: "succeeded", currentStage: null, finishedAt: new Date() }).where(eq(schema.researchJobs.id, job.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Posting failed.";
    console.error(`[social] post ${postId} failed:`, message);
    // Platform errors are useful to the founder (expired login, missing permission); anything else stays generic.
    const error = err instanceof SocialError ? message.slice(0, 400) : "Posting failed. Please try again.";
    if (post) await db.update(schema.socialPosts).set({ status: "failed", error }).where(eq(schema.socialPosts.id, post.id));
    await db.update(schema.researchJobs).set({ status: "failed", currentStage: null, error, finishedAt: new Date() }).where(eq(schema.researchJobs.id, job.id));
  }
}
