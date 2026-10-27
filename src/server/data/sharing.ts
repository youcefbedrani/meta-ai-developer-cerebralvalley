import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError } from "./errors";
import type { UserId } from "./user-id";

/** Turns the read-only report link on (new unguessable token) or off. Turning it on again makes a new link. */
export async function setProjectSharing(userId: UserId, projectId: string, on: boolean): Promise<string | null> {
  const token = on ? randomBytes(18).toString("base64url") : null;
  const updated = await getDb()
    .update(schema.projects)
    .set({ shareToken: token })
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .returning({ id: schema.projects.id });
  if (!updated.length) throw new NotFoundError("Project");
  return token;
}
