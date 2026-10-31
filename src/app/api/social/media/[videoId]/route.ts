import { NextResponse } from "next/server";
import { getDb, schema } from "@/server/db/client";
import { verifyPublicVideo } from "@/server/services/social";
import { readUpload } from "@/server/storage";
import { eq } from "drizzle-orm";

/**
 * The MP4 for Facebook and Instagram to download while publishing. Public, but only with a valid signature
 * that expires (services/social.ts publicVideoUrl); nothing else is exposed.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/social/media/[videoId]">) {
  const { videoId } = await ctx.params;
  const q = new URL(request.url).searchParams;
  if (!/^[0-9a-f-]{36}$/.test(videoId) || !verifyPublicVideo(videoId, q.get("exp"), q.get("sig"))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [video] = await getDb().select({ videoKey: schema.launchVideos.videoKey }).from(schema.launchVideos).where(eq(schema.launchVideos.id, videoId)).limit(1);
  if (!video?.videoKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await readUpload(video.videoKey);
  return new NextResponse(new Uint8Array(data), { headers: { "content-type": "video/mp4", "content-length": String(data.length), "cache-control": "private, no-store" } });
}
