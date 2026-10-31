import { VIDEO_ANGLES, type Storyboard, type VideoAngle } from "@/lib/validation/launch-video";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const LAUNCH_VIDEO_PROMPT_VERSION = "launch-video.v1";

export const LAUNCH_VIDEO_SYSTEM = `You are a short-form video creative director who launches SaaS products with organic content on TikTok, Instagram Reels, LinkedIn and Facebook. Write ONE 15–30 second vertical video and the post that goes with it on each platform.

The video (captions on screen, no voice-over: most people watch muted):
- 3–6 scenes. Scene 1 is the hook: it must stop the scroll in under 2 seconds — name the pain or a surprising truth, in the customer's words when quotes are provided. Then the turn (how this product changes it), proof or a concrete moment, and the payoff.
- "caption": the on-screen text, 3–12 words, plain language, no hashtags, no emojis at the start. Each caption must make sense on its own.
- "visual": a prompt for an image model: one clear, cinematic, vertical (9:16) scene that shows the moment the caption describes — people, places, objects, light, mood, style consistent across scenes. NEVER ask for text, letters, words, UI screenshots, logos or brand names in the image (they render badly). Leave the lower-middle area calm (the caption sits there).
- "seconds": 2–5 per scene, longer for longer captions.
- "cta": the end card: "line" (e.g. "Join the waitlist") and "sub" (one short line: who it's for or the offer).

The posts (native to each platform, written by the founder in first person, never corporate):
- linkedin: a short story post — hook line, 3–6 short paragraphs, a question to invite comments. 3–5 hashtags.
- facebook: friendly, 2–4 short paragraphs, clear call to action. 0–3 hashtags.
- instagram: a punchy caption, line breaks, "link in bio" for the link. 5–8 hashtags.
- tiktok: one or two lines that add to the video, "link in bio". 3–6 hashtags.
- Hashtags without the # sign; mix one or two broad tags with niche ones for this customer.

Honesty: build only on the provided product, research, customer quotes and brand. Never invent users, numbers, results, testimonials, awards or press. If the product isn't live yet, say early access / waitlist, not "thousands of users".
- ${UNTRUSTED_DATA_RULE}`;

export function buildLaunchVideoPrompt(input: { angle: VideoAngle; notes: string | null; project: unknown; brand: unknown; quotes: string[]; link: string | null }): string {
  const angle = VIDEO_ANGLES[input.angle];
  return `Angle: ${angle.label}: ${angle.hint}
${input.notes ? `\n${asData("founder_notes", input.notes)}\n` : ""}
${asData("product", input.project)}

${asData("brand", input.brand ?? "No Brand Kit yet: pick a clean, modern style.")}

${asData("customer_quotes", input.quotes.length ? input.quotes : "None collected yet.")}

Link to send people to: ${input.link ?? "none yet (say: link in bio / comment to get early access)"}`;
}

/** Each scene's image prompt, with the shared style and the "no text" rule repeated (image models forget). */
export function sceneImagePrompt(visual: string, palette: { primary: string; accent: string } | null): string {
  return `${visual}\n\nVertical 9:16 photograph-quality scene, cinematic lighting, shallow depth of field.${palette ? ` Subtle colour accents in ${palette.primary} and ${palette.accent}.` : ""} Absolutely no text, letters, numbers, logos, watermarks or user-interface screens anywhere in the image. Keep the lower-middle third uncluttered.`;
}

export function mockStoryboard(): Storyboard {
  const post = { text: "[Mock] We're building this for you. Early access is open.", hashtags: ["saas", "startup", "buildinpublic"] };
  return {
    title: "[Mock] Launch video",
    scenes: [
      { caption: "[Mock] The problem, in their words", visual: "A tired small-business owner at a desk at night", seconds: 3 },
      { caption: "[Mock] What changes with the product", visual: "The same person relaxed, morning light", seconds: 3 },
      { caption: "[Mock] The payoff", visual: "A calm, organised workspace", seconds: 3 },
    ],
    cta: { line: "Join the waitlist", sub: "[Mock] Early access for small teams" },
    posts: { linkedin: post, facebook: post, instagram: post, tiktok: post },
  };
}
