import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { CREDIT_COSTS } from "@/lib/plans";
import { createProjectSchema } from "@/lib/validation/project";
import { asData, callStructured, UNTRUSTED_DATA_RULE, withCredits } from "@/server/ai/run";
import { prepareAudio, transcribe, transcriptAsNotes } from "@/server/ai/voice";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError, UserFacingError } from "@/server/data/errors";
import { getExperiment } from "@/server/data/experiments";
import { createProject, requireProject } from "@/server/data/projects";
import { listCompetitors } from "@/server/data/research";
import type { UserId } from "@/server/data/user-id";
import { enforceAiLimits } from "@/server/rate-limit";
import { saveUpload } from "@/server/storage";
import { analyzeInterviewTranscript } from "./validation";

export type VoiceRecording = typeof schema.voiceRecordings.$inferSelect;

/** 16 kHz × 16-bit mono WAV bytes per second, to size credits before transcribing. */
const WAV_BYTES_PER_MINUTE = 32_000 * 60;

/**
 * A customer-interview recording → speaker-labelled transcript (Muse Voice Transcribe, diarization) → the
 * interview analysis with verbatim-checked quotes. The audio is kept so each quote can be played back.
 */
export async function transcribeInterview(userId: UserId, experimentId: string, file: { data: Buffer; name: string }) {
  const e = await getExperiment(userId, experimentId);
  if (!e) throw new NotFoundError("Experiment");
  if (e.type !== "interview") throw new UserFacingError("Recordings can only be added to interview experiments.");
  await enforceAiLimits(userId);

  const { segments, playback } = await prepareAudio(file.data, { playback: true });
  const minutes = segments.reduce((n, s) => n + s.length, 0) / WAV_BYTES_PER_MINUTE;
  const credits = CREDIT_COSTS.voice_transcription * Math.max(1, Math.ceil(minutes / 5));
  // Names the speech model should spell right: the product and its competitors.
  const competitors = await listCompetitors(userId, e.projectId);
  const keywords = [e.projectName, ...competitors.map((c) => c.name)];

  const transcript = await withCredits(userId, "voice_transcription", credits, async () => {
    const t = await transcribe(segments, { userId, projectId: e.projectId, operation: "voice_transcription", mode: "DIARIZATION", keywords });
    if (t.text.trim().length < 40) throw new UserFacingError("We couldn't hear enough speech in that recording to analyse it.");
    return t;
  });
  const audioKey = playback ? await saveUpload("audio", "mp3", playback) : null;
  const [recording] = await getDb()
    .insert(schema.voiceRecordings)
    .values({ userId, projectId: e.projectId, experimentId: e.id, kind: "interview", fileName: file.name.slice(0, 200), audioKey, durationMs: transcript.durationMs, transcript: transcript.text, turns: transcript.turns })
    .returning();
  const analysis = await analyzeInterviewTranscript(userId, e.id, transcriptAsNotes(transcript), recording);
  return { recordingId: recording.id, durationMs: transcript.durationMs, turns: transcript.turns.length, analysis };
}

const pitchSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().min(20).max(2000),
  autopilotGoal: z.string().max(300).nullable(),
});

const PITCH_SYSTEM = `You turn a founder's spoken idea pitch (an automatic transcript) into a Startum project.
- name: a short, specific working name for the product (2-6 words), not a slogan.
- description: the idea in the founder's own terms, cleaned of filler words, organised as: who has the problem, what they do today, what the founder wants to build, and anything they said about pricing or their advantage. Keep every concrete detail they gave; add nothing they didn't say.
- autopilotGoal: if the founder asked a specific question or named a doubt (e.g. "would they pay $30?"), restate it as one question; otherwise null.
${UNTRUSTED_DATA_RULE}`;

/** A spoken idea pitch → transcript → a new project, ready for the Autopilot. The audio isn't kept. */
export async function pitchToProject(userId: UserId, data: Buffer) {
  await enforceAiLimits(userId);
  const { segments } = await prepareAudio(data, { playback: false });
  return withCredits(userId, "voice_pitch", CREDIT_COSTS.voice_pitch, async () => {
    const t = await transcribe(segments.slice(0, 1), { userId, operation: "voice_pitch", mode: "PUSH_TO_TALK" });
    if (t.text.trim().length < 20) throw new UserFacingError("We couldn't hear an idea in that recording. Try again a little closer to the microphone.");
    const pitch = await callStructured({
      userId,
      operation: "voice_pitch",
      tier: "fast",
      schema: pitchSchema,
      system: PITCH_SYSTEM,
      prompt: asData("transcript", t.text),
      mock: () => ({ name: "Voice pitch (mock)", description: t.text.slice(0, 2000).padEnd(20, "."), autopilotGoal: null }),
      maxOutputTokens: 2_000,
    });
    const project = await createProject(userId, createProjectSchema.parse({ name: pitch.name, description: pitch.description }));
    await getDb()
      .insert(schema.voiceRecordings)
      .values({ userId, projectId: project.id, kind: "pitch", durationMs: t.durationMs, transcript: t.text, turns: t.turns });
    return { projectId: project.id, name: pitch.name, transcript: t.text, autopilotGoal: pitch.autopilotGoal };
  });
}

export async function listExperimentRecordings(userId: UserId, experimentId: string): Promise<VoiceRecording[]> {
  return getDb()
    .select()
    .from(schema.voiceRecordings)
    .where(and(eq(schema.voiceRecordings.experimentId, experimentId), eq(schema.voiceRecordings.userId, userId)))
    .orderBy(desc(schema.voiceRecordings.createdAt));
}

/** A recording the user owns (for audio playback), or null. */
export async function getRecording(userId: UserId, id: string): Promise<VoiceRecording | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await getDb()
    .select()
    .from(schema.voiceRecordings)
    .where(and(eq(schema.voiceRecordings.id, id), eq(schema.voiceRecordings.userId, userId)))
    .limit(1);
  if (row?.projectId) await requireProject(userId, row.projectId);
  return row ?? null;
}
