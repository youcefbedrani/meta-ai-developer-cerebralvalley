import "server-only";
import { and, eq } from "drizzle-orm";
import { manualCompetitorSchema, type ManualCompetitorInput } from "@/lib/validation/competitors";
import { getDb, schema } from "@/server/db/client";
import { competitorKey } from "@/server/jobs/research/pipeline";
import { NotFoundError, UserFacingError } from "./errors";
import { requireProject } from "./projects";
import type { UserId } from "./user-id";

/** A competitor the user knows about. Stored as origin "manual" and shown as unverified until a scan finds it in a source. */
export async function addManualCompetitor(userId: UserId, projectId: string, input: ManualCompetitorInput) {
  const project = await requireProject(userId, projectId);
  const data = manualCompetitorSchema.parse(input);
  const existing = await getDb().select({ name: schema.competitors.name }).from(schema.competitors).where(eq(schema.competitors.projectId, project.id));
  if (existing.some((c) => competitorKey(c.name) === competitorKey(data.name))) throw new UserFacingError("This competitor is already in your list.");
  const [row] = await getDb()
    .insert(schema.competitors)
    .values({ projectId: project.id, origin: "manual", name: data.name, website: data.website, type: data.type, notes: data.notes })
    .returning({ id: schema.competitors.id });
  return row;
}

export async function deleteCompetitor(userId: UserId, projectId: string, competitorId: string) {
  const project = await requireProject(userId, projectId);
  const deleted = await getDb()
    .delete(schema.competitors)
    .where(and(eq(schema.competitors.id, competitorId), eq(schema.competitors.projectId, project.id)))
    .returning({ id: schema.competitors.id });
  if (!deleted.length) throw new NotFoundError("Competitor");
}
