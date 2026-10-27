import "server-only";
import type { UserId } from "@/server/data/user-id";
import { getIdeaForProject } from "@/server/data/ideas";
import { requireProject } from "@/server/data/projects";
import { getLatestValidationReport, listCompetitors } from "@/server/data/research";
import { listExperiments } from "@/server/data/experiments";

/**
 * The shared project memory every module reads from, so pricing, landing copy,
 * interviews and plans build on the same research instead of contradicting it.
 */
export async function getProjectContext(userId: UserId, projectId: string) {
  const project = await requireProject(userId, projectId);
  const [idea, report, competitors, experiments] = await Promise.all([
    getIdeaForProject(userId, project.id),
    getLatestValidationReport(userId, project.id),
    listCompetitors(userId, project.id),
    listExperiments(userId, { projectId: project.id }),
  ]);
  const r = report?.report;
  const pick = (key: keyof NonNullable<typeof r>["sections"]) => r?.sections[key].map((s) => ({ text: s.text, kind: s.kind })) ?? [];
  return {
    project,
    hasResearch: !!report,
    context: {
      name: project.name,
      description: project.description,
      idea: idea?.content ?? null,
      research: r
        ? {
            summary: r.summary,
            problem: pick("problem"),
            targetCustomer: pick("targetCustomer"),
            differentiation: pick("differentiation"),
            monetization: pick("monetization"),
            risks: pick("risks"),
            openQuestions: r.openQuestions,
            ratings: r.ratings,
          }
        : null,
      competitors: competitors.map((c) => ({
        name: c.name,
        type: c.type,
        strengths: c.strengths,
        weaknesses: c.weaknesses,
        verifiedPricing: c.pricing && c.pricingSource ? (c.pricing as { summary?: string }).summary ?? null : null,
      })),
      experiments: experiments.map((e) => ({ type: e.type, title: e.title, status: e.status, passed: e.passed, learnings: e.learnings })),
    },
  };
}
export type ProjectContextData = Awaited<ReturnType<typeof getProjectContext>>["context"];
