import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { buildBrief, buildMessages, cacheNormalise, copilotMessageSchema, systemFor, threadTitle, toolById, type ChatMessage } from "@/lib/copilot";
import { getIntegrationStatus, ConfigError } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { getPlatformSettings } from "@/server/platform/settings";
import { callText, withCredits } from "@/server/ai/run";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError } from "@/server/data/errors";
import { requireProject } from "@/server/data/projects";
import { listCompetitors } from "@/server/data/research";
import type { UserId } from "@/server/data/user-id";
import { enforceAiLimits } from "@/server/rate-limit";
import { getRedis } from "@/server/redis";
import { getDesignContext } from "./design";

/*
 * AI Copilot conversations. Each message: rate limit → answer cache → credits → token budget → model.
 * The answer cache covers first messages only (the same request with the same tool and project brief),
 * so a repeated question is answered instantly and free. Follow-ups always go to the model.
 */

const CACHE_TTL_SECONDS = 7 * 86_400;

/** A short brief of the project (never the whole project), or null when no project is selected. */
export async function getCopilotBrief(userId: UserId, projectId: string | null | undefined): Promise<string | null> {
  if (!projectId) return null;
  await requireProject(userId, projectId);
  const [{ ctx }, competitors] = await Promise.all([getDesignContext(userId, projectId), listCompetitors(userId, projectId)]);
  const prices = competitors.flatMap((c) =>
    (c.pricingPlans ?? []).filter((p) => p.priceMonthly !== null).slice(0, 1).map((p) => `${c.name} ${p.name} ${p.currency.toUpperCase()} ${p.priceMonthly}/mo`),
  );
  return buildBrief({
    name: ctx.name,
    oneLiner: ctx.summary || ctx.description,
    targetUser: ctx.targetUser,
    problem: ctx.problem,
    differentiation: ctx.differentiation,
    features: ctx.features.map((f) => f.feature),
    customerWords: ctx.customerWords,
    competitorPrices: prices,
    brand: ctx.brand ? { tagline: ctx.brand.tagline, voice: ctx.brand.voice } : null,
  });
}

const cacheKey = (userId: string, tool: string, brief: string | null, message: string) =>
  `copilot:answer:${createHash("sha256").update(JSON.stringify([userId, tool, brief ?? "", cacheNormalise(message)])).digest("hex")}`;

async function ownedThread(userId: UserId, threadId: string) {
  const [t] = await getDb().select().from(schema.copilotThreads).where(and(eq(schema.copilotThreads.id, threadId), eq(schema.copilotThreads.userId, userId))).limit(1);
  if (!t) throw new NotFoundError("Conversation");
  return t;
}

export type CopilotReply = { threadId: string; message: { id: string; role: "assistant"; content: string; cached: boolean; createdAt: Date } };

/** Sends one message and returns the Copilot's reply (saving both to the conversation). */
export async function sendCopilotMessage(userId: UserId, raw: unknown): Promise<CopilotReply> {
  const ai = getIntegrationStatus("ai");
  if (!ai.configured) throw new ConfigError("ai", ai.missing);
  const input = copilotMessageSchema.parse(raw);
  const db = getDb();

  // Continue a conversation (its tool and project win), or start a new one.
  const existing = input.threadId ? await ownedThread(userId, input.threadId) : null;
  const tool = toolById(existing?.tool ?? input.tool);
  const projectId = existing ? existing.projectId : (input.projectId ?? null);
  const history: ChatMessage[] = existing
    ? (await db.select({ role: schema.copilotMessages.role, content: schema.copilotMessages.content }).from(schema.copilotMessages).where(eq(schema.copilotMessages.threadId, existing.id)).orderBy(asc(schema.copilotMessages.createdAt)))
    : [];
  const brief = await getCopilotBrief(userId, projectId);

  const save = async (reply: { content: string; cached: boolean; tokensIn: number; tokensOut: number }) =>
    db.transaction(async (tx) => {
      const thread = existing ?? (await tx.insert(schema.copilotThreads).values({ userId, projectId, tool: tool.id, title: threadTitle(input.message) }).returning())[0];
      await tx.insert(schema.copilotMessages).values({ threadId: thread.id, role: "user", content: input.message });
      const [msg] = await tx.insert(schema.copilotMessages).values({ threadId: thread.id, role: "assistant", content: reply.content, cached: reply.cached, tokensIn: reply.tokensIn, tokensOut: reply.tokensOut }).returning();
      await tx.update(schema.copilotThreads).set({ updatedAt: new Date() }).where(eq(schema.copilotThreads.id, thread.id));
      return { threadId: thread.id, message: { id: msg.id, role: "assistant" as const, content: msg.content, cached: msg.cached, createdAt: msg.createdAt } };
    });

  // Repeated first question: answer from the cache. No AI call, no credits, no tokens.
  const key = history.length === 0 ? cacheKey(userId, tool.id, brief, input.message) : null;
  if (key) {
    const hit = await getRedis().get(key);
    if (hit) return save({ content: hit, cached: true, tokensIn: 0, tokensOut: 0 });
  }

  await enforceAiLimits(userId);
  const { maxReplyTokens } = (await getPlatformSettings()).aiLimits;
  const result = await withCredits(userId, "copilot_message", CREDIT_COSTS.copilot_message, () =>
    callText({
      userId,
      projectId,
      operation: `copilot:${tool.id}`,
      tier: "fast",
      system: systemFor(tool),
      messages: buildMessages(history, input.message, brief),
      maxOutputTokens: Math.min(tool.maxReplyTokens, maxReplyTokens),
      verbosity: tool.verbosity,
      mock: () => mockReply(tool.label, input.message, !!brief),
    }),
  );
  if (key) await getRedis().set(key, result.text, "EX", CACHE_TTL_SECONDS).catch(() => {});
  return save({ content: result.text, cached: false, tokensIn: result.tokensIn, tokensOut: result.tokensOut });
}

export async function listCopilotThreads(userId: UserId) {
  return getDb()
    .select({ id: schema.copilotThreads.id, title: schema.copilotThreads.title, tool: schema.copilotThreads.tool, projectId: schema.copilotThreads.projectId, updatedAt: schema.copilotThreads.updatedAt })
    .from(schema.copilotThreads)
    .where(eq(schema.copilotThreads.userId, userId))
    .orderBy(desc(schema.copilotThreads.updatedAt))
    .limit(30);
}

export async function getCopilotThread(userId: UserId, threadId: string) {
  if (!/^[0-9a-f-]{36}$/.test(threadId)) return null;
  const thread = await ownedThread(userId, threadId).catch(() => null);
  if (!thread) return null;
  const messages = await getDb()
    .select({ id: schema.copilotMessages.id, role: schema.copilotMessages.role, content: schema.copilotMessages.content, cached: schema.copilotMessages.cached, createdAt: schema.copilotMessages.createdAt })
    .from(schema.copilotMessages)
    .where(eq(schema.copilotMessages.threadId, thread.id))
    .orderBy(asc(schema.copilotMessages.createdAt));
  return { thread, messages };
}

export async function deleteCopilotThread(userId: UserId, threadId: string) {
  const thread = await ownedThread(userId, threadId);
  await getDb().delete(schema.copilotThreads).where(eq(schema.copilotThreads.id, thread.id));
}

function mockReply(tool: string, message: string, hasProject: boolean): string {
  return `## [Mock] ${tool}\n\nHere's a draft for: "${message.slice(0, 80)}"\n\n1. **Option one:** a clear headline that names the customer's pain.\n2. **Option two:** an outcome-first version.\n3. **Option three:** a short, curious version.\n\n## Tips\n- ${hasProject ? "I used your project brief for the customer and their words." : "Select a project so I can use your customer's own words."}\n- Test two options and keep the winner.\n\n_Mock mode: set AI_PROVIDER=openai and an API key for real answers._`;
}
