import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/server/db/client";
import { ideaContentSchema, type IdeaContent, type IdeaInputs, type IdeaListQuery } from "@/lib/validation/ideas";
import { NotFoundError } from "./errors";
import type { UserId } from "./user-id";

/*
 * Data-access layer for ideas. Every query is scoped by the verified userId;
 * ideas owned by someone else behave as if they don't exist.
 */

export type Idea = Omit<typeof schema.ideas.$inferSelect, "content"> & { content: IdeaContent };
type IdeaStatus = "generated" | "saved" | "dismissed" | "converted";

const isUuid = (id: string) => z.uuid().safeParse(id).success;
const owned = (userId: UserId, id: string) => and(eq(schema.ideas.id, id), eq(schema.ideas.userId, userId));

function parse(row: typeof schema.ideas.$inferSelect): Idea | null {
  const content = ideaContentSchema.safeParse(row.content);
  return content.success ? { ...row, content: content.data } : null;
}

export async function saveGeneratedIdeas(
  userId: UserId,
  inputs: IdeaInputs,
  ideas: IdeaContent[],
  promptVersion: string,
): Promise<Idea[]> {
  if (!ideas.length) return [];
  const rows = await getDb()
    .insert(schema.ideas)
    .values(ideas.map((content) => ({ userId, title: content.title, content, inputs, promptVersion })))
    .returning();
  return rows.map(parse).filter((i): i is Idea => i !== null);
}

export async function listIdeas(userId: UserId, query: IdeaListQuery): Promise<Idea[]> {
  const where: SQL[] = [eq(schema.ideas.userId, userId)];
  if (query.status !== "all") where.push(eq(schema.ideas.status, query.status));
  else where.push(sql`${schema.ideas.status} <> 'dismissed'`);
  if (query.complexity !== "all") where.push(sql`${schema.ideas.content}->>'complexity' = ${query.complexity}`);
  if (query.q) {
    const term = `%${query.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(schema.ideas.title, term), sql`${schema.ideas.content}->>'problem' ilike ${term}`)!);
  }
  const order =
    query.sort === "oldest"
      ? [asc(schema.ideas.createdAt)]
      : query.sort === "complexity"
        ? [sql`case ${schema.ideas.content}->>'complexity' when 'low' then 0 when 'medium' then 1 else 2 end`, desc(schema.ideas.createdAt)]
        : [desc(schema.ideas.createdAt)];
  const rows = await getDb().select().from(schema.ideas).where(and(...where)).orderBy(...order).limit(200);
  return rows.map(parse).filter((i): i is Idea => i !== null);
}

export async function getIdea(userId: UserId, ideaId: string): Promise<Idea | null> {
  if (!isUuid(ideaId)) return null;
  const [row] = await getDb().select().from(schema.ideas).where(owned(userId, ideaId)).limit(1);
  return row ? parse(row) : null;
}

/** Fetches up to 4 of the caller's ideas, in the order requested. Unknown or foreign ids are skipped. */
export async function getIdeasForComparison(userId: UserId, ids: string[]): Promise<Idea[]> {
  const valid = [...new Set(ids.filter(isUuid))].slice(0, 4);
  if (!valid.length) return [];
  const rows = await getDb()
    .select()
    .from(schema.ideas)
    .where(and(eq(schema.ideas.userId, userId), inArray(schema.ideas.id, valid)));
  const byId = new Map(rows.map((r) => [r.id, parse(r)]));
  return valid.map((id) => byId.get(id)).filter((i): i is Idea => !!i);
}

export async function setIdeaStatus(userId: UserId, ideaId: string, status: Exclude<IdeaStatus, "converted">): Promise<void> {
  if (!isUuid(ideaId)) throw new NotFoundError("Idea");
  const updated = await getDb()
    .update(schema.ideas)
    .set({ status })
    // A converted idea keeps its link to the project.
    .where(and(owned(userId, ideaId), sql`${schema.ideas.status} <> 'converted'`))
    .returning({ id: schema.ideas.id });
  if (!updated.length) {
    if (!(await getIdea(userId, ideaId))) throw new NotFoundError("Idea");
  }
}

/** Creates a project from an idea (or returns the existing one) and links them. */
export async function convertIdeaToProject(userId: UserId, ideaId: string): Promise<{ projectId: string }> {
  const idea = await getIdea(userId, ideaId);
  if (!idea) throw new NotFoundError("Idea");
  if (idea.projectId) return { projectId: idea.projectId };

  const c = idea.content;
  const description = [
    c.oneLiner,
    "",
    `Problem: ${c.problem}`,
    `Target customer: ${c.targetCustomer}`,
    `Solution: ${c.solution}`,
    `Differentiation (hypothesis): ${c.differentiationHypothesis}`,
  ]
    .join("\n")
    .slice(0, 2000);

  return getDb().transaction(async (tx) => {
    const [project] = await tx
      .insert(schema.projects)
      .values({
        userId,
        name: c.title.replace(/^\[Mock\]\s*/, "").slice(0, 80),
        description,
        stage: "idea",
        nextAction: `Run research, then: ${c.firstExperiment.description}`.slice(0, 300),
      })
      .returning({ id: schema.projects.id });
    await tx.update(schema.ideas).set({ projectId: project.id, status: "converted" }).where(owned(userId, ideaId));

    // Gold Mine ideas: copy the linked pain quotes into the project's customer-language library.
    const quotes = await tx
      .select({ q: schema.painQuotes, clusterTitle: schema.painClusters.title })
      .from(schema.ideaPainLinks)
      .innerJoin(schema.painClusters, eq(schema.painClusters.id, schema.ideaPainLinks.clusterId))
      .innerJoin(schema.painClusterQuotes, eq(schema.painClusterQuotes.clusterId, schema.painClusters.id))
      .innerJoin(schema.painQuotes, eq(schema.painQuotes.id, schema.painClusterQuotes.quoteId))
      .where(and(eq(schema.ideaPainLinks.ideaId, ideaId), eq(schema.painQuotes.userId, userId)));
    if (quotes.length) {
      await tx
        .insert(schema.customerLanguageQuotes)
        .values(
          quotes.map(({ q, clusterTitle }) => ({
            userId,
            projectId: project.id,
            sourceQuoteId: q.id,
            clusterTitle,
            quote: q.quote,
            url: q.url,
            platform: q.platform,
            community: q.community,
            postedAt: q.postedAt,
            retrievedAt: q.retrievedAt,
          })),
        )
        .onConflictDoNothing();
    }
    return { projectId: project.id };
  });
}

/** The idea a project was created from, if any (used by later modules as context). */
export async function getIdeaForProject(userId: UserId, projectId: string): Promise<Idea | null> {
  if (!isUuid(projectId)) return null;
  const [row] = await getDb()
    .select()
    .from(schema.ideas)
    .where(and(eq(schema.ideas.userId, userId), eq(schema.ideas.projectId, projectId)))
    .limit(1);
  return row ? parse(row) : null;
}
