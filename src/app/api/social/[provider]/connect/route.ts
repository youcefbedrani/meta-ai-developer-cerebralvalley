import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getCurrentUser } from "@/server/auth/current-user";
import { isConnector, SOCIAL_STATE_COOKIE, startConnect } from "@/server/services/social";

/** Starts connecting a LinkedIn, Meta (Facebook + Instagram) or TikTok account. ?back= is where to return. */
export async function GET(request: Request, ctx: RouteContext<"/api/social/[provider]/connect">) {
  const user = await getCurrentUser();
  const app = getEnv().APP_URL;
  if (!user) return NextResponse.redirect(new URL("/login", app));
  const { provider } = await ctx.params;
  if (!isConnector(provider)) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  const back = new URL(request.url).searchParams.get("back") ?? "/app";
  try {
    const { url, cookie } = startConnect(user.id, provider, back);
    const res = NextResponse.redirect(url);
    res.cookies.set(SOCIAL_STATE_COOKIE, cookie, { httpOnly: true, secure: getEnv().NODE_ENV === "production", sameSite: "lax", path: "/api/social", maxAge: 600 });
    return res;
  } catch {
    return NextResponse.redirect(new URL(`${back.startsWith("/app/") ? back : "/app"}?social=not_configured`, app));
  }
}
