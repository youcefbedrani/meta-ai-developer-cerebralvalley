import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { channelResultSchema, gtmSetupSchema, parseStoredPlan, taskStatusSchema, type GtmSetup, type MarketingPlan } from "@/lib/validation/marketing";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError } from "./errors";
import { requireProject } from "./projects";
import type { UserId } from "./user-id";

/* Marketing data, always scoped by the verified userId. */

const isUuid = (id: string) => z.uuid().safeParse(id).success;
export type MarketingTask = typeof schema.marketingTasks.$inferSelect;
export type ChannelResult = typeof schema.channelResults.$inferSelect;

export async function getLatestMarketingPlan(userId: UserId, projectId: string): Promise<{ id: string; createdAt: Date; plan: MarketingPlan; legacy: boolean; inputs: GtmSetup | null } | null> {
  if (!isUuid(projectId)) return null;
  const [row] = await getDb()
    .select()
    .from(schema.marketingPlans)
    .where(and(eq(schema.marketingPlans.projectId, projectId), eq(schema.marketingPlans.userId, userId)))
    .orderBy(desc(schema.marketingPlans.createdAt))
    .limit(1);
  if (!row) return null;
  const parsed = parseStoredPlan(row.content);
  const inputs = gtmSetupSchema.safeParse(row.inputs);
  return parsed ? { id: row.id, createdAt: row.createdAt, ...parsed, inputs: inputs.success ? inputs.data : null } : null;
}

export async function listMarketingTasks(userId: UserId, planId: string): Promise<MarketingTask[]> {
  if (!isUuid(planId)) return [];
  return getDb()
    .select()
    .from(schema.marketingTasks)
    .where(and(eq(schema.marketingTasks.planId, planId), eq(schema.marketingTasks.userId, userId)))
    .orderBy(asc(schema.marketingTasks.week), asc(schema.marketingTasks.position));
}

export async function setMarketingTaskStatus(userId: UserId, taskId: string, status: z.input<typeof taskStatusSchema>): Promise<void> {
  const s = taskStatusSchema.parse(status);
  if (!isUuid(taskId)) throw new NotFoundError("Task");
  const updated = await getDb()
    .update(schema.marketingTasks)
    .set({ status: s, completedAt: s === "done" ? new Date() : null })
    .where(and(eq(schema.marketingTasks.id, taskId), eq(schema.marketingTasks.userId, userId)))
    .returning({ id: schema.marketingTasks.id });
  if (!updated.length) throw new NotFoundError("Task");
}

export async function addChannelResult(userId: UserId, projectId: string, input: z.input<typeof channelResultSchema>): Promise<ChannelResult> {
  const project = await requireProject(userId, projectId);
  const d = channelResultSchema.parse(input);
  const db = getDb();
  // Linked channel / ad test / variant must belong to this user's project.
  if (d.channelId) {
    const [c] = await db.select({ id: schema.marketingChannels.id }).from(schema.marketingChannels).where(and(eq(schema.marketingChannels.id, d.channelId), eq(schema.marketingChannels.userId, userId), eq(schema.marketingChannels.projectId, project.id)));
    if (!c) throw new NotFoundError("Channel");
  }
  if (d.adExperimentId) {
    const [e] = await db.select({ id: schema.adExperiments.id }).from(schema.adExperiments).where(and(eq(schema.adExperiments.id, d.adExperimentId), eq(schema.adExperiments.userId, userId), eq(schema.adExperiments.projectId, project.id)));
    if (!e) throw new NotFoundError("Ad test");
  }
  if (d.adVariantId) {
    const [v] = await db.select({ id: schema.adVariants.id }).from(schema.adVariants).where(and(eq(schema.adVariants.id, d.adVariantId), eq(schema.adVariants.userId, userId), eq(schema.adVariants.adExperimentId, d.adExperimentId ?? "00000000-0000-0000-0000-000000000000")));
    if (!v) throw new NotFoundError("Ad variant");
  }
  const [row] = await db
    .insert(schema.channelResults)
    .values({
      userId,
      projectId: project.id,
      channel: d.channel,
      channelType: d.channelType,
      channelId: d.channelId,
      adExperimentId: d.adExperimentId,
      adVariantId: d.adVariantId,
      periodStart: d.periodStart,
      periodEnd: d.periodEnd,
      spend: d.spend === null ? null : d.spend.toFixed(2),
      impressions: d.impressions,
      clicks: d.clicks,
      revenue: d.revenue === null ? null : d.revenue.toFixed(2),
      visits: d.visits,
      signups: d.signups,
      customers: d.customers,
      notes: d.notes || null,
    })
    .returning();
  return row;
}

export async function listChannelResults(userId: UserId, projectId: string): Promise<ChannelResult[]> {
  if (!isUuid(projectId)) return [];
  return getDb()
    .select()
    .from(schema.channelResults)
    .where(and(eq(schema.channelResults.projectId, projectId), eq(schema.channelResults.userId, userId)))
    .orderBy(desc(schema.channelResults.periodStart));
}

export async function deleteChannelResult(userId: UserId, resultId: string): Promise<void> {
  if (!isUuid(resultId)) throw new NotFoundError("Result");
  const deleted = await getDb()
    .delete(schema.channelResults)
    .where(and(eq(schema.channelResults.id, resultId), eq(schema.channelResults.userId, userId)))
    .returning({ id: schema.channelResults.id });
  if (!deleted.length) throw new NotFoundError("Result");
}

export type ChannelSummary = {
  channel: string;
  channelType: "organic" | "paid";
  spend: number;
  visits: number;
  signups: number;
  customers: number;
  costPerSignup: number | null;
  costPerCustomer: number | null;
  signupRate: number | null;
};

/** Totals per channel from recorded results. Ratios only when the inputs exist (never estimated). */
export function summarizeResults(rows: ChannelResult[]): ChannelSummary[] {
  const by = new Map<string, ChannelSummary & { hasSpend: boolean; hasVisits: boolean }>();
  for (const r of rows) {
    const key = r.channel.toLowerCase();
    const cur = by.get(key) ?? { channel: r.channel, channelType: r.channelType, spend: 0, visits: 0, signups: 0, customers: 0, costPerSignup: null, costPerCustomer: null, signupRate: null, hasSpend: false, hasVisits: false };
    if (r.spend !== null) {
      cur.spend += Number(r.spend);
      cur.hasSpend = true;
    }
    if (r.visits !== null) {
      cur.visits += r.visits;
      cur.hasVisits = true;
    }
    cur.signups += r.signups ?? 0;
    cur.customers += r.customers ?? 0;
    by.set(key, cur);
  }
  return [...by.values()].map(({ hasSpend, hasVisits, ...c }) => ({
    ...c,
    costPerSignup: hasSpend && c.signups > 0 ? c.spend / c.signups : null,
    costPerCustomer: hasSpend && c.customers > 0 ? c.spend / c.customers : null,
    signupRate: hasVisits && c.visits > 0 ? c.signups / c.visits : null,
  }));
}

/** Real waitlist signups for the project's landing pages, grouped by traffic source (utm_source). */
export async function getSignupsBySource(userId: UserId, projectId: string): Promise<{ source: string; signups: number }[]> {
  if (!isUuid(projectId)) return [];
  const db = getDb();
  const pages = await db
    .select({ id: schema.landingPages.id })
    .from(schema.landingPages)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.landingPages.projectId))
    .where(and(eq(schema.landingPages.projectId, projectId), eq(schema.projects.userId, userId)));
  if (!pages.length) return [];
  const rows = await db
    .select({ source: schema.waitlistSignups.source, n: count() })
    .from(schema.waitlistSignups)
    .where(inArray(schema.waitlistSignups.landingPageId, pages.map((p) => p.id)))
    .groupBy(schema.waitlistSignups.source);
  return rows.map((r) => ({ source: r.source ?? "direct", signups: r.n })).sort((a, b) => b.signups - a.signups);
}

/** Active projects with their marketing-plan progress. */
export async function getMarketingOverview(userId: UserId) {
  const db = getDb();
  const projects = await db
    .select({ id: schema.projects.id, name: schema.projects.name, stage: schema.projects.stage })
    .from(schema.projects)
    .where(and(eq(schema.projects.userId, userId), eq(schema.projects.status, "active")))
    .orderBy(desc(schema.projects.updatedAt));
  if (!projects.length) return [];
  const tasks = await db
    .select({ projectId: schema.marketingTasks.projectId, planId: schema.marketingTasks.planId, status: schema.marketingTasks.status })
    .from(schema.marketingTasks)
    .where(and(eq(schema.marketingTasks.userId, userId), inArray(schema.marketingTasks.projectId, projects.map((p) => p.id))));
  const plans = await db
    .select({ id: schema.marketingPlans.id, projectId: schema.marketingPlans.projectId, createdAt: schema.marketingPlans.createdAt })
    .from(schema.marketingPlans)
    .where(and(eq(schema.marketingPlans.userId, userId), inArray(schema.marketingPlans.projectId, projects.map((p) => p.id))))
    .orderBy(desc(schema.marketingPlans.createdAt));
  return projects.map((p) => {
    const plan = plans.find((x) => x.projectId === p.id);
    const t = plan ? tasks.filter((x) => x.planId === plan.id) : [];
    return { ...p, hasPlan: !!plan, total: t.length, done: t.filter((x) => x.status === "done").length };
  });
}
