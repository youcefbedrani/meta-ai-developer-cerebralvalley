import "server-only";
import { and, desc, eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { parseStoredBrand, type StoredBrand } from "@/lib/brand-kit";
import { CREDIT_COSTS } from "@/lib/plans";
import { cutOut, generateImage } from "@/server/ai/image";
import { asData, callStructured, UNTRUSTED_DATA_RULE, withCredits } from "@/server/ai/run";
import { getDb, schema } from "@/server/db/client";
import { UserFacingError } from "@/server/data/errors";
import { listCustomerLanguage } from "@/server/data/gold-mine";
import { listChannels } from "@/server/data/marketing-studio";
import type { UserId } from "@/server/data/user-id";
import { enforceAiLimits } from "@/server/rate-limit";
import { saveUpload } from "@/server/storage";
import { getProjectContext } from "./project-context";

export type BrandAsset = typeof schema.brandAssets.$inferSelect;

const briefSchema = z.object({
  logo: z.object({ prompt: z.string().min(20).max(900), rationale: z.string().max(300) }),
  hero: z.object({ prompt: z.string().min(20).max(900), rationale: z.string().max(300) }),
  ads: z
    .array(
      z.object({
        channel: z.string().min(2).max(40),
        headline: z.string().min(3).max(70),
        prompt: z.string().min(20).max(900),
        rationale: z.string().max(300),
      }),
    )
    .min(1)
    .max(3),
});

const ART_DIRECTOR_SYSTEM = `You are the art director for a micro-SaaS launch. You write briefs for an image model (Meta Muse Image).
Ground every image in the research: the customers, the moment of pain they describe and the product's promise. No generic stock-photo clichés (handshakes, people pointing at screens, glowing brains).
- logo.prompt: a simple, flat vector logo MARK (icon only, no letters or words) that says what the product does, in the brand palette (name the hex colours), centered on a plain pure-white background, generous margin, no shadow, no mockup.
- hero.prompt: a wide landing-page hero illustration or photo showing the customer's world AFTER the product solved their problem. Brand colours as accents. Leave calm empty space on the left third for a headline. Absolutely no text, letters, logos or UI copy in the image.
- ads: exactly one per channel listed, in the same order. headline: max 8 words, in the customers' own words where possible (the app draws it on the image; never put text in the prompt). prompt: a scroll-stopping image for that channel showing the specific pain or the relief, no text or letters in the image, keep the bottom third simple (the headline goes there).
- rationale: one sentence on which research finding the image is based on.
${UNTRUSTED_DATA_RULE}`;

const DEFAULT_CHANNELS = ["LinkedIn", "Instagram", "Facebook"];
const AD_PLATFORM = /linkedin|instagram|facebook|\bmeta\b|tiktok|twitter|\bx\b|reddit|youtube|pinterest|threads|google ads/i;
const isSquareChannel = (c: string) => /insta|tiktok|threads|pinterest|facebook/i.test(c);

const xml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Greedy word wrap by an approximate character budget per line. */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

/** Draws the headline and brand name on an ad image (exact spelling, brand colours), as a bottom band. */
async function composeAd(image: Buffer, headline: string, brand: StoredBrand, w: number, h: number): Promise<Buffer> {
  const base = await sharp(image).resize(w, h, { fit: "cover" }).png().toBuffer();
  const size = Math.round(Math.min(w, h) * (w > h ? 0.075 : 0.07));
  const lines = wrap(headline, Math.max(12, Math.floor((w * 0.86) / (size * 0.55))));
  const band = Math.round(lines.length * size * 1.2 + size * 2.4);
  const name = brand.names[brand.chosen]?.name ?? brand.names[0]?.name ?? "";
  const text = lines.map((l, i) => `<tspan x="${Math.round(w * 0.06)}" dy="${i === 0 ? 0 : Math.round(size * 1.2)}">${xml(l)}</tspan>`).join("");
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${brand.palette.text}" stop-opacity="0"/><stop offset="0.35" stop-color="${brand.palette.text}" stop-opacity="0.78"/><stop offset="1" stop-color="${brand.palette.text}" stop-opacity="0.92"/></linearGradient></defs>
  <rect x="0" y="${h - band - size}" width="${w}" height="${band + size}" fill="url(#g)"/>
  <text x="${Math.round(w * 0.06)}" y="${h - band + Math.round(size * 1.3)}" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-weight="700" font-size="${size}" fill="#ffffff">${text}</text>
  <rect x="${Math.round(w * 0.06)}" y="${h - Math.round(size * 0.95)}" width="${Math.round(size * 0.5)}" height="${Math.round(size * 0.5)}" rx="${Math.round(size * 0.12)}" fill="${brand.palette.accent}"/>
  <text x="${Math.round(w * 0.06 + size * 0.75)}" y="${h - Math.round(size * 0.52)}" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(size * 0.5)}" fill="#ffffff">${xml(name)}</text>
</svg>`;
  return sharp(base).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}

/**
 * SAM 3.1 is prompted with a noun phrase; flat icon marks are sometimes not seen as a "logo", and partial phrases
 * pick out one part. Ask for both phrasings at once and keep the larger cut-out (the whole mark).
 */
async function cutOutLogo(image: Buffer, usage: { userId: UserId; projectId: string; operation: string }): Promise<Buffer | null> {
  const cuts = (await Promise.all(["logo", "graphic"].map((subject) => cutOut(image, subject, usage).catch(() => null)))).filter((c): c is Buffer => !!c);
  const sized = await Promise.all(cuts.map(async (c) => ({ c, area: await sharp(c).metadata().then((m) => (m.width ?? 0) * (m.height ?? 0)) })));
  return sized.sort((a, b) => b.area - a.area)[0]?.c ?? null;
}

/**
 * Brand visuals: Muse Spark writes research-grounded briefs, Muse Image renders a logo mark, a landing hero and
 * one ad per marketing channel (in parallel), SAM 3.1 cuts the logo out, and headlines are drawn on the ads.
 */
export async function generateBrandVisuals(userId: UserId, projectId: string): Promise<BrandAsset[]> {
  await enforceAiLimits(userId);
  const { project, context } = await getProjectContext(userId, projectId);
  const brand = parseStoredBrand(project.brand);
  if (!brand) throw new UserFacingError("Generate the Brand Kit first: the visuals use its name, palette and voice.");
  const [channels, quotes] = await Promise.all([listChannels(userId, project.id), listCustomerLanguage(userId, project.id)]);
  // Ads only make sense on platforms that run image ads; the plan's other channels (cold email, SEO…) don't.
  const platforms = channels.map((c) => c.name).filter((n) => AD_PLATFORM.test(n));
  const adChannels = [...new Set([...platforms, ...DEFAULT_CHANNELS])].slice(0, 3);

  return withCredits(userId, "brand_visuals", CREDIT_COSTS.brand_visuals, async () => {
    const brief = await callStructured({
      userId,
      projectId: project.id,
      operation: "brand_visuals_brief",
      tier: "smart",
      schema: briefSchema,
      system: ART_DIRECTOR_SYSTEM,
      prompt: [
        asData("brand", { name: brand.names[brand.chosen]?.name, tagline: brand.tagline, voice: brand.voice, palette: brand.palette, rationale: brand.rationale }),
        asData("project", { name: context.name, description: context.description, research: context.research }),
        asData("customer_quotes", quotes.slice(0, 12).map((q) => ({ theme: q.clusterTitle, quote: q.quote }))),
        `Channels for the ads: ${adChannels.join(", ")}.`,
      ].join("\n\n"),
      mock: () => ({
        logo: { prompt: "Mock logo mark on a white background, flat vector", rationale: "[Mock]" },
        hero: { prompt: "Mock hero illustration of a calm workspace", rationale: "[Mock]" },
        ads: adChannels.map((channel) => ({ channel, headline: "Mock headline for this channel", prompt: "Mock ad image without text", rationale: "[Mock]" })),
      }),
      maxOutputTokens: 4_000,
    });

    const usage = { userId, projectId: project.id, operation: "brand_visuals" };
    const jobs: { kind: "logo" | "hero" | "ad"; channel: string | null; headline: string | null; prompt: string; rationale: string; size: [number, number] }[] = [
      { kind: "logo", channel: null, headline: null, prompt: brief.logo.prompt, rationale: brief.logo.rationale, size: [1024, 1024] },
      { kind: "hero", channel: null, headline: null, prompt: brief.hero.prompt, rationale: brief.hero.rationale, size: [1600, 900] },
      // One ad per chosen channel, in order (the model sometimes merges or repeats channel names).
      ...brief.ads.slice(0, adChannels.length).map((a, i) => ({ kind: "ad" as const, channel: adChannels[i] ?? a.channel, headline: a.headline, prompt: a.prompt, rationale: a.rationale, size: (isSquareChannel(a.channel) ? [1080, 1080] : [1200, 628]) as [number, number] })),
    ];

    const settled = await Promise.allSettled(
      jobs.map(async (job) => {
        const [w, h] = job.size;
        const raw = await generateImage(job.prompt, { ...usage, size: `${w}x${h}` });
        const image = job.kind === "ad" && job.headline ? await composeAd(raw, job.headline, brand, w, h) : await sharp(raw).png().toBuffer();
        const meta = await sharp(image).metadata();
        const cutout = job.kind === "logo" ? await cutOutLogo(image, usage) : null;
        const [imageKey, cutoutKey] = await Promise.all([saveUpload("images", "png", image), cutout ? saveUpload("images", "png", cutout) : null]);
        return { ...job, width: meta.width ?? w, height: meta.height ?? h, imageKey, cutoutKey };
      }),
    );
    const made = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    // Credits are refunded only when nothing came out; a partial set is still useful.
    if (!made.length) throw (settled.find((r) => r.status === "rejected") as PromiseRejectedResult).reason;
    return getDb()
      .insert(schema.brandAssets)
      .values(
        made.map((m) => ({
          userId,
          projectId: project.id,
          kind: m.kind,
          channel: m.channel,
          headline: m.headline,
          prompt: m.prompt,
          rationale: m.rationale,
          width: m.width,
          height: m.height,
          imageKey: m.imageKey,
          cutoutKey: m.cutoutKey,
        })),
      )
      .returning();
  });
}

/** The latest set (one generation run) of the project's brand visuals, newest first. */
export async function listBrandAssets(userId: UserId, projectId: string): Promise<BrandAsset[]> {
  return getDb()
    .select()
    .from(schema.brandAssets)
    .where(and(eq(schema.brandAssets.projectId, projectId), eq(schema.brandAssets.userId, userId)))
    .orderBy(desc(schema.brandAssets.createdAt))
    .limit(30);
}

export async function getBrandAsset(userId: UserId, id: string): Promise<BrandAsset | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await getDb()
    .select()
    .from(schema.brandAssets)
    .where(and(eq(schema.brandAssets.id, id), eq(schema.brandAssets.userId, userId)))
    .limit(1);
  return row ?? null;
}
