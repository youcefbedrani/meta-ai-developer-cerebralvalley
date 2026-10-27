import { z } from "zod";

/** Every asset type the generator can produce, with the shape the AI must return. */
export const ASSET_TYPES = {
  ad_variants: {
    label: "Ad variants",
    schema: z.object({
      variants: z.array(z.object({ angle: z.string().max(60), headline: z.string().max(120), primaryText: z.string().max(600), cta: z.string().max(30), audienceIdea: z.string().max(200) })).min(2).max(3),
    }),
  },
  social_posts: {
    label: "Social posts",
    schema: z.object({ posts: z.array(z.object({ hook: z.string().max(200), body: z.string().max(2000), hashtags: z.array(z.string().max(40)).max(5) })).min(2).max(5) }),
  },
  community_post: {
    label: "Community post",
    schema: z.object({ title: z.string().max(200), body: z.string().max(3000), rulesReminder: z.string().max(300) }),
  },
  cold_email_sequence: {
    label: "Cold email sequence (3 steps)",
    schema: z.object({ emails: z.array(z.object({ step: z.number().int().min(1).max(3), sendAfterDays: z.number().int().min(0).max(30), subject: z.string().max(120), body: z.string().max(2000) })).length(3) }),
  },
  dm_script: {
    label: "DM script",
    schema: z.object({ opener: z.string().max(600), followUp: z.string().max(600), ifInterested: z.string().max(600), ifNotInterested: z.string().max(400) }),
  },
  seo_keywords: {
    label: "SEO keyword list",
    schema: z.object({
      keywords: z.array(z.object({ keyword: z.string().max(100), intent: z.enum(["informational", "commercial", "transactional", "navigational"]), note: z.string().max(200) })).min(5).max(25),
    }),
  },
  article_outline: {
    label: "Article outline",
    schema: z.object({ title: z.string().max(160), targetKeyword: z.string().max(100), sections: z.array(z.object({ heading: z.string().max(160), points: z.array(z.string().max(300)).max(6) })).min(3).max(12), cta: z.string().max(200) }),
  },
  launch_post: {
    label: "Launch post",
    schema: z.object({ platform: z.string().max(60), title: z.string().max(120), tagline: z.string().max(160), body: z.string().max(3000), firstComment: z.string().max(1500) }),
  },
  newsletter_pitch: {
    label: "Newsletter sponsor pitch",
    schema: z.object({ subject: z.string().max(120), body: z.string().max(2000), whyTheirAudience: z.string().max(400), proposedPlacement: z.string().max(200) }),
  },
} as const;

export type AssetType = keyof typeof ASSET_TYPES;
export const ASSET_TYPE_KEYS = Object.keys(ASSET_TYPES) as [AssetType, ...AssetType[]];
export type AssetContent<T extends AssetType = AssetType> = z.output<(typeof ASSET_TYPES)[T]["schema"]>;

/** What the model returns for one asset: the content plus the quote refs (Q1, Q2…) it drew on. */
export function generatedAssetSchema<T extends AssetType>(type: T) {
  return z.object({ title: z.string().max(140), content: ASSET_TYPES[type].schema, quoteRefs: z.array(z.string().max(10)).max(10) });
}

export const generateAssetsInputSchema = z.object({ channelId: z.uuid(), type: z.enum(ASSET_TYPE_KEYS) });

export function parseAssetContent(type: AssetType, content: unknown): AssetContent | null {
  const r = ASSET_TYPES[type].schema.safeParse(content);
  return r.success ? r.data : null;
}

/** Asset types that make sense for a channel (all types remain allowed; this only orders the picker). */
export function suggestedAssetTypes(channel: { name: string; type: "organic" | "paid" }): AssetType[] {
  const n = channel.name.toLowerCase();
  if (channel.type === "paid") return n.includes("newsletter") ? ["newsletter_pitch", "ad_variants"] : ["ad_variants"];
  if (/seo|content|blog/.test(n)) return ["seo_keywords", "article_outline"];
  if (/email|outreach/.test(n)) return ["cold_email_sequence", "dm_script"];
  if (/linkedin dm|dm/.test(n)) return ["dm_script", "cold_email_sequence"];
  if (/communit|reddit|forum|discord|slack|facebook group/.test(n)) return ["community_post", "dm_script"];
  if (/product hunt|launch|director/.test(n)) return ["launch_post"];
  if (/newsletter/.test(n)) return ["newsletter_pitch"];
  return ["social_posts", "community_post"];
}
