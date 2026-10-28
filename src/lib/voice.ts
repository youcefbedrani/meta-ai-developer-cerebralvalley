/** Client-safe helpers for transcribed recordings. */

export type VoiceTurn = { startMs: number; endMs: number; speaker: string | null; text: string };

/** Same normalization as the server's verbatim-quote check (jobs/research/verify.ts). */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** Strips the "Speaker A: " prefix the analysis saw in its notes. */
const stripSpeaker = (s: string) => s.replace(/^speaker [a-z0-9]+:\s*/i, "");

/**
 * The turn where a verified quote was said: a single turn containing it, or the first of two consecutive turns
 * it spans. Null when it can't be placed.
 */
export function turnForQuote(quote: string, turns: VoiceTurn[]): VoiceTurn | null {
  const q = normalize(stripSpeaker(quote));
  if (q.length < 8) return null;
  for (const t of turns) if (normalize(t.text).includes(q)) return t;
  for (let i = 0; i < turns.length - 1; i++) if (normalize(`${turns[i].text} ${turns[i + 1].text}`).includes(q)) return turns[i];
  return null;
}

export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const VOICE_UPLOAD_MAX_MB = 100;
export const VOICE_PITCH_MAX_MB = 15;
