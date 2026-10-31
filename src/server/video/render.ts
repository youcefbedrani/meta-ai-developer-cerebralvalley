import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";

/*
 * Renders a launch video: vertical 1080×1920, 30 fps, H.264 + a silent AAC track (some platforms reject videos
 * without audio). Each scene is a Muse Image picture with a slow Ken Burns zoom and its caption fading in on
 * top; scenes cross-fade; the last card shows the brand, the call to action and the link. Needs ffmpeg.
 */

const W = 1080;
const H = 1920;
const FPS = 30;
const FADE = 0.35;
const END_SECONDS = 3;
const FONT = "DejaVu Sans, Arial, Helvetica, sans-serif";

export type RenderScene = { image: Buffer; caption: string; seconds: number };
export type RenderBrand = { name: string; palette: { primary: string; secondary: string; accent: string; background: string; text: string }; logo: Buffer | null };
export type RenderEndCard = { line: string; sub: string; url: string | null };

const xml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if ((line + " " + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

/** The caption layer: a rounded card in the lower-middle, plus the brand name at the top. */
function captionSvg(caption: string, brand: RenderBrand): string {
  const size = caption.length > 60 ? 58 : caption.length > 36 ? 66 : 76;
  const lines = wrap(caption, Math.floor((W * 0.78) / (size * 0.56)));
  const lineH = Math.round(size * 1.22);
  const boxH = lines.length * lineH + 80;
  const boxY = Math.round(H * 0.6 - boxH / 2);
  const text = lines.map((l, i) => `<tspan x="${W / 2}" dy="${i === 0 ? 0 : lineH}">${xml(l)}</tspan>`).join("");
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${W * 0.07}" y="${boxY}" width="${W * 0.86}" height="${boxH}" rx="36" fill="${brand.palette.text}" fill-opacity="0.78"/>
  <rect x="${W * 0.07}" y="${boxY}" width="14" height="${boxH}" rx="7" fill="${brand.palette.accent}"/>
  <text x="${W / 2}" y="${boxY + 40 + size}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${size}" fill="#ffffff">${text}</text>
  <rect x="60" y="96" width="${Math.min(W - 120, 72 + brand.name.length * 26)}" height="76" rx="38" fill="#000000" fill-opacity="0.35"/>
  <circle cx="102" cy="134" r="14" fill="${brand.palette.accent}"/>
  <text x="130" y="148" font-family="${FONT}" font-weight="700" font-size="40" fill="#ffffff">${xml(brand.name)}</text>
</svg>`;
}

async function endCard(brand: RenderBrand, end: RenderEndCard): Promise<Buffer> {
  const p = brand.palette;
  // Bold DejaVu is about 0.62 em wide per character: fit the name in 86% of the width.
  const nameSize = Math.round(Math.min(120, (W * 0.86) / (Math.max(4, brand.name.length) * 0.62)));
  const lineLines = wrap(end.line, 18);
  const subLines = wrap(end.sub, 30);
  let y = brand.logo ? 980 : 760;
  const parts: string[] = [];
  parts.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${nameSize}" fill="#ffffff">${xml(brand.name)}</text>`);
  y += 150;
  for (const l of lineLines) {
    parts.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="72" fill="${p.accent}">${xml(l)}</text>`);
    y += 88;
  }
  y += 20;
  for (const l of subLines) {
    parts.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="46" fill="#ffffff" fill-opacity="0.9">${xml(l)}</text>`);
    y += 60;
  }
  if (end.url) {
    const label = end.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const bw = Math.min(W - 120, 120 + label.length * 26);
    parts.push(`<rect x="${(W - bw) / 2}" y="${y + 50}" width="${bw}" height="96" rx="48" fill="#ffffff"/>`);
    parts.push(`<text x="${W / 2}" y="${y + 112}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="42" fill="${p.primary}">${xml(label)}</text>`);
  }
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.primary}"/><stop offset="1" stop-color="${p.text}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${parts.join("\n  ")}
</svg>`;
  const layers: OverlayOptions[] = [];
  if (brand.logo) {
    const logo = await sharp(brand.logo).resize(360, 360, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    layers.push({ input: logo, top: 460, left: (W - 360) / 2 });
  }
  return sharp(Buffer.from(svg)).composite(layers).png().toBuffer();
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d: Buffer) => {
      err = (err + d.toString()).slice(-4000);
    });
    proc.on("error", (e) => reject(new Error(`ffmpeg could not start: ${e.message}`)));
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}: ${err.slice(-800)}`))));
  });
}

/** Renders the video; returns the MP4, a JPEG thumbnail (first scene) and the duration in seconds. */
export async function renderLaunchVideo(scenes: RenderScene[], brand: RenderBrand, end: RenderEndCard): Promise<{ mp4: Buffer; thumb: Buffer; seconds: number }> {
  const dir = await mkdtemp(path.join(tmpdir(), "startum-video-"));
  try {
    const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
    const filters: string[] = [];
    const durations: number[] = [];
    let input = 0;
    for (const [i, s] of scenes.entries()) {
      const dur = Math.max(2, Math.min(5, s.seconds)) + FADE;
      durations.push(dur);
      const bg = path.join(dir, `bg${i}.jpg`);
      const cap = path.join(dir, `cap${i}.png`);
      await writeFile(bg, await sharp(s.image).resize(Math.round(W * 1.1), Math.round(H * 1.1), { fit: "cover" }).jpeg({ quality: 90 }).toBuffer());
      await writeFile(cap, await sharp(Buffer.from(captionSvg(s.caption, brand))).png().toBuffer());
      const frames = Math.round(dur * FPS);
      args.push("-i", bg, "-loop", "1", "-framerate", String(FPS), "-t", dur.toFixed(2), "-i", cap);
      // Alternate zooming in and drifting, so consecutive scenes don't feel identical.
      const zoom = i % 2 === 0 ? "min(zoom+0.0010,1.12)" : "if(eq(on,1),1.12,max(zoom-0.0010,1.0))";
      filters.push(
        `[${input}:v]zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1[b${i}]`,
        `[${input + 1}:v]format=rgba,fade=t=in:st=0.2:d=0.4:alpha=1[c${i}]`,
        `[b${i}][c${i}]overlay=0:0:shortest=1,format=yuv420p,fps=${FPS},settb=AVTB,trim=duration=${dur.toFixed(2)},setpts=PTS-STARTPTS[s${i}]`,
      );
      input += 2;
    }
    const endFile = path.join(dir, "end.png");
    await writeFile(endFile, await endCard(brand, end));
    args.push("-loop", "1", "-framerate", String(FPS), "-t", String(END_SECONDS), "-i", endFile);
    const endIdx = scenes.length;
    durations.push(END_SECONDS);
    filters.push(`[${input}:v]format=yuv420p,fps=${FPS},settb=AVTB,setsar=1[s${endIdx}]`);
    input += 1;

    // Cross-fade the segments: each transition starts FADE seconds before the previous segment ends.
    let last = "s0";
    let offset = 0;
    for (let k = 1; k < durations.length; k++) {
      offset += durations[k - 1] - FADE;
      const out = k === durations.length - 1 ? "vout" : `x${k}`;
      filters.push(`[${last}][s${k}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}[${out}]`);
      last = out;
    }
    const total = durations.reduce((a, b) => a + b, 0) - FADE * (durations.length - 1);
    args.push("-f", "lavfi", "-t", total.toFixed(2), "-i", "anullsrc=r=44100:cl=stereo");
    const out = path.join(dir, "out.mp4");
    args.push("-filter_complex", filters.join(";"), "-map", "[vout]", "-map", `${input}:a`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", out);
    await ffmpeg(args);

    const first = await sharp(scenes[0].image)
      .resize(W, H, { fit: "cover" })
      .composite([{ input: await sharp(Buffer.from(captionSvg(scenes[0].caption, brand))).png().toBuffer() }])
      .png()
      .toBuffer();
    const thumb = await sharp(first).resize(540, 960).jpeg({ quality: 82 }).toBuffer();
    return { mp4: await readFile(out), thumb, seconds: Math.round(total) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
