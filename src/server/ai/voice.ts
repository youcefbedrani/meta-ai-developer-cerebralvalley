import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ConfigError, getIntegrationEnv } from "@/lib/env";
import { UserFacingError } from "@/server/data/errors";
import type { UserId } from "@/server/data/user-id";
import { AIProviderError } from "./errors";
import { logUsage } from "./run";

/**
 * Meta Muse Voice Transcribe (batch): POST /v1/asr/transcribe with a JSON `request` part and a WAV `audio`
 * part. One request takes at most 10 minutes of 16 kHz mono 16-bit WAV, so longer audio is cut into segments.
 * Docs: https://dev.meta.ai/docs/speech-to-text/
 */
const DEFAULT_MODEL = "muse-voice-transcribe-1.0";
/** $3 per 1,000 minutes. */
const USD_PER_MINUTE = 0.003;
/** Under the 10-minute request limit, with room for the encoder's rounding. */
const SEGMENT_SECONDS = 540;
const MAX_RECORDING_SECONDS = 90 * 60;
const TIMEOUT_MS = 120_000;

export type Turn = { startMs: number; endMs: number; speaker: string | null; text: string };
export type Transcript = { text: string; turns: Turn[]; durationMs: number };
export type VoiceMode = "PUSH_TO_TALK" | "DIARIZATION";

export class AudioFormatError extends UserFacingError {
  constructor(message = "We couldn't read that audio file. Try an MP3, M4A, WAV or WebM recording.") {
    super(message);
  }
}

function voiceConfig() {
  const env = getIntegrationEnv();
  const base = env.AI_BASE_URL ?? "";
  if (!env.AI_API_KEY || !/^https:\/\/api\.meta\.ai\b/.test(base)) {
    throw new ConfigError("ai", ["AI_BASE_URL=https://api.meta.ai/v1 and AI_API_KEY (voice uses Meta Muse Voice Transcribe)"]);
  }
  return { url: `${new URL(base).origin}/v1/asr/transcribe`, key: env.AI_API_KEY, model: env.VOICE_MODEL || DEFAULT_MODEL };
}

/** True when voice features can run (Meta Model API configured). */
export function isVoiceConfigured(): boolean {
  try {
    voiceConfig();
    return true;
  } catch {
    return false;
  }
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err = (err + d).slice(-2_000)));
    p.on("error", (e) => reject(new ConfigError("ai", [`ffmpeg (not installed on the server: ${e.message})`])));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new AudioFormatError(err.includes("Invalid data") ? undefined : `We couldn't convert that audio file (${err.trim().split("\n").pop() ?? `ffmpeg exit ${code}`}).`))));
  });
}

/**
 * Converts any audio/video upload into transcription-ready WAV segments and, when asked, a small MP3 for playback.
 * Everything happens in a private temp dir that is removed afterwards.
 */
export async function prepareAudio(input: Buffer, opts: { playback: boolean }): Promise<{ segments: Buffer[]; playback: Buffer | null }> {
  const dir = await mkdtemp(path.join(tmpdir(), "startum-voice-"));
  try {
    const src = path.join(dir, "input");
    await writeFile(src, input);
    await ffmpeg(["-i", src, "-t", String(MAX_RECORDING_SECONDS), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "segment", "-segment_time", String(SEGMENT_SECONDS), path.join(dir, "seg-%03d.wav")]);
    const names = (await readdir(dir)).filter((n) => n.startsWith("seg-")).sort();
    if (!names.length) throw new AudioFormatError();
    const segments = await Promise.all(names.map((n) => readFile(path.join(dir, n))));
    let playback: Buffer | null = null;
    if (opts.playback) {
      await ffmpeg(["-i", src, "-t", String(MAX_RECORDING_SECONDS), "-vn", "-ac", "1", "-ar", "22050", "-c:a", "libmp3lame", "-b:a", "48k", path.join(dir, "playback.mp3")]);
      playback = await readFile(path.join(dir, "playback.mp3"));
    }
    return { segments, playback };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

type AsrResponse = { transcript?: string; audioDurationMs?: number; turns?: { startMs: number; endMs: number; transcript: string; speaker?: string }[]; error?: { message?: string } };

async function transcribeSegment(wav: Buffer, opts: { mode: VoiceMode; keywords: string[] }): Promise<AsrResponse> {
  const cfg = voiceConfig();
  const request = { model: cfg.model, audioEncoding: "WAV", mode: opts.mode, ...(opts.keywords.length ? { keywords: opts.keywords } : {}) };
  for (let attempt = 0; ; attempt++) {
    const form = new FormData();
    form.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
    form.append("audio", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "audio.wav");
    const res = await fetch(cfg.url, { method: "POST", headers: { authorization: `Bearer ${cfg.key}`, accept: "application/json" }, body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = (await res.json().catch(() => ({}))) as AsrResponse;
    if (res.ok) return body;
    // Rate / concurrency limits and processing-budget errors are worth a retry with backoff.
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1_000 * 2 ** attempt));
      continue;
    }
    console.error(`[voice] transcribe failed: HTTP ${res.status} ${body.error?.message ?? ""}`);
    if (res.status === 400) throw new AudioFormatError(`The speech service rejected the audio: ${body.error?.message ?? "bad request"}`);
    throw new AIProviderError();
  }
}

/**
 * Transcribes prepared segments in order and stitches them into one transcript with absolute turn times.
 * Speaker labels are scoped to one segment by the API, so they're prefixed per segment only when there is more than one.
 */
export async function transcribe(
  segments: Buffer[],
  opts: { userId: UserId | null; projectId?: string | null; operation: string; mode: VoiceMode; keywords?: string[] },
): Promise<Transcript> {
  // The API caps a keyword at 30 characters: long names are split into their distinctive words.
  const keywords = [
    ...new Set((opts.keywords ?? []).flatMap((k) => (k.trim().length <= 30 ? [k.trim()] : k.split(/[\s,/|·:-]+/).filter((w) => w.length >= 4))).filter((k) => k.length >= 2 && k.length <= 30)),
  ].slice(0, 30);
  const started = Date.now();
  const cfg = voiceConfig();
  let offset = 0;
  const turns: Turn[] = [];
  const texts: string[] = [];
  try {
    for (const [i, wav] of segments.entries()) {
      const r = await transcribeSegment(wav, { mode: opts.mode, keywords });
      // From the WAV size (16 kHz × 16-bit mono = 32,000 bytes/s): exact, unlike audioDurationMs which can omit silence.
      const segMs = Math.round(((wav.length - 44) / 32_000) * 1000);
      const prefix = segments.length > 1 ? `${i + 1}` : "";
      for (const t of r.turns ?? []) {
        if (!t.transcript?.trim()) continue;
        turns.push({ startMs: offset + t.startMs, endMs: offset + t.endMs, speaker: t.speaker ? `${t.speaker}${prefix}` : null, text: t.transcript.trim() });
      }
      if (r.transcript?.trim()) texts.push(r.transcript.trim());
      offset += segMs;
    }
  } catch (err) {
    await logUsage({ userId: opts.userId, projectId: opts.projectId, operation: opts.operation, provider: "meta", model: cfg.model, tokensIn: 0, tokensOut: 0, durationMs: Date.now() - started, status: "error", errorCode: err instanceof Error ? err.name : "unknown", costUsd: 0 });
    throw err;
  }
  await logUsage({
    userId: opts.userId,
    projectId: opts.projectId,
    operation: opts.operation,
    provider: "meta",
    model: cfg.model,
    tokensIn: 0,
    tokensOut: 0,
    durationMs: Date.now() - started,
    status: "success",
    costUsd: (offset / 60_000) * USD_PER_MINUTE,
  });
  return { text: texts.join("\n"), turns, durationMs: offset };
}

/** "A: …" lines when speakers are known, else the plain transcript. Used as the notes the analysis reads. */
export function transcriptAsNotes(t: Transcript): string {
  if (!t.turns.some((x) => x.speaker)) return t.text;
  return t.turns.map((x) => `${x.speaker ? `Speaker ${x.speaker}: ` : ""}${x.text}`).join("\n");
}
