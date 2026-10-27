import { NextResponse } from "next/server";
import { clientKey } from "@/server/client-ip";
import { utmVisitSchema } from "@/lib/validation/experiments";
import { recordVisit } from "@/server/data/landing-pages";
import { getRedis } from "@/server/redis";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless/i;

/** Counts one visit per visitor per page per 30 minutes. Bots and prefetches are ignored. */
export async function POST(request: Request, ctx: RouteContext<"/api/p/[slug]/visit">) {
  const { slug } = await ctx.params;
  if (BOT.test(request.headers.get("user-agent") ?? "")) return NextResponse.json({ counted: false });
  try {
    const fresh = await getRedis().set(`visit:${slug}:${clientKey(request)}`, "1", "EX", 1800, "NX");
    if (!fresh) return NextResponse.json({ counted: false });
  } catch {
    return NextResponse.json({ counted: false }, { status: 503 });
  }
  const tags = utmVisitSchema.safeParse(await request.json().catch(() => ({})));
  const utm = tags.success ? { source: tags.data.source, ...tags.data.utm } : undefined;
  const counted = await recordVisit(slug, utm);
  return NextResponse.json({ counted }, { status: counted ? 200 : 404 });
}
