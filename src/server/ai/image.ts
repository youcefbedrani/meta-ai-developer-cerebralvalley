import "server-only";
import { decodeMaskToRaster, parseImageStream, recordsOfKind } from "@meta-sam/parser";
import sharp from "sharp";
import { ConfigError, getIntegrationEnv } from "@/lib/env";
import type { UserId } from "@/server/data/user-id";
import { AIProviderError } from "./errors";
import { logUsage } from "./run";

/**
 * Meta Muse Image (POST /v1/images/generations, $0.01 per image) and SAM 3.1 segmentation
 * (POST /v1/responses, $2.50 per 1,000 images), on the same Meta Model API key as Muse Spark.
 * Docs: https://dev.meta.ai/docs/image-generation · https://dev.meta.ai/docs/sam/segmenting
 */
const IMAGE_MODEL = "muse-image-1.0";
const SAM_MODEL = "sam-3.1";
const USD_PER_IMAGE = 0.01;
const USD_PER_SEGMENTATION = 0.0025;
const TIMEOUT_MS = 120_000;

function metaConfig() {
  const env = getIntegrationEnv();
  const base = env.AI_BASE_URL ?? "";
  if (!env.AI_API_KEY || !/^https:\/\/api\.meta\.ai\b/.test(base)) {
    throw new ConfigError("ai", ["AI_BASE_URL=https://api.meta.ai/v1 and AI_API_KEY (images use Meta Muse Image and SAM 3.1)"]);
  }
  return { origin: new URL(base).origin, key: env.AI_API_KEY };
}

export function isImageConfigured(): boolean {
  try {
    metaConfig();
    return true;
  } catch {
    return false;
  }
}

type Usage = { userId: UserId | null; projectId?: string | null; operation: string };

/** One image from Muse Image as PNG bytes. `size` only sets the aspect ratio (e.g. "1200x628"). */
export async function generateImage(prompt: string, opts: Usage & { size: string }): Promise<Buffer> {
  const cfg = metaConfig();
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${cfg.origin}/v1/images/generations`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.key}`, "content-type": "application/json" },
      // Startum generates the visuals; the model needs no web or image search for them.
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, n: 1, size: opts.size, output_format: "png", reasoning_strength: "low", tool_enablement: { enable_image_search: false, enable_web_search: false, enable_shell: false } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string }[]; error?: { message?: string } };
    const b64 = body.data?.[0]?.b64_json;
    if (res.ok && b64) {
      await logUsage({ ...opts, provider: "meta", model: IMAGE_MODEL, tokensIn: 0, tokensOut: 0, durationMs: Date.now() - started, status: "success", costUsd: USD_PER_IMAGE });
      return Buffer.from(b64, "base64");
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1_500 * 2 ** attempt));
      continue;
    }
    console.error(`[image] generation failed: HTTP ${res.status} ${body.error?.message ?? ""}`);
    await logUsage({ ...opts, provider: "meta", model: IMAGE_MODEL, tokensIn: 0, tokensOut: 0, durationMs: Date.now() - started, status: "error", errorCode: `http_${res.status}`, costUsd: 0 });
    throw new AIProviderError("The image model couldn't make that image. Your credits were refunded — please try again.");
  }
}

/** Server-sent events → the event objects the SAM parser reads. */
async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<{ type: string }> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data && data !== "[DONE]") yield JSON.parse(data) as { type: string };
    }
  }
}

/**
 * Cuts `subject` (e.g. "logo") out of an image with SAM 3.1: the best mask becomes the alpha channel, then the
 * result is trimmed to the subject. Returns null when SAM finds nothing, so callers keep the original.
 */
export async function cutOut(png: Buffer, subject: string, opts: Usage): Promise<Buffer | null> {
  const cfg = metaConfig();
  const started = Date.now();
  const { width = 0, height = 0 } = await sharp(png).metadata();
  const res = await fetch(`${cfg.origin}/v1/responses`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.key}`, "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({
      model: SAM_MODEL,
      stream: true,
      metadata: { include_confidence: "true" },
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: subject }, { type: "input_image", image_url: `data:image/png;base64,${png.toString("base64")}` }] }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok || !res.body) {
    console.error(`[image] SAM failed: HTTP ${res.status}`);
    await logUsage({ ...opts, provider: "meta", model: SAM_MODEL, tokensIn: 0, tokensOut: 0, durationMs: Date.now() - started, status: "error", errorCode: `http_${res.status}`, costUsd: 0 });
    return null;
  }
  const result = await parseImageStream(sseEvents(res.body)).finalResult;
  await logUsage({ ...opts, provider: "meta", model: SAM_MODEL, tokensIn: 0, tokensOut: 0, durationMs: Date.now() - started, status: "success", costUsd: USD_PER_SEGMENTATION });

  // Union of every mask SAM returned for the subject (a logo mark can come back as several parts).
  const masks = recordsOfKind(result.records, "mask");
  if (!masks.length || !width || !height) return null;
  const mask = Buffer.alloc(width * height);
  for (const m of masks) {
    const boxW = Math.max(1, Math.min(width, m.bounds.right) - m.bounds.left);
    const boxH = Math.max(1, Math.min(height, m.bounds.bottom) - m.bounds.top);
    const raster = decodeMaskToRaster(m.mask);
    // The raster has its own resolution over the record's box: scale it to the box, then paint it in.
    const scaled = await sharp(Buffer.from(raster.map((v) => (v ? 255 : 0))), { raw: { width: m.mask.width, height: m.mask.height, channels: 1 } })
      .resize(boxW, boxH, { kernel: "nearest", fit: "fill" })
      .extractChannel(0) // resize hands back 3 channels; one byte per pixel is what we index
      .raw()
      .toBuffer();
    for (let y = 0; y < boxH; y++) {
      const row = (m.bounds.top + y) * width + m.bounds.left;
      for (let x = 0; x < boxW; x++) if (scaled[y * boxW + x]) mask[row + x] = 255;
    }
  }
  // Separate pass: sharp runs removeAlpha after joinChannel within one pipeline, which would drop the new alpha.
  const rgb = await sharp(png).removeAlpha().png().toBuffer();
  // Crop to the subject (union of the mask boxes) with a small margin.
  const pad = Math.round(Math.min(width, height) * 0.02);
  const left = Math.max(0, Math.min(...masks.map((m) => m.bounds.left)) - pad);
  const top = Math.max(0, Math.min(...masks.map((m) => m.bounds.top)) - pad);
  const right = Math.min(width, Math.max(...masks.map((m) => m.bounds.right)) + pad);
  const bottom = Math.min(height, Math.max(...masks.map((m) => m.bounds.bottom)) + pad);
  const cut = await sharp(rgb).joinChannel(mask, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return sharp(cut).extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer();
}
