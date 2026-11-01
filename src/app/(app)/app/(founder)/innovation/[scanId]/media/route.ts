import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getInnovationScan, scanKeys } from "@/server/services/innovation";
import { readUpload } from "@/server/storage";

/** A frame or photo from the client's own scan (?key=images/…): only keys recorded on that scan are served. */
export async function GET(request: Request, ctx: RouteContext<"/app/innovation/[scanId]/media">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { scanId } = await ctx.params;
  const scan = await getInnovationScan(user.id, scanId).catch(() => null);
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!scan || !key.startsWith("images/") || !scanKeys(scan).has(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await readUpload(key).catch(() => null);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const type = key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new NextResponse(new Uint8Array(data), { headers: { "content-type": type, "cache-control": "private, max-age=86400" } });
}
