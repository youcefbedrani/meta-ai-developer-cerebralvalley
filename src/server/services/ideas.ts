import "server-only";
import { CREDIT_COSTS } from "@/lib/plans";
import { ideaInputsSchema, ideasOutputSchema, type IdeaInputsInput } from "@/lib/validation/ideas";
import { buildIdeasPrompt, IDEAS_PROMPT_VERSION, IDEAS_SYSTEM, mockIdeas } from "@/server/ai/prompts/ideas";
import { runWithCredits } from "@/server/ai/run";
import { saveGeneratedIdeas, type Idea } from "@/server/data/ideas";
import { getProfile } from "@/server/data/profiles";
import type { UserId } from "@/server/data/user-id";
import { enforceAiLimits } from "@/server/rate-limit";

/** Generates ideas for the user: validate → rate limit → reserve credits → AI → validate → save. */
export async function generateIdeas(userId: UserId, rawInputs: IdeaInputsInput): Promise<Idea[]> {
  const inputs = ideaInputsSchema.parse(rawInputs);
  await enforceAiLimits(userId);
  const profile = await getProfile(userId);
  const output = await runWithCredits({
    userId,
    operation: "idea_generation",
    tier: "fast",
    credits: CREDIT_COSTS.idea_generation,
    schema: ideasOutputSchema,
    system: IDEAS_SYSTEM,
    prompt: buildIdeasPrompt(inputs, profile),
    mock: () => mockIdeas(inputs),
  });
  return saveGeneratedIdeas(userId, inputs, output.ideas.slice(0, inputs.count), IDEAS_PROMPT_VERSION);
}
