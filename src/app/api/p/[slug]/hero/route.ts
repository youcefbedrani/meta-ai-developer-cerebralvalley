import { getPublishedPage } from "@/server/data/landing-pages";
import { getPublishedHero } from "@/server/services/brand-visuals";
import { readUpload } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Public: the Muse Image hero of a published landing page. */
export async function GET(_request: Request, { params }: RouteContext<"/api/p/[slug]/hero">) {
  const page = await getPublishedPage((await params).slug);
  const heroId = page?.content.style?.heroImageId;
  const hero = page && heroId ? await getPublishedHero(page.projectId, heroId) : null;
  if (!hero) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(await readUpload(hero.imageKey)), { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" } });
}
