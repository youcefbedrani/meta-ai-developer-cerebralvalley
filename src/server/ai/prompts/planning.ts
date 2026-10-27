import type { BusinessModel, MvpPlan } from "@/lib/validation/planning";
import type { ProjectContextData } from "@/server/services/project-context";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const PLANNING_PROMPT_VERSION = "planning.v1";

export const BUSINESS_SYSTEM = `You design pricing and business models for micro-SaaS products.
Hard rules:
- Competitor prices: use ONLY the "verifiedPricing" values provided for competitors. Never invent or recall other prices. "competitorAnchors" may only name competitors that have verifiedPricing. If none have it, return an empty list and say in "assumptions" that pricing is not anchored on verified market data.
- Every tier price is a hypothesis to test, not a fact. Keep tiers few and simple.
- Use the research and experiment results provided; do not contradict them.
- Never claim market size, revenue projections or success probability.
- ${UNTRUSTED_DATA_RULE}`;

export function buildBusinessPrompt(ctx: ProjectContextData) {
  return `Propose a business model and pricing tiers.\n\n${asData("project", ctx)}`;
}

export function mockBusinessModel(ctx: ProjectContextData): BusinessModel {
  const anchor = ctx.competitors.find((c) => c.verifiedPricing);
  return {
    pricingModel: { type: "tiered", rationale: "[Mock] Simple tiers suit small teams." },
    tiers: [
      { name: "Starter", priceMonthly: 9, billingNote: "per workspace, monthly", targetCustomer: "[Mock] Solo users", includes: ["[Mock] Core feature"], rationale: "[Mock] Low barrier to try." },
      { name: "Team", priceMonthly: 29, billingNote: "per workspace, monthly", targetCustomer: "[Mock] Small teams", includes: ["[Mock] Everything in Starter", "[Mock] Team access"], rationale: "[Mock] Main revenue tier." },
    ],
    competitorAnchors: anchor ? [{ competitor: anchor.name, observation: `[Mock] Verified price: ${anchor.verifiedPricing}` }] : [],
    revenueStreams: ["[Mock] Subscriptions"],
    assumptions: ["[Mock] Customers will pay monthly for time saved."],
    risks: ["[Mock] Price sensitivity among solo users."],
    pricingExperiments: [{ type: "pre_sale", title: "[Mock] Pre-sell the Team tier", hypothesis: "[Mock] 3 of 20 prospects pre-pay.", successCriteria: "3 pre-payments" }],
  };
}

export const MVP_SYSTEM = `You plan minimum viable products for solo founders and small teams building micro-SaaS.
Rules:
- Size it to ship in about 2–6 weeks for the founder described. Be ruthless: only features needed to test the core value go in "mustHave"; everything else goes in "later" or "outOfScope".
- Each must-have explains "why" with reference to the research or experiment results provided, and has testable acceptance criteria.
- Respect the business model's tiers when relevant (billing only if pricing is part of the test).
- Do not invent facts about the market. Base decisions on the provided context.
- The output will be used as a spec for coding agents: be concrete (entities, fields, journeys).
- ${UNTRUSTED_DATA_RULE}`;

export function buildMvpPrompt(ctx: ProjectContextData, business: BusinessModel | null, founder: unknown) {
  return `Create the MVP plan.\n\n${asData("project", ctx)}\n\n${asData("business_model", business ?? { note: "No business model yet" })}\n\n${asData("founder_profile", founder ?? {})}`;
}

export function mockMvpPlan(ctx: ProjectContextData): MvpPlan {
  return {
    productSummary: `[Mock] A focused first version of ${ctx.name}.`,
    targetUser: "[Mock] Small teams doing this task manually.",
    problemStatement: "[Mock] The task takes hours each week.",
    mustHave: [
      { feature: "[Mock] Sign up and workspace", why: "[Mock] Needed to use the product.", acceptanceCriteria: ["User can sign up with email", "User lands in an empty workspace"] },
      { feature: "[Mock] Core automation", why: "[Mock] Tests the main value from research.", acceptanceCriteria: ["User can configure one automation", "Automation runs on schedule"] },
    ],
    later: [{ feature: "[Mock] Integrations", reason: "[Mock] Not needed to test core value." }],
    outOfScope: ["[Mock] Mobile app"],
    userJourneys: [{ name: "[Mock] First run", steps: ["Sign up", "Create automation", "See first result"] }],
    techNeeds: { suggestedStack: ["Next.js", "PostgreSQL"], integrations: ["Email provider"], dataModel: [{ entity: "Workspace", fields: ["id", "name", "ownerId"] }, { entity: "Automation", fields: ["id", "workspaceId", "schedule", "config"] }] },
    milestones: [{ title: "[Mock] Week 1–2: core", estimate: "2 weeks", deliverables: ["Auth", "Automation CRUD"] }, { title: "[Mock] Week 3: launch", estimate: "1 week", deliverables: ["Billing", "Landing page"] }],
    launchChecklist: ["[Mock] Privacy policy", "[Mock] Onboarding email", "[Mock] Invite waitlist"],
    risks: ["[Mock] Scope creep"],
  };
}
