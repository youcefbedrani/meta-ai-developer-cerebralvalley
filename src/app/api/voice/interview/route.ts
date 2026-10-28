import { NextResponse } from "next/server";
import { VOICE_UPLOAD_MAX_MB } from "@/lib/voice";
import { getCurrentUser } from "@/server/auth/current-user";
import { transcribeInterview } from "@/server/services/voice";
import { errorResponse, readAudioFile, sameOrigin } from "@/server/upload-routes";

export const dynamic = "force-dynamic";
// Long interviews: several 9-minute segments transcribed in turn, then the analysis.
export const maxDuration = 300;

/** Upload a customer-interview recording to an interview experiment: transcribe, analyse, keep the audio. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    const form = await request.formData();
    const experimentId = String(form.get("experimentId") ?? "");
    const file = await readAudioFile(form, VOICE_UPLOAD_MAX_MB);
    if (file instanceof NextResponse) return file;
    const data = await transcribeInterview(user.id, experimentId, file);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
