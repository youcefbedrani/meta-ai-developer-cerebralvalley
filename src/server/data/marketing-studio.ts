import "server-only";
import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { mergeChannelFunnel, sumNullable, type ChannelFunnel } from "@/lib/marketing/metrics";
import { policyWarningsFor } from "@/lib/marketing/policy";
import { ASSET_TYPES, parseAssetContent, type AssetType } from "@/lib/validation/marketing-assets";
import {
  adExperimentInputSchema,
  buildUtmUrl,
  channelInputSchema,
  channelUpdateSchema,
  utmLinkSchema,
  utmSource,
  type AdExperimentInput,
} from "@/lib/validation/marketing";
import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError, UserFacingError } from "./errors";
import { requireProject } from "./projects";
import type { UserId } from "./user-id";

/*
 * Marketing Studio data layer: channels + budgets, versioned assets, ad
 * experiments, UTM links and tracked page events. Every query is scoped by
 * the verified userId (directly or through the owning project).
 */

const isUuid = (id: string) => z.uuid().safeParse(id).success;
const num = (v: string | null) => (v === null ? null : Number(v));
export const landingUrlFor = (slug: string) => `${getEnv().APP_URL.replace(/\/$/, "")}/p/${slug}`;

/* -------------------------------------------------------------- Channels */

export type MarketingChannel = typeof schema.marketingChannels.$inferSelect;

export async function listChannels(userId: UserId, projectId: string): Promise<MarketingChannel[]> {
  if (!isUuid(projectId)) return [];
  return getDb()
    .select()
    .from(schema.marketingChannels)
    .where(and(eq(schema.marketingChannels.projectId, projectId), eq(schema.marketingChannels.userId, userId)))
    .orderBy(sql`case ${schema.marketingChannels.role} when 'primary' then 0 when 'test' then 1 else 2 end`, asc(schema.marketingChannels.position), asc(schema.marketingChannels.createdAt));
}

export async function getChannel(userId: UserId, channelId: string): Promise<MarketingChannel | null> {
  if (!isUuid(channelId)) return null;
  const [row] = await getDb()
    .select()
    .from(schema.marketingChannels)
    .where(and(eq(schema.marketingChannels.id, channelId), eq(schema.marketingChannels.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createChannel(userId: UserId, projectId: string, input: z.input<typeof channelInputSchema>): Promise<MarketingChannel> {
  const project = await requireProject(userId, projectId);
  const d = channelInputSchema.parse(input);
  const [row] = await getDb()
    .insert(schema.marketingChannels)
    .values({ userId, projectId: project.id, name: d.name, type: d.type, role: d.role, monthlyBudget: d.monthlyBudget === null ? null : d.monthlyBudget.toFixed(2), currency: d.currency, utmSource: utmSource(d.name), notes: d.notes || null, position: 999 })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new UserFacingError("You already have a channel with this name.");
  return row;
}

export async function updateChannel(userId: UserId, channelId: string, input: z.input<typeof channelUpdateSchema>): Promise<void> {
  if (!isUuid(channelId)) throw new NotFoundError("Channel");
  const d = channelUpdateSchema.parse(input);
  const set: Partial<typeof schema.marketingChannels.$inferInsert> = {};
  if (d.role) set.role = d.role;
  if (d.status) set.status = d.status;
  if (d.monthlyBudget !== undefined) set.monthlyBudget = d.monthlyBudget === null ? null : d.monthlyBudget.toFixed(2);
  if (d.notes !== undefined) set.notes = d.notes || null;
  const updated = await getDb()
    .update(schema.marketingChannels)
    .set(set)
    .where(and(eq(schema.marketingChannels.id, channelId), eq(schema.marketingChannels.userId, userId)))
    .returning({ id: schema.marketingChannels.id });
  if (!updated.length) throw new NotFoundError("Channel");
}

export async function deleteChannel(userId: UserId, channelId: string): Promise<void> {
  if (!isUuid(channelId)) throw new NotFoundError("Channel");
  const deleted = await getDb()
    .delete(schema.marketingChannels)
    .where(and(eq(schema.marketingChannels.id, channelId), eq(schema.marketingChannels.userId, userId)))
    .returning({ id: schema.marketingChannels.id });
  if (!deleted.length) throw new NotFoundError("Channel");
}

/** Spend recorded this calendar month per channel (by channel id, or by name for older results). */
export async function getMonthSpend(userId: UserId, projectId: string, now = new Date()): Promise<Map<string, number>> {
  if (!isUuid(projectId)) return new Map();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await getDb()
    .select({ channelId: schema.channelResults.channelId, channel: schema.channelResults.channel, spend: schema.channelResults.spend })
    .from(schema.channelResults)
    .where(and(eq(schema.channelResults.projectId, projectId), eq(schema.channelResults.userId, userId), gte(schema.channelResults.periodEnd, monthStart)));
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.spend === null) continue;
    const key = r.channelId ?? `name:${r.channel.toLowerCase()}`;
    out.set(key, (out.get(key) ?? 0) + Number(r.spend));
  }
  return out;
}

/* ---------------------------------------------------------------- Assets */

export type MarketingAsset = typeof schema.marketingAssets.$inferSelect & { quoteIds: string[] };

async function withQuotes(rows: (typeof schema.marketingAssets.$inferSelect)[]): Promise<MarketingAsset[]> {
  if (!rows.length) return [];
  const links = await getDb()
    .select()
    .from(schema.assetSourceQuotes)
    .where(inArray(schema.assetSourceQuotes.assetId, rows.map((r) => r.id)));
  return rows.map((r) => ({ ...r, quoteIds: links.filter((l) => l.assetId === r.id).map((l) => l.quoteId) }));
}

/** Latest version of every asset in the project, newest first. */
export async function listAssets(userId: UserId, projectId: string): Promise<MarketingAsset[]> {
  if (!isUuid(projectId)) return [];
  const a = schema.marketingAssets;
  const rows = await getDb()
    .selectDistinctOn([a.groupId])
    .from(a)
    .where(and(eq(a.projectId, projectId), eq(a.userId, userId)))
    .orderBy(a.groupId, desc(a.version));
  rows.sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
  return withQuotes(rows);
}

export async function getAssetVersions(userId: UserId, groupId: string): Promise<MarketingAsset[]> {
  if (!isUuid(groupId)) return [];
  const rows = await getDb()
    .select()
    .from(schema.marketingAssets)
    .where(and(eq(schema.marketingAssets.groupId, groupId), eq(schema.marketingAssets.userId, userId)))
    .orderBy(desc(schema.marketingAssets.version));
  return withQuotes(rows);
}

/** Inserts a new asset (version 1) with its source quotes. Quote ids must belong to the project. */
export async function insertAsset(
  userId: UserId,
  values: { projectId: string; channelId: string | null; channelName: string; type: AssetType; title: string; content: unknown; quoteIds: string[]; source: "ai" | "user"; promptVersion?: string },
): Promise<MarketingAsset> {
  const content = ASSET_TYPES[values.type].schema.parse(values.content);
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.marketingAssets)
      .values({ userId, projectId: values.projectId, channelId: values.channelId, channelName: values.channelName, type: values.type, groupId: randomUUID(), version: 1, title: values.title, content, policyWarnings: policyWarningsFor(content), source: values.source, promptVersion: values.promptVersion ?? null })
      .returning();
    const quoteIds = await ownQuoteIds(tx, userId, values.projectId, values.quoteIds);
    if (quoteIds.length) await tx.insert(schema.assetSourceQuotes).values(quoteIds.map((quoteId) => ({ assetId: row.id, quoteId })));
    return { ...row, quoteIds };
  });
}

async function ownQuoteIds(tx: Pick<ReturnType<typeof getDb>, "select">, userId: UserId, projectId: string, ids: string[]): Promise<string[]> {
  const valid = [...new Set(ids.filter(isUuid))];
  if (!valid.length) return [];
  const rows = await tx
    .select({ id: schema.customerLanguageQuotes.id })
    .from(schema.customerLanguageQuotes)
    .where(and(inArray(schema.customerLanguageQuotes.id, valid), eq(schema.customerLanguageQuotes.userId, userId), eq(schema.customerLanguageQuotes.projectId, projectId)));
  return rows.map((r) => r.id);
}

/** Saves an edit as a new version; earlier versions stay in the history. Source quotes carry over. */
export async function saveAssetVersion(userId: UserId, assetId: string, input: { title?: string; content: unknown }): Promise<MarketingAsset> {
  if (!isUuid(assetId)) throw new NotFoundError("Asset");
  const db = getDb();
  const [base] = await db.select().from(schema.marketingAssets).where(and(eq(schema.marketingAssets.id, assetId), eq(schema.marketingAssets.userId, userId))).limit(1);
  if (!base) throw new NotFoundError("Asset");
  const content = ASSET_TYPES[base.type].schema.parse(input.content);
  const title = (input.title ?? base.title).trim().slice(0, 140) || base.title;
  return db.transaction(async (tx) => {
    const [{ max }] = await tx.select({ max: sql<number>`max(${schema.marketingAssets.version})` }).from(schema.marketingAssets).where(eq(schema.marketingAssets.groupId, base.groupId));
    const [row] = await tx
      .insert(schema.marketingAssets)
      .values({ userId, projectId: base.projectId, channelId: base.channelId, channelName: base.channelName, type: base.type, groupId: base.groupId, version: Number(max) + 1, title, content, policyWarnings: policyWarningsFor(content), source: "user", promptVersion: base.promptVersion })
      .returning();
    const quotes = await tx.select({ quoteId: schema.assetSourceQuotes.quoteId }).from(schema.assetSourceQuotes).where(eq(schema.assetSourceQuotes.assetId, base.id));
    if (quotes.length) await tx.insert(schema.assetSourceQuotes).values(quotes.map((q) => ({ assetId: row.id, quoteId: q.quoteId })));
    return { ...row, quoteIds: quotes.map((q) => q.quoteId) };
  });
}

export async function deleteAssetGroup(userId: UserId, groupId: string): Promise<void> {
  if (!isUuid(groupId)) throw new NotFoundError("Asset");
  const deleted = await getDb()
    .delete(schema.marketingAssets)
    .where(and(eq(schema.marketingAssets.groupId, groupId), eq(schema.marketingAssets.userId, userId)))
    .returning({ id: schema.marketingAssets.id });
  if (!deleted.length) throw new NotFoundError("Asset");
}

export function assetContent(asset: Pick<MarketingAsset, "type" | "content">) {
  return parseAssetContent(asset.type, asset.content);
}

/* ------------------------------------------------------------- UTM links */

export type UtmLink = typeof schema.utmLinks.$inferSelect;

async function requireOwnLandingPage(userId: UserId, projectId: string, landingPageId: string) {
  const [page] = await getDb()
    .select({ id: schema.landingPages.id, slug: schema.landingPages.slug })
    .from(schema.landingPages)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.landingPages.projectId))
    .where(and(eq(schema.landingPages.id, landingPageId), eq(schema.landingPages.projectId, projectId), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!page) throw new NotFoundError("Landing page");
  return page;
}

export async function createUtmLink(userId: UserId, projectId: string, input: z.input<typeof utmLinkSchema> & { channelId?: string | null; adVariantId?: string | null }): Promise<UtmLink> {
  const project = await requireProject(userId, projectId);
  const d = utmLinkSchema.parse(input);
  const page = await requireOwnLandingPage(userId, project.id, d.landingPageId);
  const url = buildUtmUrl(landingUrlFor(page.slug), d);
  const db = getDb();
  const [row] = await db
    .insert(schema.utmLinks)
    .values({ userId, projectId: project.id, channelId: input.channelId ?? null, adVariantId: input.adVariantId ?? null, source: d.source, medium: d.medium, campaign: d.campaign, content: d.content, landingPageId: page.id, url })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  const [existing] = await db
    .select()
    .from(schema.utmLinks)
    .where(and(eq(schema.utmLinks.landingPageId, page.id), eq(schema.utmLinks.source, d.source), eq(schema.utmLinks.medium, d.medium), eq(schema.utmLinks.campaign, d.campaign), eq(schema.utmLinks.content, d.content)))
    .limit(1);
  return existing;
}

export async function listUtmLinks(userId: UserId, projectId: string): Promise<UtmLink[]> {
  if (!isUuid(projectId)) return [];
  return getDb()
    .select()
    .from(schema.utmLinks)
    .where(and(eq(schema.utmLinks.projectId, projectId), eq(schema.utmLinks.userId, userId)))
    .orderBy(desc(schema.utmLinks.createdAt));
}

/* ----------------------------------------------------------- Page events */

export type TrackedRow = { source: string; campaign: string | null; content: string | null; visits: number; signups: number };

/** Visits and signups we tracked on the project's hosted pages, by UTM source/campaign/content. */
export async function getTrackedEvents(userId: UserId, projectId: string): Promise<TrackedRow[]> {
  if (!isUuid(projectId)) return [];
  const e = schema.pageEvents;
  const rows = await getDb()
    .select({
      source: sql<string>`coalesce(${e.utmSource}, 'direct')`,
      campaign: e.utmCampaign,
      content: e.utmContent,
      visits: sql<number>`count(*) filter (where ${e.type} = 'visit')`.mapWith(Number),
      signups: sql<number>`count(*) filter (where ${e.type} = 'signup')`.mapWith(Number),
    })
    .from(e)
    .innerJoin(schema.landingPages, eq(schema.landingPages.id, e.landingPageId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.landingPages.projectId))
    .where(and(eq(schema.landingPages.projectId, projectId), eq(schema.projects.userId, userId)))
    .groupBy(sql`coalesce(${e.utmSource}, 'direct')`, e.utmCampaign, e.utmContent);
  return rows;
}

export function trackedBySource(rows: TrackedRow[]): Map<string, { visits: number; signups: number }> {
  const out = new Map<string, { visits: number; signups: number }>();
  for (const r of rows) {
    const cur = out.get(r.source) ?? { visits: 0, signups: 0 };
    out.set(r.source, { visits: cur.visits + r.visits, signups: cur.signups + r.signups });
  }
  return out;
}

/* ----------------------------------------------------- Funnel per channel */

type ResultRow = typeof schema.channelResults.$inferSelect;

/**
 * Per-channel funnel: self-reported numbers from logged results, merged with
 * visits/signups tracked on our landing pages (matched by UTM source).
 */
export function buildChannelFunnels(channels: Pick<MarketingChannel, "id" | "name" | "utmSource">[], results: ResultRow[], tracked: TrackedRow[]): ChannelFunnel[] {
  const bySource = trackedBySource(tracked);
  const names = new Map<string, { name: string; source: string; rows: ResultRow[] }>();
  for (const c of channels) names.set(c.utmSource, { name: c.name, source: c.utmSource, rows: [] });
  for (const r of results) {
    const channel = r.channelId ? channels.find((c) => c.id === r.channelId) : undefined;
    const source = channel?.utmSource ?? utmSource(r.channel);
    const entry = names.get(source) ?? { name: r.channel, source, rows: [] };
    entry.rows.push(r);
    names.set(source, entry);
  }
  for (const source of bySource.keys()) if (!names.has(source)) names.set(source, { name: source, source, rows: [] });
  return [...names.values()]
    .map(({ name, source, rows }) =>
      mergeChannelFunnel(
        name,
        {
          spend: sumNullable(rows.map((r) => num(r.spend))),
          impressions: sumNullable(rows.map((r) => r.impressions)),
          clicks: sumNullable(rows.map((r) => r.clicks)),
          visits: sumNullable(rows.map((r) => r.visits)),
          signups: sumNullable(rows.map((r) => r.signups)),
          customers: sumNullable(rows.map((r) => r.customers)),
          revenue: sumNullable(rows.map((r) => num(r.revenue))),
        },
        bySource.get(source),
      ),
    )
    .filter((f) => [f.spend, f.impressions, f.clicks, f.visits, f.signups, f.customers, f.revenue].some((v) => v !== null && v !== 0) || channels.some((c) => c.name === f.channel));
}

/* -------------------------------------------------------- Ad experiments */

export type AdExperiment = typeof schema.adExperiments.$inferSelect;
export type AdVariant = typeof schema.adVariants.$inferSelect;

async function requireAdExperiment(userId: UserId, id: string): Promise<AdExperiment> {
  if (!isUuid(id)) throw new NotFoundError("Ad test");
  const [row] = await getDb().select().from(schema.adExperiments).where(and(eq(schema.adExperiments.id, id), eq(schema.adExperiments.userId, userId))).limit(1);
  if (!row) throw new NotFoundError("Ad test");
  return row;
}

/** Creates a test with its variants. With a published landing page, each variant gets its own UTM link. */
export async function createAdExperiment(userId: UserId, projectId: string, input: AdExperimentInput): Promise<AdExperiment> {
  const project = await requireProject(userId, projectId);
  const d = adExperimentInputSchema.parse(input);
  if (d.channelId && !(await getChannel(userId, d.channelId))) throw new NotFoundError("Channel");
  const db = getDb();
  const [page] = await db
    .select({ id: schema.landingPages.id, slug: schema.landingPages.slug })
    .from(schema.landingPages)
    .where(and(eq(schema.landingPages.projectId, project.id), eq(schema.landingPages.published, true)))
    .orderBy(desc(schema.landingPages.updatedAt))
    .limit(1);

  return db.transaction(async (tx) => {
    const [exp] = await tx
      .insert(schema.adExperiments)
      .values({
        userId,
        projectId: project.id,
        channelId: d.channelId,
        platform: d.platform,
        name: d.name,
        hypothesis: d.hypothesis,
        audience: d.audience,
        budgetTotal: d.budgetTotal.toFixed(2),
        currency: d.currency,
        durationDays: d.durationDays,
        maxCostPerSignup: d.maxCostPerSignup.toFixed(2),
        minClicks: d.minClicks,
      })
      .returning();
    const used = new Set<string>();
    for (const [i, v] of d.variants.entries()) {
      let content = utmSource(v.name) || `variant-${i + 1}`;
      if (used.has(content)) content = `${content}-${i + 1}`;
      used.add(content);
      const [variant] = await tx
        .insert(schema.adVariants)
        .values({ userId, adExperimentId: exp.id, name: v.name, angle: v.angle, headline: v.headline, primaryText: v.primaryText, cta: v.cta, audienceIdea: v.audienceIdea, assetId: v.assetId, utmContent: content, position: i })
        .returning();
      if (page) {
        const link = { source: utmSource(d.platform), medium: "paid", campaign: utmSource(d.name), content };
        await tx
          .insert(schema.utmLinks)
          .values({ userId, projectId: project.id, landingPageId: page.id, channelId: d.channelId, adVariantId: variant.id, ...link, url: buildUtmUrl(landingUrlFor(page.slug), link) })
          .onConflictDoNothing();
      }
    }
    return exp;
  });
}

export async function listAdExperiments(userId: UserId, projectId: string) {
  if (!isUuid(projectId)) return [];
  const exps = await getDb()
    .select()
    .from(schema.adExperiments)
    .where(and(eq(schema.adExperiments.projectId, projectId), eq(schema.adExperiments.userId, userId)))
    .orderBy(desc(schema.adExperiments.createdAt));
  if (!exps.length) return [];
  const counts = await getDb()
    .select({ id: schema.adVariants.adExperimentId, n: count() })
    .from(schema.adVariants)
    .where(inArray(schema.adVariants.adExperimentId, exps.map((e) => e.id)))
    .groupBy(schema.adVariants.adExperimentId);
  return exps.map((e) => ({ ...e, variantCount: counts.find((c) => c.id === e.id)?.n ?? 0 }));
}

export async function getAdExperiment(userId: UserId, id: string) {
  if (!isUuid(id)) return null;
  const db = getDb();
  const [exp] = await db.select().from(schema.adExperiments).where(and(eq(schema.adExperiments.id, id), eq(schema.adExperiments.userId, userId))).limit(1);
  if (!exp) return null;
  const [variants, links, results] = await Promise.all([
    db.select().from(schema.adVariants).where(eq(schema.adVariants.adExperimentId, exp.id)).orderBy(asc(schema.adVariants.position)),
    db.select().from(schema.utmLinks).innerJoin(schema.adVariants, eq(schema.adVariants.id, schema.utmLinks.adVariantId)).where(eq(schema.adVariants.adExperimentId, exp.id)),
    db.select().from(schema.channelResults).where(and(eq(schema.channelResults.adExperimentId, exp.id), eq(schema.channelResults.userId, userId))).orderBy(desc(schema.channelResults.periodStart)),
  ]);
  return { experiment: exp, variants, links: links.map((l) => l.utm_links), results };
}

export async function setAdExperimentStatus(userId: UserId, id: string, status: "running" | "completed" | "stopped" | "draft", decisionNote?: string): Promise<void> {
  const exp = await requireAdExperiment(userId, id);
  const now = new Date();
  await getDb()
    .update(schema.adExperiments)
    .set({
      status,
      startedAt: status === "running" ? (exp.startedAt ?? now) : exp.startedAt,
      endedAt: status === "completed" || status === "stopped" ? now : null,
      decisionNote: decisionNote?.trim().slice(0, 1000) || exp.decisionNote,
    })
    .where(eq(schema.adExperiments.id, exp.id));
}

export async function deleteAdExperiment(userId: UserId, id: string): Promise<void> {
  const exp = await requireAdExperiment(userId, id);
  await getDb().delete(schema.adExperiments).where(eq(schema.adExperiments.id, exp.id));
}

/** Tracks the ad test in the Validation Lab too, with the same hypothesis and success rule. */
export async function linkAdExperimentToLab(userId: UserId, id: string): Promise<{ experimentId: string }> {
  const exp = await requireAdExperiment(userId, id);
  if (exp.labExperimentId) return { experimentId: exp.labExperimentId };
  return getDb().transaction(async (tx) => {
    const [lab] = await tx
      .insert(schema.experiments)
      .values({
        projectId: exp.projectId,
        type: "landing_page",
        title: `Ad test: ${exp.name}`.slice(0, 160),
        hypothesis: exp.hypothesis,
        audience: `${exp.platform}: ${exp.audience}`.slice(0, 500),
        procedure: `Run ${exp.platform} ads for ${exp.durationDays} days with a total budget of ${exp.currency} ${exp.budgetTotal}. Each variant uses its own tracking link.`,
        successCriteria: `Cost per signup at or below ${exp.currency} ${exp.maxCostPerSignup} after at least ${exp.minClicks} clicks per variant.`,
      })
      .returning({ id: schema.experiments.id });
    await tx.update(schema.adExperiments).set({ labExperimentId: lab.id }).where(eq(schema.adExperiments.id, exp.id));
    return { experimentId: lab.id };
  });
}

/* ------------------------------------------------------- Recommendations */

export async function saveRecommendation(userId: UserId, projectId: string, content: unknown, basedOn: unknown, promptVersion: string) {
  const [row] = await getDb()
    .insert(schema.marketingRecommendations)
    .values({ userId, projectId, content: content as Record<string, unknown>, basedOn: basedOn as Record<string, unknown>, promptVersion })
    .returning();
  return row;
}

export async function getLatestRecommendation(userId: UserId, projectId: string) {
  if (!isUuid(projectId)) return null;
  const [row] = await getDb()
    .select()
    .from(schema.marketingRecommendations)
    .where(and(eq(schema.marketingRecommendations.projectId, projectId), eq(schema.marketingRecommendations.userId, userId)))
    .orderBy(desc(schema.marketingRecommendations.createdAt))
    .limit(1);
  return row ?? null;
}
