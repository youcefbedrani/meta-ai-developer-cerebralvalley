import "server-only";
import { CREDIT_COSTS } from "@/lib/plans";
import { LAUNCH_PLAYBOOK_SCHEMA_VERSION, launchPlaybookSchema, mainTierPrice, PLAYBOOK_STAGES, revenueMath, type LaunchPlaybook } from "@/lib/validation/launch-playbook";
import { buildLaunchPlaybookPrompt, LAUNCH_PLAYBOOK_PROMPT_VERSION, LAUNCH_PLAYBOOK_SYSTEM, mockLaunchPlaybook } from "@/server/ai/prompts/launch-playbook";
import { runWithCredits } from "@/server/ai/run";
import { getDb, schema } from "@/server/db/client";
import { getLatestMarketingPlan } from "@/server/data/marketing";
import { getLatestBusinessModel, getLatestMvpPlan } from "@/server/data/planning";
import { getProfile } from "@/server/data/profiles";
import type { UserId } from "@/server/data/user-id";
import { enforceAiLimits } from "@/server/rate-limit";
import { getProjectCustomerLanguage } from "./gold-mine";
import { getProjectContext } from "./project-context";

const normalize = (s: string) => s.toLowerCase().replace(/[“”"'‘’]/g, "").replace(/\s+/g, " ").trim();

/** Objection evidence marked as a customer quote must appear in the project's collected quotes; otherwise it's a hypothesis. */
export function verifyObjections(playbook: LaunchPlaybook, quotes: string[]): { playbook: LaunchPlaybook; downgraded: number } {
  const known = quotes.map(normalize).filter(Boolean);
  let downgraded = 0;
  const objections = playbook.sales.objections.map((o) => {
    if (o.basis !== "customer_quote") return o;
    const ev = normalize(o.evidence);
    if (ev.length >= 8 && known.some((q) => q.includes(ev) || ev.includes(q))) return o;
    downgraded++;
    return { ...o, basis: "hypothesis" as const, evidence: `Not found in your collected quotes, so treat as a hypothesis. ${o.evidence}`.slice(0, 400) };
  });
  return { playbook: { ...playbook, sales: { ...playbook.sales, objections } }, downgraded };
}

/** One card per stage, in journey order, whatever order the model returned them in. */
export function orderStages(playbook: LaunchPlaybook): LaunchPlaybook {
  const stages = PLAYBOOK_STAGES.map((id) => playbook.stages.find((st) => st.stage === id)).filter((st): st is LaunchPlaybook["stages"][number] => !!st);
  return { ...playbook, stages };
}

export async function generateLaunchPlaybook(userId: UserId, projectId: string) {
  await enforceAiLimits(userId);
  const { project, context } = await getProjectContext(userId, projectId);
  const [business, mvp, marketing, language, profile] = await Promise.all([
    getLatestBusinessModel(userId, project.id),
    getLatestMvpPlan(userId, project.id),
    getLatestMarketingPlan(userId, project.id),
    getProjectCustomerLanguage(userId, project.id),
    getProfile(userId),
  ]);
  const m = marketing?.plan;
  const raw = await runWithCredits({
    userId,
    projectId: project.id,
    operation: "launch_playbook",
    tier: "smart",
    credits: CREDIT_COSTS.launch_playbook,
    schema: launchPlaybookSchema,
    system: LAUNCH_PLAYBOOK_SYSTEM,
    prompt: buildLaunchPlaybookPrompt({
      project: context,
      customerLanguage: language.map((g) => ({ pain: g.cluster, quotes: g.quotes.slice(0, 6).map((q) => q.quote) })),
      businessModel: business?.model ?? null,
      mvpPlan: mvp?.plan ?? null,
      // The parts of the marketing plan the playbook builds on, not the whole plan (ads, drafts).
      marketing: m ? { positioning: m.positioning, segments: m.audience.segments, primaryChannels: m.organic.channels.filter((c) => c.role !== "later").map((c) => ({ name: c.name, strategy: c.strategy })), primaryMetric: m.primaryMetric } : null,
      founder: profile,
      setup: marketing?.inputs ?? null,
    }),
    maxOutputTokens: 32_000,
    mock: () => mockLaunchPlaybook(),
  });
  const { playbook, downgraded } = verifyObjections(orderStages(raw), language.flatMap((g) => g.quotes.map((q) => q.quote)));
  const tierPrice = business ? mainTierPrice(business.model.tiers) : null;
  const math = revenueMath(tierPrice ?? playbook.mainPriceMonthly, playbook.metrics.assumedMonthlyChurnPct, tierPrice ? "business_model" : "assumption");
  const final = { ...playbook, mainPriceMonthly: math.priceMonthly };
  await getDb()
    .insert(schema.reports)
    .values({
      projectId: project.id,
      type: "launch_playbook",
      schemaVersion: LAUNCH_PLAYBOOK_SCHEMA_VERSION,
      content: { playbook: final, meta: { promptVersion: LAUNCH_PLAYBOOK_PROMPT_VERSION, math, downgradedObjections: downgraded, inputs: { businessModel: !!business, mvpPlan: !!mvp, marketingPlan: !!marketing, quotes: language.reduce((n, g) => n + g.quotes.length, 0) } } },
      summary: final.summary.slice(0, 500),
    });
  return { playbook: final, math };
}
