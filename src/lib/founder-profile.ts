import { strategiesForSkills, type MvpStrategy } from "@/lib/resources/mvp-playbook";
import { BUDGETS, BUSINESS_MODELS, GOALS, TECHNICAL_LEVELS, TIME_COMMITMENTS, type OnboardingAnswers } from "@/lib/validation/onboarding";

/*
 * Turns a founder's onboarding answers into something they can see at a glance: scales for level,
 * time and budget, and a few plain-language takeaways. Takeaways are ANALYSIS derived from the
 * answers with fixed rules (below), never AI guesses. Pure, unit-tested.
 */

const indexOf = <T extends readonly { value: string }[]>(list: T, value: string) => Math.max(0, list.findIndex((o) => o.value === value));
const labelOf = <T extends readonly { value: string; label: string }[]>(list: T, value: string) => list.find((o) => o.value === value)?.label ?? value;

export type Scale = { label: string; value: string; step: number; steps: number };
export type Takeaway = { title: string; body: string; href?: string };

export function profileScales(p: OnboardingAnswers): Scale[] {
  return [
    { label: "Technical level", value: labelOf(TECHNICAL_LEVELS, p.technicalLevel), step: indexOf(TECHNICAL_LEVELS, p.technicalLevel) + 1, steps: TECHNICAL_LEVELS.length },
    { label: "Time per week", value: labelOf(TIME_COMMITMENTS, p.timePerWeek), step: indexOf(TIME_COMMITMENTS, p.timePerWeek) + 1, steps: TIME_COMMITMENTS.length },
    { label: "Budget to start", value: labelOf(BUDGETS, p.budget), step: indexOf(BUDGETS, p.budget) + 1, steps: BUDGETS.length },
  ];
}

export function profileLabels(p: OnboardingAnswers) {
  return { goals: p.goals.map((g) => labelOf(GOALS, g)), models: p.businessModels.map((m) => labelOf(BUSINESS_MODELS, m)) };
}

export function profileTakeaways(p: OnboardingAnswers): Takeaway[] {
  const out: Takeaway[] = [];
  const tech = indexOf(TECHNICAL_LEVELS, p.technicalLevel);
  if (p.timePerWeek === "under_5h") out.push({ title: "Keep the first version tiny", body: "With under 5 hours a week, start with a landing page or a done-by-hand service before building software.", href: "/app/resources/mvp-playbook" });
  else if (p.timePerWeek === "full_time") out.push({ title: "You can move fast", body: "Full-time lets you run several small tests a week. Set a date to decide build, pivot or drop." });
  if (p.budget === "under_500") out.push({ title: "Organic channels first", body: "With a small budget, start with communities, content and outreach. Run paid ads only as small tests with a stop rule.", href: "/app/marketing" });
  else if (p.budget === "over_10k") out.push({ title: "Test before you spend", body: "A bigger budget makes paid tests possible. Validate demand with a waitlist first so the money buys learning, not guesses." });
  if (tech <= 1) out.push({ title: "No-code and concierge MVPs suit you", body: "You don't need to code to validate. A no-code tool or doing the work by hand for the first customers proves demand faster.", href: "/app/resources/mvp-playbook" });
  else if (tech >= 3) out.push({ title: "Don't build too early", body: "As a developer, building is the easy part. Talk to customers and get waitlist signups before writing much code." });
  if (p.goals.includes("venture_scale") && (p.budget === "under_500" || p.timePerWeek === "under_5h")) out.push({ title: "Big goal, small runway", body: "Venture-scale goals with limited time or budget usually mean proving demand cheaply first, then raising or committing more." });
  if (p.goals.includes("side_income")) out.push({ title: "Favour simple, recurring revenue", body: "For side income, look for a narrow niche with a clear monthly price and low support needs." });
  return out.slice(0, 4);
}

/** MVP strategies that match the founder's skills (only ones with at least one matching skill). */
export function matchingStrategies(p: OnboardingAnswers, limit = 3): MvpStrategy[] {
  const mine = p.skills.map((s) => s.toLowerCase());
  return strategiesForSkills(p.skills)
    .filter((s) => s.fitsSkills.some((t) => mine.some((m) => m.includes(t) || t.includes(m))))
    .slice(0, limit);
}
