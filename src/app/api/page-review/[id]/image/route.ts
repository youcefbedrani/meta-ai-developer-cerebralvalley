import { getCurrentUser } from "@/server/auth/current-user";
import { getPageReview } from "@/server/services/page-review";
import { readUpload } from "@/server/storage";

export const dynamic = "force-dynamic";

/** The reviewed screenshot, for its owner. */
export async function GET(_request: Request, { params }: RouteContext<"/api/page-review/[id]/image">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const review = await getPageReview(user.id, id).catch(() => null);
  if (!review) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(await readUpload(review.imageKey)), { headers: { "content-type": "image/png", "cache-control": "private, max-age=86400, immutable" } });
}
