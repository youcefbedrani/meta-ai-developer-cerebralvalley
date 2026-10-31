import { z } from "zod";

/*
 * Launch videos for organic social: a 15–30 s vertical (9:16) video with on-screen captions — the format
 * TikTok, Instagram Reels, Facebook and LinkedIn all play natively, usually with the sound off — plus a
 * ready-to-post text for each platform.
 */

export const VIDEO_ANGLES = {
  problem: { label: "Problem → solution", hint: "Open on the customer's pain, show how the product removes it." },
  voices: { label: "In customers' words", hint: "Built around real quotes from your research." },
  build: { label: "Build in public", hint: "The founder's story: why you're building this, what's next." },
  launch: { label: "Launch day", hint: "Announce it: what it is, who it's for, how to get early access." },
} as const;
export type VideoAngle = keyof typeof VIDEO_ANGLES;
export const videoAngleSchema = z.enum(Object.keys(VIDEO_ANGLES) as [VideoAngle, ...VideoAngle[]]);

export const SOCIAL_PROVIDERS = ["linkedin", "facebook", "instagram", "tiktok"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
export const PROVIDER_LABEL: Record<SocialProvider, string> = { linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok" };
/** Where to post by hand: the platform's own upload screen. */
export const PROVIDER_UPLOAD_URL: Record<SocialProvider, string> = {
  linkedin: "https://www.linkedin.com/feed/?shareActive=true",
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/upload",
};
/** Caption limits, so a post is never rejected for length. */
export const CAPTION_LIMIT: Record<SocialProvider, number> = { linkedin: 3000, facebook: 5000, instagram: 2200, tiktok: 2200 };

const post = z.object({ text: z.string().max(2000), hashtags: z.array(z.string().max(40)).max(8) });

export const storyboardSchema = z.object({
  title: z.string().max(80),
  scenes: z
    .array(
      z.object({
        /** On-screen text: short, punchy, readable in two seconds. */
        caption: z.string().max(90),
        /** What Muse Image draws: no text, no logos, vertical composition. */
        visual: z.string().max(600),
        seconds: z.number().min(2).max(5),
      }),
    )
    .min(3)
    .max(6),
  cta: z.object({ line: z.string().max(60), sub: z.string().max(90) }),
  posts: z.object({ linkedin: post, facebook: post, instagram: post, tiktok: post }),
});
export type Storyboard = z.output<typeof storyboardSchema>;

/** The text that gets posted: body + hashtags, cut to the platform's limit. */
export function captionFor(storyboard: Storyboard, provider: SocialProvider, link?: string | null): string {
  const p = storyboard.posts[provider];
  const tags = p.hashtags.map((h) => `#${h.replace(/^#/, "").replace(/\s+/g, "")}`).join(" ");
  // Links aren't clickable in Instagram and TikTok captions, so they get "link in bio" from the model instead.
  const withLink = link && (provider === "linkedin" || provider === "facebook") && !p.text.includes(link) ? `${p.text}\n\n${link}` : p.text;
  return [withLink, tags].filter(Boolean).join("\n\n").slice(0, CAPTION_LIMIT[provider]);
}
