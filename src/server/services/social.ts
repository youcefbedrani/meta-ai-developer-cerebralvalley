import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { ConfigError, getEnv, getIntegrationStatus } from "@/lib/env";
import { CAPTION_LIMIT, type SocialProvider } from "@/lib/validation/launch-video";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError, UserFacingError } from "@/server/data/errors";
import type { UserId } from "@/server/data/user-id";
import { enqueueResearch } from "@/server/jobs/queue";
import { encryptToken, sign, verifySignature } from "@/server/social/crypto";
import { CONNECTORS, connectorEnabled, connectorFor, type Connector } from "@/server/social/providers";
import { getLaunchVideo } from "./launch-video";

/*
 * Connecting social accounts (OAuth) and posting launch videos to them. Posting runs as a background job
 * (research queue, input.kind = "social_post"): uploads and Instagram processing take a while. Free: no credits.
 */

export const SOCIAL_STATE_COOKIE = "startum_social_oauth";
const appUrl = () => getEnv().APP_URL.replace(/\/$/, "");
export const redirectUri = (c: Connector) => `${appUrl()}/api/social/${c}/callback`;

export function isConnector(v: string): v is Connector {
  return v === "linkedin" || v === "meta" || v === "tiktok";
}

/** Which connectors this deployment has app credentials for. */
export function enabledConnectors(): Record<Connector, boolean> {
  return { linkedin: connectorEnabled("linkedin"), meta: connectorEnabled("meta"), tiktok: connectorEnabled("tiktok") };
}

/** Starts a login: the signed state goes in a short-lived cookie and is checked on the way back. */
export function startConnect(userId: UserId, connector: Connector, returnTo: string): { url: string; cookie: string } {
  if (!connectorEnabled(connector)) {
    const status = getIntegrationStatus(connector === "meta" ? "meta_social" : connector);
    throw new ConfigError(status.name, status.missing);
  }
  const state = randomBytes(18).toString("base64url");
  const back = returnTo.startsWith("/app/") ? returnTo : "/app";
  const payload = Buffer.from(JSON.stringify({ state, userId, connector, back, exp: Date.now() + 10 * 60_000 })).toString("base64url");
  return { url: CONNECTORS[connector].authorizeUrl(state, redirectUri(connector)), cookie: `${payload}.${sign(payload)}` };
}

/** Finishes a login: verifies the state, exchanges the code and saves (or refreshes) the accounts. */
export async function finishConnect(userId: UserId, connector: Connector, code: string, state: string, cookie: string | undefined): Promise<{ back: string; added: number }> {
  const [payload, signature] = (cookie ?? "").split(".");
  if (!payload || !signature || !verifySignature(payload, signature)) throw new UserFacingError("The sign-in expired. Please connect again.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { state: string; userId: string; connector: string; back: string; exp: number };
  if (data.state !== state || data.userId !== userId || data.connector !== connector || data.exp < Date.now()) throw new UserFacingError("The sign-in expired. Please connect again.");
  const accounts = await CONNECTORS[connector].exchange(code, redirectUri(connector));
  if (!accounts.length) throw new UserFacingError(connector === "meta" ? "No Facebook Page found on that account. Posting needs a Page (and an Instagram professional account linked to it for Reels)." : "No account was returned.");
  for (const a of accounts) {
    const values = { accessTokenEnc: encryptToken(a.accessToken), refreshTokenEnc: a.refreshToken ? encryptToken(a.refreshToken) : null, expiresAt: a.expiresAt ?? null, accountName: a.accountName.slice(0, 120) };
    await getDb()
      .insert(schema.socialConnections)
      .values({ userId, provider: a.provider, accountId: a.accountId, ...values })
      .onConflictDoUpdate({ target: [schema.socialConnections.userId, schema.socialConnections.provider, schema.socialConnections.accountId], set: values });
  }
  return { back: data.back, added: accounts.length };
}

export async function listConnections(userId: UserId) {
  return getDb()
    .select({ id: schema.socialConnections.id, provider: schema.socialConnections.provider, accountName: schema.socialConnections.accountName, expiresAt: schema.socialConnections.expiresAt })
    .from(schema.socialConnections)
    .where(eq(schema.socialConnections.userId, userId))
    .orderBy(schema.socialConnections.provider, schema.socialConnections.accountName);
}

export async function disconnect(userId: UserId, connectionId: string) {
  await getDb().delete(schema.socialConnections).where(and(eq(schema.socialConnections.id, connectionId), eq(schema.socialConnections.userId, userId)));
}

/** A public link to the MP4 that Facebook and Instagram download from; signed, valid for two hours. */
export function publicVideoUrl(videoId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 2 * 3600;
  return `${appUrl()}/api/social/media/${videoId}?exp=${exp}&sig=${sign(`${videoId}.${exp}`)}`;
}

export function verifyPublicVideo(videoId: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  try {
    return verifySignature(`${videoId}.${exp}`, sig);
  } catch {
    return false;
  }
}

/** Queues one post of a finished video to one of the founder's connected accounts. */
export async function startSocialPost(userId: UserId, videoId: string, connectionId: string, caption: string) {
  const video = await getLaunchVideo(userId, videoId);
  if (video.status !== "succeeded" || !video.videoKey) throw new UserFacingError("The video isn't ready yet.");
  const [conn] = await getDb().select().from(schema.socialConnections).where(and(eq(schema.socialConnections.id, connectionId), eq(schema.socialConnections.userId, userId))).limit(1);
  if (!conn) throw new NotFoundError("Connected account");
  if (!connectorEnabled(connectorFor(conn.provider))) throw new UserFacingError("Posting to this platform isn't set up on this server.");
  const text = caption.trim();
  if (!text) throw new UserFacingError("Write a caption first.");
  if (text.length > CAPTION_LIMIT[conn.provider]) throw new UserFacingError(`That caption is too long for this platform (max ${CAPTION_LIMIT[conn.provider]} characters).`);
  const redis = getIntegrationStatus("redis");
  if (!redis.configured) throw new ConfigError("redis", redis.missing);
  const db = getDb();
  const [busy] = await db
    .select({ id: schema.socialPosts.id })
    .from(schema.socialPosts)
    .where(and(eq(schema.socialPosts.videoId, video.id), eq(schema.socialPosts.connectionId, conn.id), sql`${schema.socialPosts.status} in ('queued', 'posting')`))
    .limit(1);
  if (busy) throw new UserFacingError("This video is already being posted to that account.");
  const [post] = await db.insert(schema.socialPosts).values({ userId, videoId: video.id, connectionId: conn.id, provider: conn.provider, caption: text }).returning({ id: schema.socialPosts.id });
  const [job] = await db
    .insert(schema.researchJobs)
    .values({ userId, projectId: video.projectId, status: "queued", currentStage: "queued", creditsReserved: 0, input: { kind: "social_post", postId: post.id } })
    .returning({ id: schema.researchJobs.id });
  try {
    await enqueueResearch(job.id);
  } catch {
    await db.update(schema.socialPosts).set({ status: "failed", error: "Could not queue the post." }).where(eq(schema.socialPosts.id, post.id));
    await db.update(schema.researchJobs).set({ status: "failed", error: "Could not queue the job.", finishedAt: new Date() }).where(eq(schema.researchJobs.id, job.id));
    throw new ConfigError("redis", ["REDIS_URL (queue unavailable — is Redis running?)"]);
  }
  return { postId: post.id };
}

export async function listSocialPosts(userId: UserId, projectId: string) {
  return getDb()
    .select({ id: schema.socialPosts.id, videoId: schema.socialPosts.videoId, provider: schema.socialPosts.provider, status: schema.socialPosts.status, url: schema.socialPosts.url, error: schema.socialPosts.error, createdAt: schema.socialPosts.createdAt, accountName: schema.socialConnections.accountName })
    .from(schema.socialPosts)
    .innerJoin(schema.launchVideos, eq(schema.launchVideos.id, schema.socialPosts.videoId))
    .leftJoin(schema.socialConnections, eq(schema.socialConnections.id, schema.socialPosts.connectionId))
    .where(and(eq(schema.socialPosts.userId, userId), eq(schema.launchVideos.projectId, projectId)))
    .orderBy(desc(schema.socialPosts.createdAt))
    .limit(50);
}

export type { SocialProvider };
