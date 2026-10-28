import { getCurrentUser } from "@/server/auth/current-user";
import { getBrandAsset } from "@/server/services/brand-visuals";
import { readUpload } from "@/server/storage";

export const dynamic = "force-dynamic";

/** A generated brand image for its owner. `?v=cutout` → the SAM cut-out logo; `?download=1` → save as a file. */
export async function GET(request: Request, { params }: RouteContext<"/api/images/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const asset = await getBrandAsset(user.id, id).catch(() => null);
  if (!asset) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const key = url.searchParams.get("v") === "cutout" && asset.cutoutKey ? asset.cutoutKey : asset.imageKey;
  const data = await readUpload(key);
  const name = `${asset.kind}${asset.channel ? `-${asset.channel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}${key === asset.cutoutKey ? "-transparent" : ""}.png`;
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": "image/png",
      "cache-control": "private, max-age=86400, immutable",
      ...(url.searchParams.get("download") ? { "content-disposition": `attachment; filename="${name}"` } : {}),
    },
  });
}
