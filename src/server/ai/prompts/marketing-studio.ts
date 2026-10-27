import { ASSET_TYPES, type AssetType } from "@/lib/validation/marketing-assets";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const ASSETS_PROMPT_VERSION = "marketing-assets.v1";
export const RECOMMEND_PROMPT_VERSION = "marketing-recommend.v1";

export const ASSETS_SYSTEM = `You write marketing assets for a solo founder's new product.
Rules:
- Write from the project's research and especially the customers' own words in customer_quotes. Reuse their phrasing.
- "quoteRefs": the ids (e.g. "Q2") of every quote you drew on. Use only ids that exist in customer_quotes; leave it empty if none were used.
- Never invent testimonials, statistics, user counts, results or guarantees. Don't claim features the project data doesn't describe.
- Respect ad-platform policies: no guarantees, no income or health claims, never imply you know the reader's personal attributes (health, finances, religion, sexuality, age…), no fake urgency.
- Community posts and DMs must be genuinely helpful, non-spammy and respect community rules, and must disclose that the author is building something.
- SEO keywords: list keyword ideas with intent only. NEVER state search volumes or difficulty scores.
- Match the platform's style and length.
- ${UNTRUSTED_DATA_RULE}`;

export function buildAssetsPrompt(input: { type: AssetType; channel: unknown; project: unknown; quotes: unknown; positioning: unknown }) {
  return `Create one "${ASSET_TYPES[input.type].label}" asset for this channel.

${asData("channel", input.channel)}

${asData("positioning", input.positioning ?? "No marketing plan yet.")}

${asData("project", input.project)}

${asData("customer_quotes", input.quotes)}`;
}

export const RECOMMEND_SYSTEM = `You advise a solo founder on the next best step for each marketing channel, based ONLY on the recorded results provided.
Rules:
- Use only the numbers in channel_results. Never invent or estimate numbers, and never cite industry benchmarks.
- For each channel choose one action:
  - double_down;
  - iterate_copy;
  - change_audience;
  - stop;
  - keep_testing;
  - need_more_data (required when the channel has enough_data = false).
- "reason" must reference the actual recorded numbers (e.g. "12 signups from 340 tracked visits"). Respect the founder's own thresholds when given.
- nextSteps: 1–3 concrete actions for the coming week.
- summary: 2–3 sentences on where to focus overall, given the goal and budget.
- ${UNTRUSTED_DATA_RULE}`;

export function buildRecommendPrompt(input: { goal: string; budget: unknown; results: unknown; adTests: unknown }) {
  return `Recommend the next best step per channel.

${asData("goal", input.goal)}

${asData("budget", input.budget)}

${asData("channel_results", input.results)}

${asData("ad_tests", input.adTests)}`;
}
