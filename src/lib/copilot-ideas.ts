/*
 * Product ideas in Copilot replies (written in the idea format of COPILOT_SYSTEM), so each one can become a
 * project with one click. Pure, and kept apart from copilot.ts so the browser doesn't load the system prompt.
 */

/** A product idea in a Copilot reply, written in the idea format of COPILOT_SYSTEM. */
export type CopilotIdea = { title: string; oneLiner: string; customer: string; problem: string; solution: string };

// Models sometimes number the heading ("1. ### Idea: …") or bold it instead ("**Idea: …**").
const IDEA_HEADING = /^(?:\d+[.)]\s*)?(?:#{2,4}\s+|\*\*)(?:\d+[.)]\s*)?(?:💡\s*)?idea(?:\s*\d+)?\s*[:\-–—]\s*(.+?)(?:\*\*)?$/i;
const IDEA_FIELD = /^\s*[-*•]\s*\*{0,2}(one-liner|customer|problem|solution)\*{0,2}\s*:\s*\*{0,2}\s*(.+)$/i;
const plain = (s: string) => s.replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();

/** Ideas in a reply. An idea counts only with a name, a customer and a problem, so ordinary lists never get buttons. */
export function parseCopilotIdeas(text: string): CopilotIdea[] {
  const ideas: CopilotIdea[] = [];
  let current: CopilotIdea | null = null;
  const flush = () => {
    if (current && current.title && current.customer && current.problem) ideas.push(current);
    current = null;
  };
  for (const line of text.split("\n")) {
    const h = line.trim().match(IDEA_HEADING);
    if (h) {
      flush();
      current = { title: plain(h[1]).replace(/^\d+[.)]\s*/, "").slice(0, 80), oneLiner: "", customer: "", problem: "", solution: "" };
      continue;
    }
    if (/^(?:\d+[.)]\s*)?#{1,4}\s/.test(line.trim())) flush();
    const f = current && line.match(IDEA_FIELD);
    if (current && f) {
      const key = f[1].toLowerCase() === "one-liner" ? "oneLiner" : (f[1].toLowerCase() as "customer" | "problem" | "solution");
      current[key] = plain(f[2]).slice(0, 400);
    }
  }
  flush();
  return ideas.slice(0, 10);
}

/** The project description for an idea, in the same shape as ideas from the idea generator. */
export function copilotIdeaDescription(idea: CopilotIdea): string {
  return [idea.oneLiner, "", `Problem: ${idea.problem}`, `Target customer: ${idea.customer}`, idea.solution ? `Solution: ${idea.solution}` : ""]
    .filter((l, i) => i === 1 || l)
    .join("\n")
    .trim()
    .slice(0, 2000);
}

/** The question the Autopilot focuses on for an idea: "Would solo dog groomers pay for Deposit Booker?" */
export function copilotIdeaGoal(idea: CopilotIdea): string {
  const who = idea.customer.replace(/[.;:,!]+$/, "").replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());
  return `Would ${who} pay for ${idea.title}?`.slice(0, 500);
}
