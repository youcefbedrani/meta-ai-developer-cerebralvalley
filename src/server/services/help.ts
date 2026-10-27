import "server-only";
import { getIntegrationStatus, ConfigError } from "@/lib/env";
import { JOURNEY, nextStep } from "@/lib/journey";
import { CREDIT_COSTS } from "@/lib/plans";
import { MVP_PLAYBOOK, playbookDigest } from "@/lib/resources/mvp-playbook";
import { helpAnswerSchema, helpQuestionSchema, projectIdFromPath, safeHelpLinks, type HelpAnswer } from "@/lib/validation/help";
import { buildHelpPrompt, HELP_SYSTEM, mockHelpAnswer } from "@/server/ai/prompts/help";
import { callStructured, withCredits } from "@/server/ai/run";
import { getJourneyProgress } from "@/server/data/journey";
import { getProfile } from "@/server/data/profiles";
import type { UserId } from "@/server/data/user-id";
import { enforceAiLimits } from "@/server/rate-limit";
import { getProjectContext } from "./project-context";

const PROJECT_TABS = ["research", "competitors", "language", "validation", "plan", "marketing"];

/** Answers a help question, grounded in the playbook, the journey and (if viewing one) the user's own project. */
export async function askHelp(userId: UserId, input: unknown): Promise<HelpAnswer> {
  const ai = getIntegrationStatus("ai");
  if (!ai.configured) throw new ConfigError("ai", ai.missing);
  const { question, history, pathname } = helpQuestionSchema.parse(input);
  await enforceAiLimits(userId);

  const pathProject = projectIdFromPath(pathname);
  // getProjectContext enforces ownership; a foreign or unknown id just means "no project".
  const project = pathProject ? await getProjectContext(userId, pathProject).catch(() => null) : null;
  const projectId = project ? project.project.id : null;
  const [{ progress }, profile] = await Promise.all([getJourneyProgress(userId), getProfile(userId)]);

  const pages = [
    { label: "Start here (journey guide)", href: "/app/guide" },
    { label: "The MVP Playbook", href: `/app/resources/${MVP_PLAYBOOK.slug}` },
    ...MVP_PLAYBOOK.strategies.map((s) => ({ label: `Playbook: ${s.name}`, href: `/app/resources/${MVP_PLAYBOOK.slug}#strategy-${s.id}` })),
    { label: "Gold Mine", href: "/app/gold-mine" },
    { label: "Discover Ideas", href: "/app/ideas" },
    { label: "New project", href: "/app/projects/new" },
    { label: "Validation Lab", href: "/app/lab" },
    { label: "Marketing Studio", href: "/app/marketing" },
    ...(projectId ? PROJECT_TABS.map((t) => ({ label: `This project: ${t}`, href: `/app/projects/${projectId}/${t}` })) : []),
  ];
  const next = nextStep(progress);

  return withCredits(userId, "help_question", CREDIT_COSTS.help_question, async () => {
    const out = await callStructured({
      userId,
      projectId,
      operation: "help_question",
      tier: "fast",
      schema: helpAnswerSchema,
      system: HELP_SYSTEM,
      prompt: buildHelpPrompt({
        question,
        history,
        playbook: playbookDigest(),
        journey: { steps: JOURNEY.flatMap((p) => p.steps.map((s) => ({ phase: p.title, step: s.title, done: progress[s.id] }))), nextStep: next?.title ?? "All steps done" },
        project: project?.context ?? null,
        founder: profile ? { skills: profile.skills, technicalLevel: profile.technicalLevel, budget: profile.budget, timePerWeek: profile.timePerWeek } : null,
        pages,
        currentPage: pathname,
      }),
      maxOutputTokens: 2_000,
      mock: () => mockHelpAnswer(question, !!projectId),
    });
    return { answer: out.answer, links: safeHelpLinks(out.links, projectId) };
  });
}
