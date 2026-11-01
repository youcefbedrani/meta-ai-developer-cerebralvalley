import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { INNOVATION_LIMITS } from "@/lib/validation/innovation";
import { UserFacingError } from "@/server/data/errors";

/*
 * Turns uploads into what Muse Spark can read: evenly spaced frames from a video (ffmpeg), a downscaled
 * JPEG for photos (sharp) and the text of a PDF (unpdf). Everything runs in a private temp dir.
 */

function run(cmd: "ffmpeg" | "ffprobe", args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err = (err + d).slice(-2_000)));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exit ${code}: ${err.trim().split("\n").pop() ?? ""}`))));
  });
}

/** Frames spread across the video (skipping the very start and end), each a JPEG at most 1024 px wide. */
export async function sampleVideo(video: Buffer): Promise<{ durationSec: number; frames: { data: Buffer; atSec: number }[]; hasAudio: boolean }> {
  const dir = await mkdtemp(path.join(tmpdir(), "startum-scan-"));
  try {
    const src = path.join(dir, "input");
    await writeFile(src, video);
    let probe: { format?: { duration?: string }; streams?: { codec_type?: string }[] };
    try {
      probe = JSON.parse(await run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", src]));
    } catch {
      throw new UserFacingError("We couldn't read that video. Try an MP4 or MOV file.");
    }
    const durationSec = Math.max(0, Number(probe.format?.duration ?? 0));
    if (!probe.streams?.some((s) => s.codec_type === "video")) throw new UserFacingError("That file has no video track.");
    const usable = Math.min(durationSec || 1, INNOVATION_LIMITS.videoSeconds);
    const count = Math.max(1, Math.min(INNOVATION_LIMITS.framesPerVideo, Math.ceil(usable / 3)));
    const times = Array.from({ length: count }, (_, i) => +(((i + 0.5) * usable) / count).toFixed(2));
    const frames: { data: Buffer; atSec: number }[] = [];
    for (const [i, t] of times.entries()) {
      const out = path.join(dir, `f${i}.jpg`);
      await run("ffmpeg", ["-v", "error", "-ss", String(t), "-i", src, "-frames:v", "1", "-vf", "scale='min(1024,iw)':-2", "-q:v", "4", "-y", out]).catch(() => null);
      const data = await readFile(out).catch(() => null);
      if (data?.length) frames.push({ data, atSec: t });
    }
    if (!frames.length) throw new UserFacingError("We couldn't take any frames from that video.");
    return { durationSec, frames, hasAudio: !!probe.streams?.some((s) => s.codec_type === "audio") };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Photos and screenshots: rotated upright, at most 1280 px, JPEG. */
export async function normalizeImage(image: Buffer): Promise<Buffer> {
  try {
    return await sharp(image).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  } catch {
    throw new UserFacingError("We couldn't read one of the images. Use JPG, PNG or WebP.");
  }
}

/** The text of a PDF, page by page ("[p. 3] …"), cut to the scan's text budget. */
export async function pdfText(pdf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  let pages: string[];
  try {
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    pages = (await extractText(doc, { mergePages: false })).text as string[];
  } catch {
    throw new UserFacingError("We couldn't read that PDF.");
  }
  const text = pages
    .map((p, i) => `[p. ${i + 1}] ${p.replace(/\s+/g, " ").trim()}`)
    .filter((p) => p.length > 8)
    .join("\n");
  return text.slice(0, INNOVATION_LIMITS.pdfChars);
}
