import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getLaunchVideo } from "@/server/services/launch-video";
import { readUpload } from "@/server/storage";

/** The founder's own launch video (?kind=thumb for the poster image, ?download=1 to save it), with range support for the player. */
export async function GET(request: Request, ctx: RouteContext<"/app/projects/[id]/videos/[videoId]/file">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id, videoId } = await ctx.params;
  const video = await getLaunchVideo(user.id, videoId).catch(() => null);
  if (!video || video.projectId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const q = new URL(request.url).searchParams;
  if (q.get("kind") === "thumb") {
    if (!video.thumbKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(await readUpload(video.thumbKey)), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600" } });
  }
  if (!video.videoKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await readUpload(video.videoKey);
  const headers: Record<string, string> = { "content-type": "video/mp4", "accept-ranges": "bytes", "cache-control": "private, max-age=3600" };
  if (q.get("download") === "1") headers["content-disposition"] = `attachment; filename="launch-video-${video.id.slice(0, 8)}.mp4"`;
  // Safari needs byte ranges to play video.
  const range = request.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
    return new NextResponse(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${data.length}`, "content-length": String(end - start + 1) } });
  }
  return new NextResponse(new Uint8Array(data), { headers: { ...headers, "content-length": String(data.length) } });
}
