import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getEnv, getIntegrationStatus, ConfigError } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { gtmSetupSchema, MARKETING_PLAN_SCHEMA_VERSION, marketingPlanSchema, SEARCH_PLATFORMS, utmSource, type GtmSetup, type MarketingPlan } from "@/lib/validation/marketing";
import { buildMarketingPrompt, MARKETING_PROMPT_VERSION, MARKETING_SYSTEM, mockMarketingPlan } from "@/server/ai/prompts/marketing";
import { callStructured, withCredits } from "@/server/ai/run";
import { getDb, schema } from "@/server/db/client";
import { getProfile } from "@/server/data/profiles";
import type { UserId } from "@/server/data/user-id";
import { enforceAiLimits } from "@/server/rate-limit";
import { getProjectCustomerLanguage } from "./gold-mine";
import { getProjectContext } from "./project-context";

const SPECIFIC_COMMUNITY = /\b(r\/[A-Za-z0-9_]+)/;

/**
 * Specific communities (e.g. "r/freelance") may only be named if real customer
 * quotes came from them; other specific names are removed. Generic places stay.
 */
export function verifyCommunities(plan: MarketingPlan, known: string[]): { plan: MarketingPlan; removed: number } {
  const allowed = new Set(known.map((k) => k.toLowerCase()));
  let removed = 0;
  const keep = (list: string[]) =>
    list.filter((w) => {
      const m = w.match(SPECIFIC_COMMUNITY);
      if (!m || allowed.has(m[1].toLowerCase())) return true;
      removed++;
      return false;
    });
  const out: MarketingPlan = {
    ...plan,
    audience: { segments: plan.audience.segments.map((s) => ({ ...s, whereTheyHangOut: keep(s.whereTheyHangOut) })) },
    organic: { ...plan.organic, channels: plan.organic.channels.map((c) => ({ ...c, whereToFind: keep(c.whereToFind) })) },
    paid: { ...plan.paid, platforms: plan.paid.platforms.map((p) => ({ ...p, targeting: keep(p.targeting) })) },
  };
  return { plan: out, removed };
}

const normalize = (s: string) => s.toLowerCase().replace(/[“”"'‘’]/g, "").replace(/\s+/g, " ").trim();

/** An angle may claim a customer quote only if its evidence really appears in the collected quotes. */
export function verifyAngleEvidence(plan: MarketingPlan, quotes: string[]): { plan: MarketingPlan; downgraded: number } {
  const known = quotes.map(normalize).filter(Boolean);
  let downgraded = 0;
  const angles = plan.angles.map((a) => {
    if (a.basis !== "customer_quote") return a;
    const ev = normalize(a.evidence);
    if (ev.length >= 8 && known.some((q) => q.includes(ev) || ev.includes(q))) return a;
    downgraded++;
    return { ...a, basis: "hypothesis" as const, evidence: `Not found in your collected quotes, so treat as a hypothesis. ${a.evidence}`.slice(0, 400) };
  });
  return { plan: { ...plan, angles }, downgraded };
}

/** Skipped platforms carry no ads; keywords only make sense on search platforms. */
export function tidyPaidPlatforms(plan: MarketingPlan): MarketingPlan {
  const platforms = plan.paid.platforms
    .filter((p, i, all) => all.findIndex((x) => x.platform === p.platform) === i)
    .map((p) => {
      if (p.fit === "skip") return { ...p, targeting: [], keywords: [], negativeKeywords: [], formats: [], ads: [] };
      if (!SEARCH_PLATFORMS.includes(p.platform)) return { ...p, keywords: [], negativeKeywords: [] };
      return p;
    });
  return { ...plan, paid: { ...plan.paid, platforms } };
}

/**
 * Focus over spreading: at most 2 primary channels and 1 test channel, ranked
 * by fit. With no budget, paid channels wait. Paid budgets are capped at the
 * founder's monthly budget.
 */
export function enforceFocus(plan: MarketingPlan, setup: Pick<GtmSetup, "monthlyBudget">): MarketingPlan {
  type Ref = { kind: "organic" | "paid"; i: number; score: number; role: "primary" | "test" | "later" };
  const refs: Ref[] = [
    ...plan.organic.channels.map((c, i) => ({ kind: "organic" as const, i, score: c.fitScore, role: c.role })),
    ...plan.paid.platforms.map((p, i) => ({ kind: "paid" as const, i, score: p.fitScore, role: p.fit === "skip" || setup.monthlyBudget <= 0 ? ("later" as const) : p.role })),
  ].sort((a, b) => b.score - a.score);
  let primaries = 0;
  let tests = 0;
  for (const r of refs) {
    if (r.role === "primary" && primaries < 2) primaries++;
    else if (r.role === "test" && tests < 1) tests++;
    else r.role = "later";
  }
  // Always leave the founder with somewhere to start.
  if (primaries === 0) {
    const best = refs.find((r) => r.kind === "organic");
    if (best) best.role = "primary";
  }
  const roleOf = (kind: Ref["kind"], i: number) => refs.find((r) => r.kind === kind && r.i === i)!.role;

  const platforms = plan.paid.platforms.map((p, i) => {
    const role = roleOf("paid", i);
    return { ...p, role, suggestedMonthlyBudget: role === "later" ? 0 : Math.max(0, p.suggestedMonthlyBudget) };
  });
  const total = platforms.reduce((a, p) => a + p.suggestedMonthlyBudget, 0);
  const scale = total > setup.monthlyBudget && total > 0 ? setup.monthlyBudget / total : 1;
  return {
    ...plan,
    organic: { ...plan.organic, channels: plan.organic.channels.map((c, i) => ({ ...c, role: roleOf("organic", i) })) },
    paid: { ...plan.paid, platforms: platforms.map((p) => ({ ...p, suggestedMonthlyBudget: Math.floor(p.suggestedMonthlyBudget * scale) })) },
  };
}

/** Week-0 setup every plan starts with, so tracking and the offer are ready before any channel work. */
export const SETUP_TASKS: { title: string; description: string; expectedOutput: string; successMetric: string }[] = [
  { title: "Get your landing page ready", description: "Publish the project's landing page with a clear headline, 3–5 benefits in your customers' words and one call to action.", expectedOutput: "A published landing page", successMetric: "Page is live and the signup form works" },
  { title: "Create tracking links", description: "Use the tracking link for each channel (Channels & budget tab) so every visit and signup is attributed to its source.", expectedOutput: "One tagged link per active channel", successMetric: "Test visit shows up under the right source" },
  { title: "Check analytics", description: "Open the landing page through a tracking link, sign up with a test email and confirm both appear in Results.", expectedOutput: "Tracked visit and signup", successMetric: "Both events visible in Results" },
  { title: "Set up the waitlist or checkout", description: "Decide what a conversion is: a waitlist signup, a call booking or a pre-sale checkout. Make sure it works end to end.", expectedOutput: "Working conversion step", successMetric: "One successful test conversion" },
  { title: "Define your offer", description: "Write a simple early offer, such as a founding-member price, a free pilot or a pre-sale with a refund promise. Be honest about what exists today.", expectedOutput: "Offer written on the landing page", successMetric: "Offer published" },
];

const DAY = 24 * 60 * 60 * 1000;
export function dueDateFor(week: number, start: Date): Date {
  return new Date(start.getTime() + (week === 0 ? 3 : week * 7) * DAY);
}

/** Generates a go-to-market plan from the project's research + customer language and saves its playbook as tasks. */
export async function generateMarketingPlan(userId: UserId, projectId: string, setupInput: unknown) {
  const setup = gtmSetupSchema.parse(setupInput);
  const ai = getIntegrationStatus("ai");
  if (!ai.configured) throw new ConfigError("ai", ai.missing);
  await enforceAiLimits(userId);
  const { project, context } = await getProjectContext(userId, projectId);
  const language = await getProjectCustomerLanguage(userId, project.id);
  const knownCommunities = [...new Set(language.flatMap((g) => g.quotes.map((q) => q.community)).filter((c): c is string => !!c))];
  const db = getDb();
  const [page] = await db
    .select({ slug: schema.landingPages.slug })
    .from(schema.landingPages)
    .where(and(eq(schema.landingPages.projectId, project.id), eq(schema.landingPages.published, true)))
    .limit(1);
  const landingUrl = page ? `${getEnv().APP_URL.replace(/\/$/, "")}/p/${page.slug}` : null;
  const profile = await getProfile(userId);

  return withCredits(userId, "marketing_plan", CREDIT_COSTS.marketing_plan, async () => {
    const raw = await callStructured({
      userId,
      projectId: project.id,
      operation: "marketing_plan",
      tier: "smart",
      schema: marketingPlanSchema,
      system: MARKETING_SYSTEM,
      prompt: buildMarketingPrompt({
        project: context,
        customerLanguage: language.map((g) => ({ pain: g.cluster, quotes: g.quotes.slice(0, 8).map((q) => ({ quote: q.quote, community: q.community })) })),
        knownCommunities,
        landingUrl,
        founder: profile,
        setup,
      }),
      maxOutputTokens: 32_000,
      mock: () => mockMarketingPlan(knownCommunities),
    });
    const allQuotes = language.flatMap((g) => g.quotes.map((q) => q.quote));
    const verified = verifyAngleEvidence(tidyPaidPlatforms(verifyCommunities(raw, knownCommunities).plan), allQuotes).plan;
    const plan = enforceFocus(verified, setup);
    const start = new Date();
    return db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(schema.marketingPlans)
        .values({ userId, projectId: project.id, content: plan, inputs: setup, schemaVersion: MARKETING_PLAN_SCHEMA_VERSION, promptVersion: MARKETING_PROMPT_VERSION })
        .returning({ id: schema.marketingPlans.id });
      const steps = [
        ...SETUP_TASKS.map((t) => ({ week: 0, channel: "Setup", type: "organic" as const, ...t })),
        ...[...plan.playbook].sort((a, b) => a.week - b.week),
      ];
      await tx.insert(schema.marketingTasks).values(
        steps.map((s, i) => ({
          userId,
          planId: saved.id,
          projectId: project.id,
          week: s.week,
          position: i,
          channel: s.channel,
          channelType: s.type,
          title: s.title,
          description: s.description,
          successMetric: s.successMetric,
          expectedOutput: s.expectedOutput || null,
          dueDate: dueDateFor(s.week, start),
        })),
      );

      // Channels the founder will run: every recommended channel, keeping any budget they already set.
      const recommended = [
        ...plan.organic.channels.map((c) => ({ name: c.name, type: "organic" as const, role: c.role, budget: null as number | null })),
        ...plan.paid.platforms.filter((p) => p.fit !== "skip").map((p) => ({ name: p.platform, type: "paid" as const, role: p.role, budget: p.suggestedMonthlyBudget || null })),
      ];
      for (const [i, c] of recommended.entries()) {
        await tx
          .insert(schema.marketingChannels)
          .values({ userId, projectId: project.id, planId: saved.id, name: c.name, type: c.type, role: c.role, monthlyBudget: c.budget === null ? null : c.budget.toFixed(2), currency: setup.currency, utmSource: utmSource(c.name), position: i })
          .onConflictDoUpdate({
            target: [schema.marketingChannels.projectId, schema.marketingChannels.utmSource],
            set: { planId: saved.id, role: c.role, position: i, monthlyBudget: sql`coalesce(${schema.marketingChannels.monthlyBudget}, excluded.monthly_budget)` },
          });
      }
      return { planId: saved.id };
    });
  });
}
