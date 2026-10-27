import { NextResponse } from "next/server";
import { z } from "zod";
import { ConfigError } from "@/lib/env";
import { createSession, destroySession, isSameOrigin, SessionError } from "@/server/auth/session";

const bodySchema = z.object({ idToken: z.string().min(20).max(8192), remember: z.boolean().optional() });

/** POST: exchange a fresh Firebase ID token for a session cookie. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing sign-in token" }, { status: 400 });
  }
  try {
    await createSession(parsed.data.idToken, { remember: parsed.data.remember ?? true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ConfigError) {
      return NextResponse.json({ error: err.message, missing: err.missing }, { status: 503 });
    }
    if (err instanceof SessionError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[auth] session creation failed", err instanceof Error ? err.name : "unknown");
    return NextResponse.json({ error: "Could not sign you in. Please try again." }, { status: 500 });
  }
}

/** DELETE: sign out. */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
