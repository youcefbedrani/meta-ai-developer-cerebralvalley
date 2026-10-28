import { z } from "zod";

/** One line of an Autopilot run's live trace, shown in order on the Autopilot tab. */
export type AutopilotEvent = {
  at: string;
  kind: "thought" | "tool_call" | "tool_result" | "error" | "verdict";
  /** Tool name for tool_call / tool_result. */
  tool?: string;
  title: string;
  detail?: string;
  durationMs?: number;
};

export const AUTOPILOT_GOAL_MAX = 500;

export const autopilotStartSchema = z.object({
  goal: z.string().trim().max(AUTOPILOT_GOAL_MAX).optional(),
});

/** What the agent must hand in to finish. Every reason cites URLs it actually saw during the run. */
export const autopilotVerdictSchema = z.object({
  decision: z.enum(["build", "pivot", "drop"]),
  confidence: z.number().int().min(0).max(100),
  headline: z.string().min(10).max(200),
  reasons: z
    .array(
      z.object({
        stance: z.enum(["for", "against"]),
        claim: z.string().min(5).max(400),
        sourceUrls: z.array(z.string().max(500)).max(4),
      }),
    )
    .min(2)
    .max(8),
  risks: z.array(z.string().min(3).max(300)).max(5),
  nextSteps: z.array(z.string().min(3).max(300)).min(1).max(5),
  pivotIdea: z.string().max(400).nullable(),
});
export type AutopilotVerdict = z.output<typeof autopilotVerdictSchema> & {
  /** Reasons removed because they cited a URL the run never saw. */
  droppedReasons?: number;
};

/** Labels for the tools, in the order a typical run uses them. */
export const AUTOPILOT_TOOLS: Record<string, string> = {
  read_project: "Read the project",
  run_market_validation: "Market research, competitors and market voices",
  read_evidence: "Read the research evidence",
  web_search: "Web search",
  generate_business_model: "Business model",
  generate_mvp_plan: "MVP plan",
  design_brand: "Brand and visuals",
  create_landing_page: "Landing page and waitlist test",
  submit_verdict: "Verdict",
};
