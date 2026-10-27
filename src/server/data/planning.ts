import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { businessModelSchema, mvpPlanSchema, type BusinessModel, type MvpPlan } from "@/lib/validation/planning";
import { getDb, schema } from "@/server/db/client";
import type { UserId } from "./user-id";

const isUuid = (id: string) => z.uuid().safeParse(id).success;
const owns = (userId: UserId, projectId: string) => and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId));

export async function getLatestBusinessModel(userId: UserId, projectId: string): Promise<{ id: string; createdAt: Date; model: BusinessModel; verifiedAnchors: number } | null> {
  if (!isUuid(projectId)) return null;
  const [row] = await getDb()
    .select({ id: schema.reports.id, createdAt: schema.reports.createdAt, content: schema.reports.content })
    .from(schema.reports)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.reports.projectId))
    .where(and(owns(userId, projectId), eq(schema.reports.type, "business_model")))
    .orderBy(desc(schema.reports.createdAt))
    .limit(1);
  if (!row) return null;
  const parsed = z.object({ model: businessModelSchema, meta: z.object({ verifiedAnchors: z.number() }).passthrough() }).safeParse(row.content);
  return parsed.success ? { id: row.id, createdAt: row.createdAt, model: parsed.data.model, verifiedAnchors: parsed.data.meta.verifiedAnchors } : null;
}

export async function getLatestMvpPlan(userId: UserId, projectId: string): Promise<{ id: string; createdAt: Date; plan: MvpPlan } | null> {
  if (!isUuid(projectId)) return null;
  const [row] = await getDb()
    .select({ id: schema.mvpPlans.id, createdAt: schema.mvpPlans.createdAt, content: schema.mvpPlans.content })
    .from(schema.mvpPlans)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.mvpPlans.projectId))
    .where(owns(userId, projectId))
    .orderBy(desc(schema.mvpPlans.createdAt))
    .limit(1);
  if (!row) return null;
  const parsed = mvpPlanSchema.safeParse(row.content);
  return parsed.success ? { id: row.id, createdAt: row.createdAt, plan: parsed.data } : null;
}
