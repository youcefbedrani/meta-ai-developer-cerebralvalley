import type { InterviewScript, LandingContent, NotesAnalysis } from "@/lib/validation/experiments";
import type { ProjectContextData } from "@/server/services/project-context";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const VALIDATION_PROMPT_VERSION = "validation.v1";

/* ----------------------------------------------------- interview script */

export const SCRIPT_SYSTEM = `You write customer discovery interview scripts in the style of "The Mom Test".
- Ask about past behaviour and specifics, not opinions about the future or the idea.
- Never pitch the product during the interview. No leading or hypothetical questions ("Would you use...?").
- Tie questions to the experiment's hypothesis and to open questions from research.
- "avoid" lists questions the founder should NOT ask, with why.
- ${UNTRUSTED_DATA_RULE}`;

export function buildScriptPrompt(ctx: ProjectContextData, experiment: { title: string; hypothesis: string; audience: string; successCriteria: string }) {
  return `Write an interview script for this experiment.\n\n${asData("project", ctx)}\n\n${asData("experiment", experiment)}`;
}

export function mockScript(): InterviewScript {
  return {
    goal: "[Mock] Learn how the interviewee handles this task today.",
    intro: "[Mock] Thanks for your time. I'm researching how teams handle this — no pitch, just learning.",
    sections: [
      { title: "Context", questions: ["[Mock] Walk me through the last time you did this task.", "[Mock] How often does that happen?"] },
      { title: "Pain", questions: ["[Mock] What's the hardest part?", "[Mock] What have you tried to fix it?"] },
      { title: "Money", questions: ["[Mock] Have you paid for anything to solve this?"] },
    ],
    avoid: ["[Mock] \"Would you use a tool that…?\" — invites polite yeses."],
    closing: "[Mock] Who else should I talk to about this?",
  };
}

export function scriptToMarkdown(s: InterviewScript): string {
  return [
    `Goal: ${s.goal}`,
    "",
    `Intro: ${s.intro}`,
    "",
    ...s.sections.flatMap((sec) => [`## ${sec.title}`, ...sec.questions.map((q) => `- ${q}`), ""]),
    "## Avoid",
    ...s.avoid.map((a) => `- ${a}`),
    "",
    `Closing: ${s.closing}`,
  ].join("\n");
}

/* --------------------------------------------------------- notes analysis */

export const NOTES_SYSTEM = `You analyse customer interview notes for a validation experiment.
- Use only what is in the notes. Every pain point and willingness-to-pay signal must include "quote": a verbatim excerpt from the notes. Items without a verbatim quote will be discarded.
- Judge whether the notes support, contradict, or are inconclusive about the hypothesis. Be strict: politeness and compliments are not evidence. Your verdict is advisory; only the founder decides if the experiment passed.
- ${UNTRUSTED_DATA_RULE}`;

export function buildNotesPrompt(experiment: { hypothesis: string; successCriteria: string }, notes: string) {
  return `${asData("experiment", experiment)}\n\n${asData("notes", notes)}`;
}

export function mockNotesAnalysis(notes: string): NotesAnalysis {
  const quote = notes.split(/[.!?\n]/).map((s) => s.trim()).find((s) => s.length >= 12) ?? notes.slice(0, 40);
  return {
    summary: "[Mock] Analysis generated without an AI provider.",
    painPoints: [{ point: "[Mock] The interviewee described a pain point.", quote }],
    currentSolutions: ["[Mock] Spreadsheets"],
    willingnessToPay: [],
    hypothesisVerdict: "inconclusive",
    verdictReasoning: "[Mock] One interview is not enough evidence.",
    followUps: ["[Mock] Ask how much time this costs per week."],
  };
}

/* ------------------------------------------------------------ landing copy */

export const LANDING_SYSTEM = `You write copy for a pre-launch validation landing page with a waitlist.
- Base it on the project's research: the problem, target customer and differentiation.
- Be specific and plain. No hype.
- NEVER include testimonials, customer counts, logos, ratings, statistics, "trusted by", awards, or any claim that the product exists or has users. It is a test page for an unbuilt product.
- The call to action is joining a waitlist / getting early access.
- ${UNTRUSTED_DATA_RULE}`;

export function buildLandingPrompt(ctx: ProjectContextData) {
  return `Write landing page copy.\n\n${asData("project", ctx)}`;
}

export function mockLanding(ctx: ProjectContextData): LandingContent {
  return {
    headline: `${ctx.name.replace(/^\[Mock\]\s*/, "").slice(0, 60)}`,
    subheadline: "[Mock] A simpler way to handle this task. Join the waitlist for early access.",
    bullets: ["[Mock] Save time on the repetitive part", "[Mock] Built for small teams", "[Mock] Simple setup"],
    ctaLabel: "Join the waitlist",
  };
}
