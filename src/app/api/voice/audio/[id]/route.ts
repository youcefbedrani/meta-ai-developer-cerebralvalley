import { getCurrentUser } from "@/server/auth/current-user";
import { getRecording } from "@/server/services/voice";
import { readUpload } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Streams a recording's playback MP3 to its owner, with Range support so the player can jump to a quote. */
export async function GET(request: Request, { params }: RouteContext<"/api/voice/audio/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const recording = await getRecording(user.id, id).catch(() => null);
  if (!recording?.audioKey) return new Response("Not found", { status: 404 });
  const data = await readUpload(recording.audioKey);
  const headers = { "content-type": "audio/mpeg", "accept-ranges": "bytes", "cache-control": "private, max-age=3600" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (!range || (!range[1] && !range[2])) return new Response(new Uint8Array(data), { headers: { ...headers, "content-length": String(data.length) } });
  const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
  if (start >= data.length || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${data.length}` } });
  return new Response(new Uint8Array(data.subarray(start, end + 1)), {
    status: 206,
    headers: { ...headers, "content-range": `bytes ${start}-${end}/${data.length}`, "content-length": String(end - start + 1) },
  });
}
