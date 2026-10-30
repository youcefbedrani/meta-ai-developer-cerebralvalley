import type { LaunchPlaybook } from "@/lib/validation/launch-playbook";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const LAUNCH_PLAYBOOK_PROMPT_VERSION = "launch-playbook.v1";

export const LAUNCH_PLAYBOOK_SYSTEM = `You are a SaaS go-to-market lead who has taken several bootstrapped B2B and prosumer SaaS products from idea to their first $10k MRR. Write the founder's launch playbook: one plan from validation to growth, specific to THIS product, customer and founder.

How experienced SaaS founders do it (apply this, don't lecture about it):
- Stages with gates. Six stages in this order: validate, build, pre_launch, launch, first_customers, growth. Each has a timeframe sized to the founder's hours per week, a goal, 1–4 exit criteria that are measurable ("8 of 12 interviewees describe the problem unprompted", "20 waitlist sign-ups from cold traffic", "3 paying customers"), 2–7 concrete tasks with honest hour estimates, and up to 3 risks. Never move to build before demand evidence; skip a stage's work only if the project data shows it's already done, and say so in its goal.
- Tasks point to the Startum feature that does them ("feature"): autopilot, research, competitors, market_voices, validation_lab (interviews and experiments), landing_page (waitlist pages), brand, design, plan (business model and MVP spec), marketing (Marketing Studio), copilot, page_review, or none.
- Sales for the first customers is founder-led: the founder talks to every early customer, sells before the product is finished, and does things that don't scale. Choose the motion from the price point and buyer: self_serve for low prices and individual buyers, founder_led for most early B2B, sales_assisted only for high prices or committee purchases. Explain why.
- ICP: the company (size, type, situation), the economic buyer vs the daily user, buying triggers (the moments the pain becomes urgent) and disqualifiers (who to walk away from).
- Prospecting: where to find these people, list-building criteria, and a realistic daily routine.
- Outreach: a 3–6 touch sequence over about two weeks across 1–2 channels. Short, personal, one ask per message, value first, no spam tactics, placeholders like {first_name} and {specific_detail} for personalisation.
- Discovery: 5–10 questions about past behaviour and current workarounds, never "would you use…" opinions. Include questions about what the problem costs them and who else is involved in buying.
- Demo: 3–7 steps that start from the prospect's own pain and show the aha moment fast; for each, what to show and what to say.
- Objections: the most likely 3–8 for this buyer, with honest responses. Set "basis" to "customer_quote" ONLY when "evidence" is copied verbatim from the provided customer_language quotes; "research" when it rests on a provided research fact; otherwise "hypothesis" with what to test.
- Closing: a founding-customer offer (for example a locked-in early price or annual plan for the first customers, in exchange for feedback), the exact ask, and the follow-up.
- Pipeline: 4–7 stages from first touch to paying, each with a definition and the next action.
- Metrics: one north-star goal and metric for the next 90 days. The activation moment (the first time a user gets real value). A five-stage funnel (visitor, signup, activated, paying, retained) with how to measure each, and targets written as assumptions to test ("Assumption: …"). A short weekly dashboard. "assumedMonthlyChurnPct" is your planning assumption for monthly churn for this kind of customer; explain it in unitEconomicsNotes as an assumption to replace with real data. Do not compute LTV, CAC or customers-per-milestone yourself: the app computes them from the price.
- "mainPriceMonthly": the main tier's monthly price from the business model if one is provided, otherwise your best assumption, consistent with verified competitor prices.
- Retention: onboarding steps that get a new user to the activation moment, early churn signals, and save actions.
- Pricing tactics: 2–5 practical ones for this stage (annual discount, founding price, value metric, when to raise prices).
- Build: week-by-week sprints from the MVP plan if provided (otherwise from the research), each with deliverables and a definition of done; the launch infrastructure checklist (auth, billing, transactional email, analytics, error tracking, legal pages, backups); and 2–5 prompts the founder can paste into an AI coding tool, each self-contained, naming the stack, the entities and the acceptance criteria for one piece of the MVP.

Honesty rules:
- Build only on the provided project data, research, competitors, customer quotes, business model, MVP plan, marketing plan and founder setup. Never invent facts about the market, competitors, customers or traction.
- Never state benchmark numbers (conversion rates, churn rates, CAC, reply rates, market sizes) as facts. Targets and churn are assumptions to test, and must read as such.
- Never write fake testimonials, case studies or social proof; use placeholders.
- Respect the founder's hours per week, budget and skills: fewer, better actions beat a long wish list.
- ${UNTRUSTED_DATA_RULE}`;

export function buildLaunchPlaybookPrompt(input: { project: unknown; customerLanguage: unknown; businessModel: unknown; mvpPlan: unknown; marketing: unknown; founder: unknown; setup: unknown }) {
  return `Write the launch playbook.

${asData("project", input.project)}

${asData("customer_language", input.customerLanguage)}

${asData("business_model", input.businessModel ?? "Not generated yet.")}

${asData("mvp_plan", input.mvpPlan ?? "Not generated yet.")}

${asData("marketing_plan", input.marketing ?? "Not generated yet.")}

${asData("go_to_market_setup", input.setup ?? "Not set: assume about 10 hours a week, a budget under $200 a month and a first goal of 10 paying customers.")}

${asData("founder_profile", input.founder ?? {})}`;
}

export function mockLaunchPlaybook(): LaunchPlaybook {
  const task = (title: string, feature: LaunchPlaybook["stages"][number]["tasks"][number]["feature"]) => ({ title: `[Mock] ${title}`, detail: "[Mock] Concrete steps for this task.", hours: 3, feature });
  const stage = (stage: LaunchPlaybook["stages"][number]["stage"], timeframe: string, feature: LaunchPlaybook["stages"][number]["tasks"][number]["feature"]) => ({
    stage,
    timeframe,
    goal: `[Mock] Goal for ${stage}.`,
    exitCriteria: ["[Mock] A measurable gate"],
    tasks: [task("First task", feature), task("Second task", "copilot")],
    risks: ["[Mock] A risk"],
  });
  return {
    summary: "[Mock] Sell to a narrow customer first, founder-led, then grow through the channel that worked.",
    northStar: { goal: "[Mock] 10 paying customers in 90 days", metric: "Paying customers", why: "[Mock] Proves people pay." },
    mainPriceMonthly: 29,
    stages: [stage("validate", "Weeks 1–2", "validation_lab"), stage("build", "Weeks 3–6", "plan"), stage("pre_launch", "Weeks 5–6", "landing_page"), stage("launch", "Week 7", "marketing"), stage("first_customers", "Weeks 7–10", "copilot"), stage("growth", "Months 3–6", "marketing")],
    sales: {
      motion: "founder_led",
      motionWhy: "[Mock] Early B2B customers buy from the founder.",
      icp: { company: "[Mock] Small teams", buyer: "[Mock] Owner", user: "[Mock] Office manager", triggers: ["[Mock] A missed deadline"], disqualifiers: ["[Mock] Enterprises"] },
      prospecting: { whereToFind: ["[Mock] Industry groups"], listCriteria: ["[Mock] 2–20 staff"], dailyRoutine: "[Mock] 10 new prospects, 10 follow-ups." },
      outreachSequence: [0, 3, 7].map((day) => ({ day, channel: "Email", goal: "[Mock] Book a call", message: "Hi {first_name}, [Mock] short note about {specific_detail}." })),
      discoveryQuestions: ["[Mock] Q1", "[Mock] Q2", "[Mock] Q3", "[Mock] Q4", "[Mock] Q5"],
      demoFlow: ["Pain", "Aha", "Next step"].map((step) => ({ step, show: "[Mock] Screen", say: "[Mock] Line" })),
      objections: ["Price", "Time", "Trust"].map((o) => ({ objection: `[Mock] ${o}`, response: "[Mock] Honest answer.", basis: "hypothesis" as const, evidence: "[Mock] To test in interviews." })),
      closing: { foundingOffer: "[Mock] Founding price for the first 10 customers.", ask: "[Mock] Start this week?", followUp: "[Mock] Check in after 3 days." },
      pipeline: ["Contacted", "Call booked", "Trial", "Paying"].map((stage) => ({ stage, definition: "[Mock] Definition", nextAction: "[Mock] Next action" })),
    },
    metrics: {
      activationMoment: "[Mock] First automated result.",
      funnel: (["visitor", "signup", "activated", "paying", "retained"] as const).map((stage) => ({ stage, definition: "[Mock] Definition", howToMeasure: "[Mock] Analytics event", targetAssumption: "Assumption: to test" })),
      weeklyDashboard: ["[Mock] New sign-ups", "[Mock] Activated users", "[Mock] MRR"],
      assumedMonthlyChurnPct: 5,
      unitEconomicsNotes: "[Mock] Churn is an assumption until you have 3 months of billing data.",
    },
    retention: { onboarding: ["[Mock] Step 1", "[Mock] Step 2", "[Mock] Step 3"], churnSignals: ["[Mock] No login in 7 days", "[Mock] Failed payment"], saveActions: ["[Mock] Personal check-in", "[Mock] Offer a pause"] },
    pricingTactics: ["[Mock] Annual plan with 2 months free", "[Mock] Founding price"],
    build: {
      sprints: [1, 2].map((week) => ({ week, focus: `[Mock] Week ${week}`, deliverables: ["[Mock] Deliverable"], doneWhen: "[Mock] Done when it works end to end." })),
      launchInfra: ["Auth", "Billing", "Transactional email", "Analytics"],
      aiCodingPrompts: [{ title: "[Mock] Data model", prompt: "[Mock] Build the data model…" }, { title: "[Mock] Core flow", prompt: "[Mock] Build the core flow…" }],
    },
  };
}
