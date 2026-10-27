import "server-only";
import { eq } from "drizzle-orm";
import { CREDIT_COSTS } from "@/lib/plans";
import { BUSINESS_MODEL_SCHEMA_VERSION, businessModelSchema, MVP_PLAN_SCHEMA_VERSION, mvpPlanSchema, type BusinessModel } from "@/lib/validation/planning";
import { BUSINESS_SYSTEM, buildBusinessPrompt, buildMvpPrompt, mockBusinessModel, mockMvpPlan, MVP_SYSTEM, PLANNING_PROMPT_VERSION } from "@/server/ai/prompts/planning";
import { runWithCredits } from "@/server/ai/run";
import { getDb, schema } from "@/server/db/client";
import { getLatestBusinessModel } from "@/server/data/planning";
import { getProfile } from "@/server/data/profiles";
import type { UserId } from "@/server/data/user-id";
import { enforceAiLimits } from "@/server/rate-limit";
import { getProjectContext } from "./project-context";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Keeps only competitor anchors that refer to competitors with source-verified pricing. */
export function verifyAnchors(model: BusinessModel, verifiedNames: string[]): { model: BusinessModel; dropped: number } {
  const allowed = new Set(verifiedNames.map(norm));
  const anchors = model.competitorAnchors.filter((a) => allowed.has(norm(a.competitor)));
  return { model: { ...model, competitorAnchors: anchors }, dropped: model.competitorAnchors.length - anchors.length };
}

export async function generateBusinessModel(userId: UserId, projectId: string) {
  await enforceAiLimits(userId);
  const { project, context } = await getProjectContext(userId, projectId);
  const raw = await runWithCredits({
    userId,
    projectId: project.id,
    operation: "business_model",
    tier: "smart",
    credits: CREDIT_COSTS.business_model,
    schema: businessModelSchema,
    system: BUSINESS_SYSTEM,
    prompt: buildBusinessPrompt(context),
    mock: () => mockBusinessModel(context),
  });
  const verifiedNames = context.competitors.filter((c) => c.verifiedPricing).map((c) => c.name);
  const { model, dropped } = verifyAnchors(raw, verifiedNames);
  await getDb()
    .insert(schema.reports)
    .values({
      projectId: project.id,
      type: "business_model",
      schemaVersion: BUSINESS_MODEL_SCHEMA_VERSION,
      content: { model, meta: { promptVersion: PLANNING_PROMPT_VERSION, verifiedAnchors: model.competitorAnchors.length, droppedAnchors: dropped } },
      summary: model.pricingModel.rationale.slice(0, 500),
    });
  return model;
}

export async function generateMvpPlan(userId: UserId, projectId: string) {
  await enforceAiLimits(userId);
  const { project, context } = await getProjectContext(userId, projectId);
  const [business, profile] = await Promise.all([getLatestBusinessModel(userId, project.id), getProfile(userId)]);
  const plan = await runWithCredits({
    userId,
    projectId: project.id,
    operation: "mvp_plan",
    tier: "smart",
    credits: CREDIT_COSTS.mvp_plan,
    schema: mvpPlanSchema,
    system: MVP_SYSTEM,
    prompt: buildMvpPrompt(context, business?.model ?? null, profile),
    mock: () => mockMvpPlan(context),
  });
  await getDb().insert(schema.mvpPlans).values({ projectId: project.id, content: plan, schemaVersion: MVP_PLAN_SCHEMA_VERSION });
  if (project.stage !== "building" && project.stage !== "launched") {
    // Planning stage reflects the work, not validation (only experiments validate).
    await getDb().update(schema.projects).set({ stage: "planning" }).where(eq(schema.projects.id, project.id));
  }
  return plan;
}
