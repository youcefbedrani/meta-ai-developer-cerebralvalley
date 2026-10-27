import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db/client";
import {
  createProjectSchema,
  projectIdSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/validation/project";
import { NotFoundError } from "./errors";
import type { UserId } from "./user-id";

/*
 * Data-access layer for projects.
 * Every query filters by the verified `userId`. A project owned by someone
 * else behaves exactly like a project that does not exist.
 */

export type Project = typeof schema.projects.$inferSelect;

const owned = (userId: UserId, projectId: string) =>
  and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId));

export async function listProjects(
  userId: UserId,
  opts: { status?: "active" | "archived" } = {},
): Promise<Project[]> {
  const where = opts.status
    ? and(eq(schema.projects.userId, userId), eq(schema.projects.status, opts.status))
    : eq(schema.projects.userId, userId);
  return getDb().select().from(schema.projects).where(where).orderBy(desc(schema.projects.updatedAt));
}

export async function getProject(userId: UserId, projectId: string): Promise<Project | null> {
  if (!projectIdSchema.safeParse(projectId).success) return null;
  const [row] = await getDb().select().from(schema.projects).where(owned(userId, projectId)).limit(1);
  return row ?? null;
}

export async function requireProject(userId: UserId, projectId: string): Promise<Project> {
  const project = await getProject(userId, projectId);
  if (!project) throw new NotFoundError("Project");
  return project;
}

export async function createProject(userId: UserId, input: CreateProjectInput): Promise<Project> {
  const data = createProjectSchema.parse(input);
  const [row] = await getDb()
    .insert(schema.projects)
    .values({ ...data, userId, nextAction: "Run your first research on this idea" })
    .returning();
  return row;
}

export async function updateProject(userId: UserId, projectId: string, input: UpdateProjectInput): Promise<Project> {
  if (!projectIdSchema.safeParse(projectId).success) throw new NotFoundError("Project");
  const data = updateProjectSchema.parse(input);
  const [row] = await getDb().update(schema.projects).set(data).where(owned(userId, projectId)).returning();
  if (!row) throw new NotFoundError("Project");
  return row;
}

export async function setProjectStatus(
  userId: UserId,
  projectId: string,
  status: "active" | "archived",
): Promise<Project> {
  if (!projectIdSchema.safeParse(projectId).success) throw new NotFoundError("Project");
  const [row] = await getDb().update(schema.projects).set({ status }).where(owned(userId, projectId)).returning();
  if (!row) throw new NotFoundError("Project");
  return row;
}

export async function deleteProject(userId: UserId, projectId: string): Promise<void> {
  if (!projectIdSchema.safeParse(projectId).success) throw new NotFoundError("Project");
  const deleted = await getDb()
    .delete(schema.projects)
    .where(owned(userId, projectId))
    .returning({ id: schema.projects.id });
  if (deleted.length === 0) throw new NotFoundError("Project");
}

export async function countProjects(userId: UserId): Promise<{ active: number; archived: number }> {
  const rows = await getDb()
    .select({ status: schema.projects.status })
    .from(schema.projects)
    .where(eq(schema.projects.userId, userId));
  return {
    active: rows.filter((r) => r.status === "active").length,
    archived: rows.filter((r) => r.status === "archived").length,
  };
}
