import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getCurrentUser } from "@/server/auth/current-user";
import { finishConnect, isConnector, SOCIAL_STATE_COOKIE } from "@/server/services/social";

/** The platform sends the founder back here after they approve (or cancel) the connection. */
export async function GET(request: Request, ctx: RouteContext<"/api/social/[provider]/callback">) {
  const app = getEnv().APP_URL;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", app));
  const { provider } = await ctx.params;
  if (!isConnector(provider)) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  const q = new URL(request.url).searchParams;
  const store = await cookies();
  const cookie = store.get(SOCIAL_STATE_COOKIE)?.value;
  let back = "/app";
  let outcome = "connected";
  try {
    const code = q.get("code");
    if (!code) throw new Error(q.get("error_description") ?? q.get("error") ?? "cancelled");
    const done = await finishConnect(user.id, provider, code, q.get("state") ?? "", cookie);
    back = done.back;
  } catch (err) {
    console.error(`[social] ${provider} connect failed:`, err instanceof Error ? err.message : err);
    outcome = "failed";
    try {
      back = (JSON.parse(Buffer.from((cookie ?? "").split(".")[0] ?? "", "base64url").toString("utf8")) as { back?: string }).back ?? "/app";
    } catch {
      // Unreadable cookie: go to the dashboard.
    }
  }
  const res = NextResponse.redirect(new URL(`${back.startsWith("/app/") ? back : "/app"}?social=${outcome}`, app));
  res.cookies.delete({ name: SOCIAL_STATE_COOKIE, path: "/api/social" });
  return res;
}
