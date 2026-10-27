import type { OnboardingAnswers } from "@/lib/validation/onboarding";
import type { IdeaContent, IdeaInputs } from "@/lib/validation/ideas";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const IDEAS_PROMPT_VERSION = "ideas.v1";

export const IDEAS_SYSTEM = `You help founders find SaaS and micro-SaaS opportunities that fit their skills, budget, time and goals.

Hard rules:
- You have NOT done any research. Every idea is a hypothesis to be tested.
- Never state statistics, market sizes, search volumes, revenue figures, growth rates, quotes or competitor prices. Never claim a specific company exists or does something unless it is universally known, and never attribute features or prices to it.
- "currentAlternatives" describes the kinds of solutions people use today (e.g. "spreadsheets", "generic CRMs", "hiring a freelancer"), not named products with claims.
- "evidenceToLookFor" lists evidence that would support the idea and where to look for it (e.g. "complaints about manual X in forums for Y"). They are research directions, not findings.
- "evidenceMissing" lists what is unknown and must be validated.
- Pricing hypotheses are clearly hypotheses ("Test $19/month per seat"), never claims about the market.
- Size ideas to the founder: respect budget, time, technical level and constraints. Prefer narrow, painful problems over broad ones.
- Never predict success probability.
- ${UNTRUSTED_DATA_RULE}`;

export function buildIdeasPrompt(inputs: IdeaInputs, profile: OnboardingAnswers | null): string {
  return `Generate ${inputs.count} distinct SaaS ideas for this founder.

${asData("founder_profile", profile ?? { note: "No profile saved" })}

${asData("request", inputs)}

Empty request fields mean "no preference". Make the ideas meaningfully different from each other.`;
}

/** Canned output for AI_PROVIDER=mock (development/tests only). Clearly labelled. */
export function mockIdeas(inputs: IdeaInputs): { ideas: IdeaContent[] } {
  const topic = inputs.niche || "small B2B teams";
  return {
    ideas: Array.from({ length: inputs.count }, (_, i) => ({
      title: `[Mock] ${["Workflow tracker", "Data sync helper", "Report builder", "Onboarding checklist", "Invoice reminder", "Feedback inbox"][i % 6]} for ${topic}`,
      oneLiner: "Mock idea generated without an AI provider — for testing the flow only.",
      problem: "Mock data: describes a repetitive manual task the target customer may face. Not based on research.",
      targetCustomer: inputs.customer || "Operations leads at small companies (mock)",
      currentAlternatives: ["Spreadsheets", "Generic project tools", "Doing it manually"],
      solution: "Mock data: a narrow tool that automates the repetitive part of the task.",
      differentiationHypothesis: "Hypothesis (mock): simpler and cheaper than general-purpose tools for this one job.",
      monetization: "Monthly subscription per workspace (hypothesis).",
      pricingHypotheses: ["Test $19/month for small teams", "Test a free tier limited to one workflow"],
      complexity: (["low", "medium", "high"] as const)[i % 3],
      complexityReason: "Mock estimate.",
      risks: ["Customers may not see the problem as painful enough", "Existing tools may be good enough"],
      evidenceToLookFor: ["Forum threads complaining about this manual task", "Job posts that mention doing it by hand"],
      evidenceMissing: ["Whether customers would pay", "How often the problem occurs"],
      firstExperiment: {
        type: "interview",
        description: "Interview 10 target customers about how they handle this task today.",
        successCriteria: "At least 6 of 10 describe the problem unprompted.",
      },
    })),
  };
}
