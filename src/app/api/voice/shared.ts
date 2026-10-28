import "server-only";
import { NextResponse } from "next/server";
import { toActionError } from "@/server/action-result";

/** Uploads use the session cookie, so only accept them from our own pages (no cross-site form posts). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Reads the `file` part of a multipart upload, enforcing a size cap. */
export async function readAudioFile(form: FormData, maxMb: number): Promise<{ data: Buffer; name: string } | NextResponse> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, error: "Choose an audio file." }, { status: 400 });
  if (file.size > maxMb * 1024 * 1024) return NextResponse.json({ ok: false, error: `Audio files can be up to ${maxMb} MB.` }, { status: 413 });
  return { data: Buffer.from(await file.arrayBuffer()), name: file.name || "recording" };
}

/** Same user-safe error mapping as server actions; anything unexpected becomes a generic 500. */
export function errorResponse(err: unknown): NextResponse {
  try {
    const e = toActionError(err);
    return NextResponse.json(e, { status: e.code === "credits" ? 402 : e.code === "rate_limit" ? 429 : e.code === "not_found" ? 404 : 400 });
  } catch {
    console.error("[voice] unexpected error", err instanceof Error ? `${err.name}: ${err.message}` : err);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
