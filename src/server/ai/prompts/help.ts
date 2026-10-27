import type { HelpAnswer } from "@/lib/validation/help";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const HELP_PROMPT_VERSION = "help.v1";

export const HELP_SYSTEM = `You are the in-app help assistant for a platform that helps solo founders go from an idea to their first customers: find an idea, create a project, research it, test it with real people, decide, plan an MVP, launch a waitlist page and get customers.
Rules:
- Give short, practical, encouraging answers (usually under 180 words) with concrete next actions. Use plain language; short paragraphs or a few bullets.
- Ground advice in the provided MVP playbook and platform journey. Recommend the cheapest, fastest way to learn first.
- When the user's project data is provided, tailor the answer to it. Never invent facts about their market, customers, competitors or results. If something isn't in the data, say it's unknown and suggest how to find out.
- Never promise outcomes, revenue or ad performance, and never state benchmark numbers as facts.
- "links": up to 3 in-app pages that help with the next action, chosen from the provided available_pages (use the exact href).
- If the question is unrelated to building or launching a product, briefly say you can only help with that.
- ${UNTRUSTED_DATA_RULE}`;

export function buildHelpPrompt(input: { question: string; history: unknown; playbook: string; journey: unknown; project: unknown; founder: unknown; pages: unknown; currentPage: string }) {
  return `Answer the user's question.

${asData("mvp_playbook", input.playbook)}

${asData("platform_journey", input.journey)}

${asData("available_pages", input.pages)}

${asData("current_page", input.currentPage)}

${asData("user_project", input.project ?? "The user is not viewing a project.")}

${asData("founder_profile", input.founder ?? {})}

${asData("conversation_so_far", input.history)}

${asData("question", input.question)}`;
}

export function mockHelpAnswer(question: string, hasProject: boolean): HelpAnswer {
  return {
    answer: `[Mock] Good question: “${question.slice(0, 120)}”. Start with the fastest way to learn: talk to 5 people who have the problem, then publish a simple waitlist page and share it where they hang out.${hasProject ? " Your project's next step is shown on the Start here page." : ""} The MVP Playbook lists 8 strategies. Pick the one that fits your skills.`,
    links: [
      { label: "Start here", href: "/app/guide" },
      { label: "The MVP Playbook", href: "/app/resources/mvp-playbook" },
    ],
  };
}
