import { NextResponse } from "next/server";
import { waitlistSignupSchema } from "@/lib/validation/experiments";
import { clientKey } from "@/server/client-ip";
import { addSignup } from "@/server/data/landing-pages";
import { enforceRateLimit, LIMITS, RateLimitError } from "@/server/rate-limit";

export async function POST(request: Request, ctx: RouteContext<"/api/p/[slug]/signup">) {
  const { slug } = await ctx.params;
  const parsed = waitlistSignupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  // Honeypot filled → pretend success, store nothing.
  if (parsed.data.website) return NextResponse.json({ ok: true });
  try {
    await enforceRateLimit(`signup:${clientKey(request)}`, LIMITS.waitlistPerMinute.limit, LIMITS.waitlistPerMinute.windowSeconds);
  } catch (err) {
    if (err instanceof RateLimitError) return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
    return NextResponse.json({ error: "Please try again later." }, { status: 503 });
  }
  const ok = await addSignup(slug, parsed.data.email, parsed.data.source ?? "direct", parsed.data.utm, parsed.data.consentTransfer === true);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "This page is not available." }, { status: 404 });
}
