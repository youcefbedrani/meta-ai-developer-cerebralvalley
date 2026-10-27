import type { BusinessModel, MvpPlan } from "@/lib/validation/planning";

type Input = {
  projectName: string;
  plan: MvpPlan;
  business: BusinessModel | null;
  validation: { completed: number; passed: number; failed: number };
  decision: string | null;
  generatedAt: Date;
};

const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- (none)");

/** Markdown product spec (PRD) for the MVP. */
export function buildSpecMarkdown({ projectName, plan, business, validation, decision, generatedAt }: Input): string {
  const lines = [
    `# ${projectName} — MVP specification`,
    "",
    `_Generated ${generatedAt.toISOString().slice(0, 10)}. Validation status: ${validation.passed} passed / ${validation.completed} completed experiments${decision ? `; decision: ${decision}` : ""}._`,
    validation.passed === 0 ? "\n> ⚠️ No experiment has passed yet. Treat this plan as provisional until demand is validated." : "",
    "",
    "## Summary",
    plan.productSummary,
    "",
    "## Target user",
    plan.targetUser,
    "",
    "## Problem",
    plan.problemStatement,
    "",
    "## Must-have features",
    ...plan.mustHave.flatMap((f, i) => [`### ${i + 1}. ${f.feature}`, `Why: ${f.why}`, "", "Acceptance criteria:", ...f.acceptanceCriteria.map((c) => `- [ ] ${c}`), ""]),
    "## Later (not in MVP)",
    list(plan.later.map((l) => `${l.feature} — ${l.reason}`)),
    "",
    "## Out of scope",
    list(plan.outOfScope),
    "",
    "## User journeys",
    ...plan.userJourneys.flatMap((j) => [`### ${j.name}`, ...j.steps.map((s, i) => `${i + 1}. ${s}`), ""]),
    "## Technical needs",
    "Suggested stack:",
    list(plan.techNeeds.suggestedStack),
    "",
    "Integrations:",
    list(plan.techNeeds.integrations),
    "",
    "Data model:",
    ...plan.techNeeds.dataModel.map((e) => `- **${e.entity}**: ${e.fields.join(", ")}`),
    "",
    "## Milestones",
    ...plan.milestones.flatMap((m) => [`### ${m.title} (${m.estimate})`, list(m.deliverables), ""]),
    "## Launch checklist",
    ...plan.launchChecklist.map((c) => `- [ ] ${c}`),
    "",
    "## Risks",
    list(plan.risks),
  ];
  if (business) {
    lines.push(
      "",
      "## Pricing (hypotheses to test)",
      `Model: ${business.pricingModel.type.replace("_", " ")} — ${business.pricingModel.rationale}`,
      "",
      ...business.tiers.map((t) => `- **${t.name}**: ${t.priceMonthly === null ? "custom" : `$${t.priceMonthly}/mo`} (${t.billingNote}) — ${t.includes.join(", ")}`),
      "",
      business.competitorAnchors.length ? "Verified competitor anchors:" : "No verified competitor prices were found; prices are assumptions.",
      ...business.competitorAnchors.map((a) => `- ${a.competitor}: ${a.observation}`),
    );
  }
  return lines.filter((l) => l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

/** A prompt a coding agent can follow to build the MVP from the spec. */
export function buildAgentPrompt(input: Input): string {
  return `You are building the MVP of "${input.projectName}". Follow the specification below exactly.

Rules:
- Build only the "Must-have features". Do not build anything listed under "Later" or "Out of scope".
- Work milestone by milestone. After each milestone, verify every acceptance criterion and stop to report what works.
- Keep the architecture simple and production-ready: input validation on the server, authentication on every protected route, no secrets in client code.
- Write tests for each acceptance criterion where practical.
- If something in the spec is ambiguous, choose the simplest option and note the assumption.
- Do not add analytics, fake data, testimonials or placeholder metrics to the product.

---

${buildSpecMarkdown(input)}`;
}
