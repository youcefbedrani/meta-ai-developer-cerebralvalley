import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { MARKET_ROOTS, marketTreeSchema, type MarketTree } from "@/lib/validation/gold-mine";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError } from "./errors";
import type { UserId } from "./user-id";

/*
 * Data access for Gold Mine. Every query is scoped by the verified userId;
 * child rows (demand checks, quotes, clusters) are only reachable through a
 * session the user owns.
 */

const isUuid = (id: string) => z.uuid().safeParse(id).success;

export type GoldMineSession = typeof schema.goldMineSessions.$inferSelect;
export type DemandCheckRow = typeof schema.demandChecks.$inferSelect;
export type PainQuote = typeof schema.painQuotes.$inferSelect;
export type PainCluster = typeof schema.painClusters.$inferSelect & { quotes: (PainQuote & { isBest: boolean })[] };

/* ------------------------------------------------------------ market map */

export function initialMarketTree(): MarketTree {
  return { nodes: MARKET_ROOTS.map((r) => ({ id: r.id, parentId: null, label: r.label, description: r.description, depth: 0, expanded: false })) };
}

export async function getMarketMap(userId: UserId): Promise<MarketTree> {
  const [row] = await getDb().select({ tree: schema.marketMaps.tree }).from(schema.marketMaps).where(eq(schema.marketMaps.userId, userId));
  const parsed = row ? marketTreeSchema.safeParse(row.tree) : null;
  return parsed?.success ? parsed.data : initialMarketTree();
}

export async function saveMarketMap(userId: UserId, tree: MarketTree): Promise<void> {
  const data = marketTreeSchema.parse(tree);
  await getDb().insert(schema.marketMaps).values({ userId, tree: data }).onConflictDoUpdate({ target: schema.marketMaps.userId, set: { tree: data } });
}

/* --------------------------------------------------------------- sessions */

export async function createSession(
  userId: UserId,
  input: { mode: "market" | "idea"; niche: string; ideaDescription?: string | null; marketPath?: string[] | null },
): Promise<GoldMineSession> {
  const [row] = await getDb()
    .insert(schema.goldMineSessions)
    .values({ userId, mode: input.mode, niche: input.niche.trim().slice(0, 120), ideaDescription: input.ideaDescription?.trim() || null, marketPath: input.marketPath ?? null, currentStep: "demand" })
    .returning();
  return row;
}

export async function getSession(userId: UserId, sessionId: string): Promise<GoldMineSession | null> {
  if (!isUuid(sessionId)) return null;
  const [row] = await getDb()
    .select()
    .from(schema.goldMineSessions)
    .where(and(eq(schema.goldMineSessions.id, sessionId), eq(schema.goldMineSessions.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function requireSession(userId: UserId, sessionId: string): Promise<GoldMineSession> {
  const s = await getSession(userId, sessionId);
  if (!s) throw new NotFoundError("Gold Mine session");
  return s;
}

export async function listSessions(userId: UserId): Promise<GoldMineSession[]> {
  return getDb()
    .select()
    .from(schema.goldMineSessions)
    .where(and(eq(schema.goldMineSessions.userId, userId), inArray(schema.goldMineSessions.status, ["active", "completed"])))
    .orderBy(desc(schema.goldMineSessions.updatedAt))
    .limit(50);
}

type SessionPatch = Partial<Pick<GoldMineSession, "currentStep" | "status" | "demandSummary" | "demandAcknowledged" | "projectId" | "landingPageId">>;

export async function updateSession(userId: UserId, sessionId: string, patch: SessionPatch): Promise<void> {
  const s = await requireSession(userId, sessionId);
  await getDb().update(schema.goldMineSessions).set(patch).where(eq(schema.goldMineSessions.id, s.id));
}

export async function archiveSession(userId: UserId, sessionId: string): Promise<void> {
  await updateSession(userId, sessionId, { status: "archived" });
}

/* ----------------------------------------------------------------- demand */

export async function listDemandChecks(userId: UserId, sessionId: string): Promise<DemandCheckRow[]> {
  if (!isUuid(sessionId)) return [];
  return getDb()
    .select()
    .from(schema.demandChecks)
    .where(and(eq(schema.demandChecks.sessionId, sessionId), eq(schema.demandChecks.userId, userId)))
    .orderBy(desc(schema.demandChecks.volume));
}

export async function replaceDemandChecks(
  userId: UserId,
  sessionId: string,
  rows: Omit<typeof schema.demandChecks.$inferInsert, "userId" | "sessionId">[],
): Promise<void> {
  const s = await requireSession(userId, sessionId);
  await getDb().transaction(async (tx) => {
    await tx.delete(schema.demandChecks).where(eq(schema.demandChecks.sessionId, s.id));
    if (rows.length) await tx.insert(schema.demandChecks).values(rows.map((r) => ({ ...r, userId, sessionId: s.id })));
  });
}

/* ----------------------------------------------------------- pains & quotes */

export async function listPainQuotes(userId: UserId, sessionId: string): Promise<PainQuote[]> {
  if (!isUuid(sessionId)) return [];
  return getDb()
    .select()
    .from(schema.painQuotes)
    .where(and(eq(schema.painQuotes.sessionId, sessionId), eq(schema.painQuotes.userId, userId)))
    .orderBy(desc(schema.painQuotes.postedAt));
}

export async function listClusters(userId: UserId, sessionId: string): Promise<PainCluster[]> {
  if (!isUuid(sessionId)) return [];
  const db = getDb();
  const clusters = await db
    .select()
    .from(schema.painClusters)
    .where(and(eq(schema.painClusters.sessionId, sessionId), eq(schema.painClusters.userId, userId)))
    .orderBy(asc(schema.painClusters.rank));
  if (!clusters.length) return [];
  const links = await db
    .select({ clusterId: schema.painClusterQuotes.clusterId, isBest: schema.painClusterQuotes.isBest, q: schema.painQuotes })
    .from(schema.painClusterQuotes)
    .innerJoin(schema.painQuotes, eq(schema.painQuotes.id, schema.painClusterQuotes.quoteId))
    .where(and(inArray(schema.painClusterQuotes.clusterId, clusters.map((c) => c.id)), eq(schema.painQuotes.userId, userId)));
  return clusters.map((c) => ({
    ...c,
    quotes: links
      .filter((l) => l.clusterId === c.id)
      .map((l) => ({ ...l.q, isBest: l.isBest }))
      .sort((a, b) => Number(b.isBest) - Number(a.isBest)),
  }));
}

/* ------------------------------------------------------------------ ideas */

export async function listSessionIdeas(userId: UserId, sessionId: string) {
  if (!isUuid(sessionId)) return [];
  const db = getDb();
  const ideas = await db
    .select()
    .from(schema.ideas)
    .where(and(eq(schema.ideas.goldMineSessionId, sessionId), eq(schema.ideas.userId, userId)))
    .orderBy(desc(schema.ideas.createdAt));
  if (!ideas.length) return [];
  const links = await db.select().from(schema.ideaPainLinks).where(inArray(schema.ideaPainLinks.ideaId, ideas.map((i) => i.id)));
  return ideas.map((i) => ({ ...i, clusterIds: links.filter((l) => l.ideaId === i.id).map((l) => l.clusterId) }));
}

/** Pain clusters (with quotes) linked to an idea the user owns. */
export async function getIdeaEvidence(userId: UserId, ideaId: string): Promise<PainCluster[]> {
  if (!isUuid(ideaId)) return [];
  const db = getDb();
  const [idea] = await db
    .select({ sessionId: schema.ideas.goldMineSessionId })
    .from(schema.ideas)
    .where(and(eq(schema.ideas.id, ideaId), eq(schema.ideas.userId, userId)));
  if (!idea?.sessionId) return [];
  const links = await db.select({ clusterId: schema.ideaPainLinks.clusterId }).from(schema.ideaPainLinks).where(eq(schema.ideaPainLinks.ideaId, ideaId));
  const ids = new Set(links.map((l) => l.clusterId));
  return (await listClusters(userId, idea.sessionId)).filter((c) => ids.has(c.id));
}

/* ------------------------------------------------------- customer language */

export type CustomerQuote = typeof schema.customerLanguageQuotes.$inferSelect;

export async function listCustomerLanguage(userId: UserId, projectId: string): Promise<CustomerQuote[]> {
  if (!isUuid(projectId)) return [];
  return getDb()
    .select()
    .from(schema.customerLanguageQuotes)
    .where(and(eq(schema.customerLanguageQuotes.projectId, projectId), eq(schema.customerLanguageQuotes.userId, userId)))
    .orderBy(asc(schema.customerLanguageQuotes.clusterTitle), desc(schema.customerLanguageQuotes.postedAt));
}
