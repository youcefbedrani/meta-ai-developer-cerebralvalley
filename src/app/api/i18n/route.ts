import { NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n";
import { getCurrentUser } from "@/server/auth/current-user";
import { getRedis } from "@/server/redis";
import { MAX_STRINGS, translateStrings } from "@/server/services/translate";
import { sameOrigin } from "@/server/upload-routes";

export const dynamic = "force-dynamic";

/** Per user: at most this many translation requests a minute (each up to MAX_STRINGS strings; most are cache hits). */
const PER_MINUTE = 30;

/** Translate interface strings for the page translator: { locale, strings } → { translations: { [en]: text } }. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { locale?: unknown; strings?: unknown } | null;
  if (!body || !isLocale(body.locale) || !Array.isArray(body.strings)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const strings = body.strings.filter((s): s is string => typeof s === "string").slice(0, MAX_STRINGS);
  try {
    const key = `i18n:rate:${user.id}:${Math.floor(Date.now() / 60_000)}`;
    const n = await getRedis().incr(key);
    if (n === 1) await getRedis().expire(key, 90);
    if (n > PER_MINUTE) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    return NextResponse.json({ translations: await translateStrings(user.id, body.locale, strings) });
  } catch (err) {
    console.error("[i18n] translate failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ translations: {} });
  }
}
