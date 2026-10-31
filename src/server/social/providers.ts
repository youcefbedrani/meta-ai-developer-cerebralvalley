import "server-only";
import { getIntegrationEnv, getIntegrationStatus } from "@/lib/env";
import type { SocialProvider } from "@/lib/validation/launch-video";

/*
 * Posting launch videos to the founder's own accounts. One connector per platform login:
 * - LinkedIn (Share on LinkedIn + Sign In with OpenID Connect): video upload, then a post on the member's profile.
 * - Meta (one Facebook Login): every Facebook Page the founder manages, and the Instagram business account linked to
 *   each Page. Facebook gets a Page video; Instagram gets a Reel (Meta fetches the video from a signed public URL).
 * - TikTok (Content Posting API, video.upload): the video lands in the founder's TikTok inbox to finish and post
 *   in the app — direct public posting needs TikTok's app audit.
 * Each connector is on only when its app credentials are configured.
 */

export type Connector = "linkedin" | "meta" | "tiktok";
export const CONNECTOR_PROVIDERS: Record<Connector, SocialProvider[]> = { linkedin: ["linkedin"], meta: ["facebook", "instagram"], tiktok: ["tiktok"] };
export const connectorFor = (p: SocialProvider): Connector => (p === "facebook" || p === "instagram" ? "meta" : p);

export type ConnectedAccount = { provider: SocialProvider; accountId: string; accountName: string; accessToken: string; refreshToken?: string | null; expiresAt?: Date | null };
export type PublishInput = { accountId: string; accessToken: string; caption: string; title: string; video: Buffer; publicUrl: string };
export type PublishResult = { status: "published" | "sent_to_inbox"; externalId: string; url: string | null };

export class SocialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialError";
  }
}

export function connectorEnabled(c: Connector): boolean {
  return getIntegrationStatus(c === "meta" ? "meta_social" : c).configured;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function json<T>(res: Response, what: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: unknown; message?: string; error_description?: string };
  if (!res.ok) {
    const detail = typeof body.error === "object" && body.error ? JSON.stringify(body.error).slice(0, 300) : (body.error_description ?? body.message ?? String(body.error ?? ""));
    throw new SocialError(`${what} failed (HTTP ${res.status}) ${detail}`.trim());
  }
  return body;
}

/* ---------------------------------- LinkedIn ---------------------------------- */

function linkedinVersion(): string {
  const v = getIntegrationEnv().LINKEDIN_API_VERSION;
  if (v && /^\d{6}$/.test(v)) return v;
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 2);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const linkedin = {
  authorizeUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({ response_type: "code", client_id: getIntegrationEnv().LINKEDIN_CLIENT_ID!, redirect_uri: redirectUri, state, scope: "openid profile w_member_social" });
    return `https://www.linkedin.com/oauth/v2/authorization?${q}`;
  },
  async exchange(code: string, redirectUri: string): Promise<ConnectedAccount[]> {
    const env = getIntegrationEnv();
    const token = await json<{ access_token: string; expires_in: number; refresh_token?: string }>(
      await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: env.LINKEDIN_CLIENT_ID!, client_secret: env.LINKEDIN_CLIENT_SECRET! }),
      }),
      "LinkedIn sign-in",
    );
    const me = await json<{ sub: string; name?: string }>(await fetch("https://api.linkedin.com/v2/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } }), "LinkedIn profile");
    return [{ provider: "linkedin", accountId: me.sub, accountName: me.name ?? "LinkedIn profile", accessToken: token.access_token, refreshToken: token.refresh_token ?? null, expiresAt: new Date(Date.now() + token.expires_in * 1000) }];
  },
  async publish(i: PublishInput): Promise<PublishResult> {
    const headers = { authorization: `Bearer ${i.accessToken}`, "linkedin-version": linkedinVersion(), "x-restli-protocol-version": "2.0.0", "content-type": "application/json" };
    const owner = `urn:li:person:${i.accountId}`;
    const init = await json<{ value: { video: string; uploadToken: string; uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[] } }>(
      await fetch("https://api.linkedin.com/rest/videos?action=initializeUpload", { method: "POST", headers, body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: i.video.length, uploadCaptions: false, uploadThumbnail: false } }) }),
      "LinkedIn video upload",
    );
    const etags: string[] = [];
    for (const part of init.value.uploadInstructions) {
      const res = await fetch(part.uploadUrl, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: new Uint8Array(i.video.subarray(part.firstByte, part.lastByte + 1)) });
      if (!res.ok) throw new SocialError(`LinkedIn video upload failed (HTTP ${res.status})`);
      etags.push(res.headers.get("etag") ?? "");
    }
    const fin = await fetch("https://api.linkedin.com/rest/videos?action=finalizeUpload", { method: "POST", headers, body: JSON.stringify({ finalizeUploadRequest: { video: init.value.video, uploadToken: init.value.uploadToken, uploadedPartIds: etags } }) });
    if (!fin.ok) await json(fin, "LinkedIn video finalize");
    // Wait for LinkedIn to process the video (usually seconds), then post.
    for (let n = 0; n < 30; n++) {
      const v = await json<{ status?: string }>(await fetch(`https://api.linkedin.com/rest/videos/${encodeURIComponent(init.value.video)}`, { headers }), "LinkedIn video status");
      if (v.status === "AVAILABLE") break;
      if (v.status === "PROCESSING_FAILED") throw new SocialError("LinkedIn couldn't process the video.");
      await sleep(4000);
    }
    const res = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers,
      body: JSON.stringify({ author: owner, commentary: i.caption, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, content: { media: { title: i.title, id: init.value.video } }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }),
    });
    if (!res.ok) await json(res, "LinkedIn post");
    const urn = res.headers.get("x-restli-id") ?? "";
    return { status: "published", externalId: urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : null };
  },
};

/* --------------------------- Meta: Facebook + Instagram --------------------------- */

const graphVersion = () => getIntegrationEnv().META_GRAPH_VERSION || "v24.0";
const graph = (path: string) => `https://graph.facebook.com/${graphVersion()}${path}`;

const meta = {
  authorizeUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({ client_id: getIntegrationEnv().META_APP_ID!, redirect_uri: redirectUri, state, response_type: "code", scope: "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management" });
    return `https://www.facebook.com/${graphVersion()}/dialog/oauth?${q}`;
  },
  async exchange(code: string, redirectUri: string): Promise<ConnectedAccount[]> {
    const env = getIntegrationEnv();
    const short = await json<{ access_token: string }>(await fetch(graph(`/oauth/access_token?${new URLSearchParams({ client_id: env.META_APP_ID!, client_secret: env.META_APP_SECRET!, redirect_uri: redirectUri, code })}`)), "Facebook sign-in");
    const long = await json<{ access_token: string }>(await fetch(graph(`/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: env.META_APP_ID!, client_secret: env.META_APP_SECRET!, fb_exchange_token: short.access_token })}`)), "Facebook token");
    const pages = await json<{ data: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[] }>(
      await fetch(graph(`/me/accounts?${new URLSearchParams({ fields: "id,name,access_token,instagram_business_account{id,username}", access_token: long.access_token })}`)),
      "Facebook Pages",
    );
    // Page tokens obtained from a long-lived user token don't expire.
    return pages.data.flatMap((p) => [
      { provider: "facebook" as const, accountId: p.id, accountName: p.name, accessToken: p.access_token },
      ...(p.instagram_business_account ? [{ provider: "instagram" as const, accountId: p.instagram_business_account.id, accountName: p.instagram_business_account.username ? `@${p.instagram_business_account.username}` : `Instagram (${p.name})`, accessToken: p.access_token }] : []),
    ]);
  },
  async publishFacebook(i: PublishInput): Promise<PublishResult> {
    const res = await json<{ id: string }>(
      await fetch(`https://graph-video.facebook.com/${graphVersion()}/${i.accountId}/videos`, { method: "POST", body: new URLSearchParams({ file_url: i.publicUrl, description: i.caption, title: i.title, access_token: i.accessToken }) }),
      "Facebook video post",
    );
    return { status: "published", externalId: res.id, url: `https://www.facebook.com/${i.accountId}/videos/${res.id}/` };
  },
  async publishInstagram(i: PublishInput): Promise<PublishResult> {
    const container = await json<{ id: string }>(
      await fetch(graph(`/${i.accountId}/media`), { method: "POST", body: new URLSearchParams({ media_type: "REELS", video_url: i.publicUrl, caption: i.caption, share_to_feed: "true", access_token: i.accessToken }) }),
      "Instagram Reel upload",
    );
    // Instagram downloads and processes the video before it can be published.
    for (let n = 0; ; n++) {
      const s = await json<{ status_code?: string }>(await fetch(graph(`/${container.id}?${new URLSearchParams({ fields: "status_code", access_token: i.accessToken })}`)), "Instagram status");
      if (s.status_code === "FINISHED") break;
      if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new SocialError("Instagram couldn't process the video.");
      if (n > 40) throw new SocialError("Instagram took too long to process the video.");
      await sleep(5000);
    }
    const media = await json<{ id: string }>(await fetch(graph(`/${i.accountId}/media_publish`), { method: "POST", body: new URLSearchParams({ creation_id: container.id, access_token: i.accessToken }) }), "Instagram publish");
    const link = await json<{ permalink?: string }>(await fetch(graph(`/${media.id}?${new URLSearchParams({ fields: "permalink", access_token: i.accessToken })}`)), "Instagram link").catch(() => ({ permalink: undefined }));
    return { status: "published", externalId: media.id, url: link.permalink ?? null };
  },
};

/* ------------------------------------ TikTok ------------------------------------ */

const tiktok = {
  authorizeUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({ client_key: getIntegrationEnv().TIKTOK_CLIENT_KEY!, response_type: "code", scope: "user.info.basic,video.upload", redirect_uri: redirectUri, state });
    return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
  },
  async token(params: Record<string, string>) {
    const env = getIntegrationEnv();
    return json<{ access_token: string; open_id: string; refresh_token: string; expires_in: number }>(
      await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY!, client_secret: env.TIKTOK_CLIENT_SECRET!, ...params }) }),
      "TikTok sign-in",
    );
  },
  async exchange(code: string, redirectUri: string): Promise<ConnectedAccount[]> {
    const t = await tiktok.token({ code, grant_type: "authorization_code", redirect_uri: redirectUri });
    const me = await json<{ data?: { user?: { display_name?: string } } }>(await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", { headers: { authorization: `Bearer ${t.access_token}` } }), "TikTok profile").catch(() => ({ data: undefined }));
    return [{ provider: "tiktok", accountId: t.open_id, accountName: me.data?.user?.display_name ?? "TikTok account", accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: new Date(Date.now() + t.expires_in * 1000) }];
  },
  async refresh(refreshToken: string) {
    const t = await tiktok.token({ grant_type: "refresh_token", refresh_token: refreshToken });
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: new Date(Date.now() + t.expires_in * 1000) };
  },
  async publish(i: PublishInput): Promise<PublishResult> {
    const init = await json<{ data: { publish_id: string; upload_url: string } }>(
      await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
        method: "POST",
        headers: { authorization: `Bearer ${i.accessToken}`, "content-type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ source_info: { source: "FILE_UPLOAD", video_size: i.video.length, chunk_size: i.video.length, total_chunk_count: 1 } }),
      }),
      "TikTok upload",
    );
    const res = await fetch(init.data.upload_url, { method: "PUT", headers: { "content-type": "video/mp4", "content-range": `bytes 0-${i.video.length - 1}/${i.video.length}` }, body: new Uint8Array(i.video) });
    if (!res.ok) throw new SocialError(`TikTok video upload failed (HTTP ${res.status})`);
    return { status: "sent_to_inbox", externalId: init.data.publish_id, url: null };
  },
};

export const CONNECTORS = {
  linkedin: { authorizeUrl: linkedin.authorizeUrl, exchange: linkedin.exchange },
  meta: { authorizeUrl: meta.authorizeUrl, exchange: meta.exchange },
  tiktok: { authorizeUrl: tiktok.authorizeUrl, exchange: tiktok.exchange },
} satisfies Record<Connector, { authorizeUrl: (state: string, redirectUri: string) => string; exchange: (code: string, redirectUri: string) => Promise<ConnectedAccount[]> }>;

export const PUBLISHERS: Record<SocialProvider, (i: PublishInput) => Promise<PublishResult>> = {
  linkedin: linkedin.publish,
  facebook: meta.publishFacebook,
  instagram: meta.publishInstagram,
  tiktok: tiktok.publish,
};

/** Fresh tokens for providers whose access tokens expire quickly (TikTok: 24 h). */
export async function refreshIfNeeded(provider: SocialProvider, refreshToken: string | null, expiresAt: Date | null) {
  if (provider !== "tiktok" || !refreshToken || !expiresAt || expiresAt.getTime() - Date.now() > 10 * 60_000) return null;
  return tiktok.refresh(refreshToken);
}
