import "server-only";
import { z } from "zod";
import { getIntegrationStatus, ConfigError } from "@/lib/env";
import { hasEnoughData, type ChannelFunnel } from "@/lib/marketing/metrics";
import { CREDIT_COSTS } from "@/lib/plans";
import { generateAssetsInputSchema, generatedAssetSchema, type AssetType, type AssetContent } from "@/lib/validation/marketing-assets";
import { goalLabel, gtmSetupSchema } from "@/lib/validation/marketing";
import { ASSETS_PROMPT_VERSION, ASSETS_SYSTEM, buildAssetsPrompt, buildRecommendPrompt, RECOMMEND_PROMPT_VERSION, RECOMMEND_SYSTEM } from "@/server/ai/prompts/marketing-studio";
import { callStructured, withCredits } from "@/server/ai/run";
import { getDb, schema } from "@/server/db/client";
import { UserFacingError, NotFoundError } from "@/server/data/errors";
import { listCustomerLanguage } from "@/server/data/gold-mine";
import { getLatestMarketingPlan, listChannelResults } from "@/server/data/marketing";
import { buildChannelFunnels, getChannel, getTrackedEvents, insertAsset, listAdExperiments, listChannels, saveRecommendation } from "@/server/data/marketing-studio";
import type { UserId } from "@/server/data/user-id";
import { enforceAiLimits } from "@/server/rate-limit";
import { getProjectContext } from "./project-context";
import { and, eq } from "drizzle-orm";

function requireAi() {
  const ai = getIntegrationStatus("ai");
  if (!ai.configured) throw new ConfigError("ai", ai.missing);
}

/* ---------------------------------------------------------------- Assets */

/** Generates one asset for a channel from the project's research and customer quotes, and stores which quotes it used. */
export async function generateAsset(userId: UserId, input: unknown) {
  requireAi();
  const { channelId, type } = generateAssetsInputSchema.parse(input);
  const channel = await getChannel(userId, channelId);
  if (!channel) throw new NotFoundError("Channel");
  await enforceAiLimits(userId);
  const { project, context } = await getProjectContext(userId, channel.projectId);
  const [quotes, saved] = await Promise.all([listCustomerLanguage(userId, project.id), getLatestMarketingPlan(userId, project.id)]);
  // Short refs (Q1, Q2…) keep real ids out of the prompt and make hallucinated refs easy to drop.
  const refs = quotes.slice(0, 30).map((q, i) => ({ ref: `Q${i + 1}`, id: q.id, quote: q.quote, pain: q.clusterTitle }));

  return withCredits(userId, "marketing_assets", CREDIT_COSTS.marketing_assets, async () => {
    const out = await callStructured({
      userId,
      projectId: project.id,
      operation: "marketing_assets",
      tier: "smart",
      schema: generatedAssetSchema(type),
      system: ASSETS_SYSTEM,
      prompt: buildAssetsPrompt({
        type,
        channel: { name: channel.name, type: channel.type, notes: channel.notes },
        project: context,
        quotes: refs.map(({ ref, quote, pain }) => ({ id: ref, quote, pain })),
        positioning: saved ? { ...saved.plan.positioning, angles: saved.plan.angles.map((a) => ({ name: a.name, hook: a.hook })) } : null,
      }),
      maxOutputTokens: 8_000,
      mock: () => ({ title: `[Mock] ${channel.name}: ${type.replace(/_/g, " ")}`, content: mockAsset(type), quoteRefs: refs.slice(0, 2).map((r) => r.ref) }),
    });
    const quoteIds = out.quoteRefs.map((r) => refs.find((x) => x.ref === r.toUpperCase())?.id).filter((id): id is string => !!id);
    return insertAsset(userId, { projectId: project.id, channelId: channel.id, channelName: channel.name, type, title: out.title, content: out.content, quoteIds, source: "ai", promptVersion: ASSETS_PROMPT_VERSION });
  });
}

function mockAsset(type: AssetType): AssetContent {
  const m = "[Mock]";
  const map: { [K in AssetType]: AssetContent<K> } = {
    ad_variants: { variants: [
      { angle: "Pain", headline: `${m} Still doing it by hand?`, primaryText: `${m} Stop copying data every week. Join the waitlist.`, cta: "Join waitlist", audienceIdea: `${m} Small agency owners` },
      { angle: "Time saved", headline: `${m} Get your Friday back`, primaryText: `${m} The weekly report that builds itself.`, cta: "Get early access", audienceIdea: `${m} Operations leads` },
    ] },
    social_posts: { posts: [{ hook: `${m} I spent 3 hours every Friday on this.`, body: `${m} Here's what I learned and what I'm building.`, hashtags: ["buildinpublic"] }, { hook: `${m} 5 ways teams waste time on reports`, body: `${m} A helpful list post.`, hashtags: [] }] },
    community_post: { title: `${m} How do you handle weekly reports?`, body: `${m} A helpful, value-first post that discloses you're building something.`, rulesReminder: `${m} Read the community rules first.` },
    cold_email_sequence: { emails: [
      { step: 1, sendAfterDays: 0, subject: `${m} Quick question`, body: `${m} Short, personal first email.` },
      { step: 2, sendAfterDays: 3, subject: `${m} Re: Quick question`, body: `${m} Gentle follow-up.` },
      { step: 3, sendAfterDays: 7, subject: `${m} Closing the loop`, body: `${m} Last, polite follow-up.` },
    ] },
    dm_script: { opener: `${m} Saw your post about weekly reports.`, followUp: `${m} Would a 15-minute chat help?`, ifInterested: `${m} Great, here's a link to book.`, ifNotInterested: `${m} No problem, thanks!` },
    seo_keywords: { keywords: ["automate weekly report", "weekly report template", "stop manual data entry", "report automation small business", "client report tool"].map((k) => ({ keyword: `${m} ${k}`, intent: "informational" as const, note: `${m} Problem-intent idea` })) },
    article_outline: { title: `${m} How to automate your weekly report`, targetKeyword: `${m} automate weekly report`, sections: [{ heading: `${m} The problem`, points: ["Why it's painful"] }, { heading: `${m} Options`, points: ["Manual", "Tools"] }, { heading: `${m} Step by step`, points: ["Set up", "Test"] }], cta: `${m} Join the waitlist` },
    launch_post: { platform: "Product Hunt", title: `${m} Your product`, tagline: `${m} Stop doing reports by hand`, body: `${m} Launch post body.`, firstComment: `${m} Maker's first comment.` },
    newsletter_pitch: { subject: `${m} Sponsorship enquiry`, body: `${m} Short pitch to a newsletter owner.`, whyTheirAudience: `${m} Their readers run small agencies.`, proposedPlacement: `${m} One classified slot` },
  };
  return map[type];
}

/* -------------------------------------------------------- Recommendation */

const ACTIONS = ["double_down", "iterate_copy", "change_audience", "stop", "keep_testing", "need_more_data"] as const;
export const recommendationSchema = z.object({
  summary: z.string().max(800),
  channels: z.array(z.object({ channel: z.string().max(60), action: z.enum(ACTIONS), reason: z.string().max(400), nextSteps: z.array(z.string().max(240)).min(1).max(3) })).max(20),
});
export type Recommendation = z.output<typeof recommendationSchema>;

/** Channels with recorded data, plus whether there's enough of it to judge. */
export function recommendationInput(funnels: ChannelFunnel[]) {
  return funnels
    .filter((f) => [f.spend, f.clicks, f.visits, f.signups, f.customers].some((v) => (v ?? 0) > 0))
    .map((f) => ({ channel: f.channel, spend: f.spend, impressions: f.impressions, clicks: f.clicks, visits: f.visits, visitsSource: f.visitsSource, signups: f.signups, signupsSource: f.signupsSource, customers: f.customers, revenue: f.revenue, metrics: f.metrics, enough_data: hasEnoughData(f) }));
}

/** Forces "need more data" where the numbers are too thin and drops channels the model invented. */
export function guardRecommendation(rec: Recommendation, input: ReturnType<typeof recommendationInput>): Recommendation {
  const known = new Map(input.map((c) => [c.channel.toLowerCase(), c]));
  return {
    summary: rec.summary,
    channels: rec.channels
      .filter((c) => known.has(c.channel.toLowerCase()))
      .map((c) => (known.get(c.channel.toLowerCase())!.enough_data ? c : { ...c, action: "need_more_data" as const, reason: `Not enough data yet. ${c.reason}`.slice(0, 400) })),
  };
}

/** "Next best step" per channel, based only on recorded results. */
export async function recommendNextStep(userId: UserId, projectId: string) {
  requireAi();
  const [saved, channels, results, tracked, tests] = await Promise.all([
    getLatestMarketingPlan(userId, projectId),
    listChannels(userId, projectId),
    listChannelResults(userId, projectId),
    getTrackedEvents(userId, projectId),
    listAdExperiments(userId, projectId),
  ]);
  if (!saved) throw new NotFoundError("Marketing plan");
  const input = recommendationInput(buildChannelFunnels(channels, results, tracked));
  if (!input.length) throw new UserFacingError("Log some results (or get tracked visits) first. Recommendations are based only on real numbers.");
  await enforceAiLimits(userId);
  const [planRow] = await getDb().select({ inputs: schema.marketingPlans.inputs }).from(schema.marketingPlans).where(and(eq(schema.marketingPlans.id, saved.id), eq(schema.marketingPlans.userId, userId)));
  const setup = gtmSetupSchema.safeParse(planRow?.inputs);
  const goal = setup.success ? goalLabel(setup.data) : saved.plan.primaryMetric;
  const budget = setup.success ? { monthly: setup.data.monthlyBudget, currency: setup.data.currency } : null;
  const adTests = tests.map((t) => ({ name: t.name, platform: t.platform, status: t.status, maxCostPerSignup: Number(t.maxCostPerSignup), minClicks: t.minClicks }));

  return withCredits(userId, "marketing_recommendation", CREDIT_COSTS.marketing_recommendation, async () => {
    const raw = await callStructured({
      userId,
      projectId,
      operation: "marketing_recommendation",
      tier: "fast",
      schema: recommendationSchema,
      system: RECOMMEND_SYSTEM,
      prompt: buildRecommendPrompt({ goal, budget, results: input, adTests }),
      maxOutputTokens: 4_000,
      mock: () => ({
        summary: "[Mock] Focus on the channel with the most tracked signups and keep testing the rest.",
        channels: input.map((c) => ({ channel: c.channel, action: "keep_testing" as const, reason: `[Mock] ${c.signups ?? 0} signups from ${c.visits ?? c.clicks ?? 0} visits/clicks recorded.`, nextSteps: ["[Mock] Run one more week with a new headline."] })),
      }),
    });
    const content = guardRecommendation(raw, input);
    return saveRecommendation(userId, projectId, content, { channels: input, at: new Date().toISOString() }, RECOMMEND_PROMPT_VERSION);
  });
}

