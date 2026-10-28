import { NextResponse } from "next/server";
import { VOICE_PITCH_MAX_MB } from "@/lib/voice";
import { getCurrentUser } from "@/server/auth/current-user";
import { pitchToProject } from "@/server/services/voice";
import { errorResponse, readAudioFile, sameOrigin } from "../shared";

export const dynamic = "force-dynamic";

/** A spoken idea pitch (recorded in the browser) → a new project. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    const file = await readAudioFile(await request.formData(), VOICE_PITCH_MAX_MB);
    if (file instanceof NextResponse) return file;
    const data = await pitchToProject(user.id, file.data);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
