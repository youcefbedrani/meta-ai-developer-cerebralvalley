import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { InPlatformAsset } from "@/lib/validation/marketplace";
import { getDb, schema } from "@/server/db/client";

/*
 * In-platform delivery of a sold project package. Runs inside the caller's
 * transaction so the state change and the transfer commit (or fail) together.
 *
 * - EXCLUSIVE_TRANSFER moves the project and every child record to the buyer.
 * - NON_EXCLUSIVE clones only the included assets into the buyer's account.
 *
 * Waitlist rule: subscriber emails move only with explicit transfer consent.
 * Other signups are redacted (email removed) so only the count carries over.
 */

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

const redactedEmail = () => `redacted-${randomUUID()}@redacted.invalid`;

/** Replaces non-consented waitlist emails on a project's pages. */
async function redactNonConsented(tx: Tx, landingPageIds: string[]) {
  if (!landingPageIds.length) return 0;
  const rows = await tx
    .select({ id: schema.waitlistSignups.id })
    .from(schema.waitlistSignups)
    .where(and(inArray(schema.waitlistSignups.landingPageId, landingPageIds), eq(schema.waitlistSignups.consentTransfer, false), eq(schema.waitlistSignups.redacted, false)));
  for (const r of rows) await tx.update(schema.waitlistSignups).set({ email: redactedEmail(), redacted: true, source: null }).where(eq(schema.waitlistSignups.id, r.id));
  return rows.length;
}

/** Moves a project (and all rows that carry a user id) from seller to buyer. */
export async function moveProjectOwnership(tx: Tx, projectId: string, sellerId: string, buyerId: string): Promise<{ redacted: number }> {
  const s = schema;
  const [project] = await tx.update(s.projects).set({ userId: buyerId }).where(and(eq(s.projects.id, projectId), eq(s.projects.userId, sellerId))).returning({ id: s.projects.id });
  if (!project) throw new Error("Project is no longer owned by the seller");

  // Tables with their own user id column, scoped by project.
  const byProject = [s.ideas, s.researchJobs, s.customerLanguageQuotes, s.marketingPlans, s.marketingTasks, s.marketingChannels, s.marketingAssets, s.adExperiments, s.utmLinks, s.channelResults, s.marketingRecommendations] as const;
  for (const t of byProject) await tx.update(t).set({ userId: buyerId }).where(eq(t.projectId, projectId));
  const exps = await tx.select({ id: s.adExperiments.id }).from(s.adExperiments).where(eq(s.adExperiments.projectId, projectId));
  if (exps.length) await tx.update(s.adVariants).set({ userId: buyerId }).where(inArray(s.adVariants.adExperimentId, exps.map((e) => e.id)));
  // Ideas no longer point at the seller's Gold Mine evidence (that research stays with the seller).
  await tx.update(s.ideas).set({ goldMineSessionId: null }).where(eq(s.ideas.projectId, projectId));
  const ideaIds = (await tx.select({ id: s.ideas.id }).from(s.ideas).where(eq(s.ideas.projectId, projectId))).map((i) => i.id);
  if (ideaIds.length) await tx.delete(s.ideaPainLinks).where(inArray(s.ideaPainLinks.ideaId, ideaIds));

  const pages = await tx.select({ id: s.landingPages.id }).from(s.landingPages).where(eq(s.landingPages.projectId, projectId));
  const redacted = await redactNonConsented(tx, pages.map((p) => p.id));
  return { redacted };
}

function strip<T extends Record<string, unknown>>(row: T): Omit<T, "id" | "createdAt" | "updatedAt"> {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = row as T & { id?: unknown; createdAt?: unknown; updatedAt?: unknown };
  void _id;
  void _c;
  void _u;
  return rest;
}

/** Copies the included assets into a new project in the buyer's account. */
export async function cloneProjectPackage(tx: Tx, projectId: string, buyerId: string, assets: InPlatformAsset[]): Promise<{ projectId: string; redacted: number }> {
  const s = schema;
  const has = (a: InPlatformAsset) => assets.includes(a);
  const [src] = await tx.select().from(s.projects).where(eq(s.projects.id, projectId));
  if (!src) throw new Error("Project not found");
  const [copy] = await tx
    .insert(s.projects)
    .values({ userId: buyerId, name: `${src.name} (licensed copy)`.slice(0, 80), description: src.description, stage: src.stage, nextAction: src.nextAction })
    .returning({ id: s.projects.id });
  const pid = copy.id;
  const sourceMap = new Map<string, string>();

  if (has("research_reports") || has("mvp_plan")) {
    const types = [...(has("research_reports") ? (["validation", "competitors"] as const) : []), ...(has("mvp_plan") ? (["business_model"] as const) : [])];
    const reports = await tx.select().from(s.reports).where(and(eq(s.reports.projectId, projectId), inArray(s.reports.type, types)));
    for (const r of reports) {
      const [nr] = await tx.insert(s.reports).values({ ...strip(r), projectId: pid, researchJobId: null }).returning({ id: s.reports.id });
      const srcs = await tx.select().from(s.sources).where(eq(s.sources.reportId, r.id));
      for (const so of srcs) {
        const [ns] = await tx.insert(s.sources).values({ ...strip(so), reportId: nr.id, researchJobId: null }).returning({ id: s.sources.id });
        sourceMap.set(so.id, ns.id);
      }
      const ev = await tx.select().from(s.evidence).where(eq(s.evidence.reportId, r.id));
      if (ev.length) await tx.insert(s.evidence).values(ev.map((e) => ({ ...strip(e), reportId: nr.id, sourceId: e.sourceId ? (sourceMap.get(e.sourceId) ?? null) : null })));
    }
  }
  if (has("competitors")) {
    const rows = await tx.select().from(s.competitors).where(eq(s.competitors.projectId, projectId));
    if (rows.length) await tx.insert(s.competitors).values(rows.map((c) => ({ ...strip(c), projectId: pid, pricingSourceId: c.pricingSourceId ? (sourceMap.get(c.pricingSourceId) ?? null) : null })));
  }
  if (has("pain_quotes")) {
    const rows = await tx.select().from(s.customerLanguageQuotes).where(eq(s.customerLanguageQuotes.projectId, projectId));
    if (rows.length) await tx.insert(s.customerLanguageQuotes).values(rows.map((q) => ({ ...strip(q), userId: buyerId, projectId: pid, sourceQuoteId: null })));
  }
  if (has("experiments")) {
    const rows = await tx.select().from(s.experiments).where(eq(s.experiments.projectId, projectId));
    for (const e of rows) {
      const [ne] = await tx.insert(s.experiments).values({ ...strip(e), projectId: pid }).returning({ id: s.experiments.id });
      const results = await tx.select().from(s.experimentResults).where(eq(s.experimentResults.experimentId, e.id));
      if (results.length) await tx.insert(s.experimentResults).values(results.map((r) => ({ ...strip(r), experimentId: ne.id })));
    }
  }
  if (has("mvp_plan")) {
    const rows = await tx.select().from(s.mvpPlans).where(eq(s.mvpPlans.projectId, projectId)).orderBy(desc(s.mvpPlans.createdAt)).limit(1);
    if (rows.length) await tx.insert(s.mvpPlans).values(rows.map((m) => ({ ...strip(m), projectId: pid })));
  }
  if (has("marketing")) {
    const [plan] = await tx.select().from(s.marketingPlans).where(eq(s.marketingPlans.projectId, projectId)).orderBy(desc(s.marketingPlans.createdAt)).limit(1);
    if (plan) {
      const [np] = await tx.insert(s.marketingPlans).values({ ...strip(plan), userId: buyerId, projectId: pid }).returning({ id: s.marketingPlans.id });
      const tasks = await tx.select().from(s.marketingTasks).where(eq(s.marketingTasks.planId, plan.id));
      if (tasks.length) await tx.insert(s.marketingTasks).values(tasks.map((t) => ({ ...strip(t), userId: buyerId, projectId: pid, planId: np.id, status: "todo" as const, completedAt: null })));
    }
    const channels = await tx.select().from(s.marketingChannels).where(eq(s.marketingChannels.projectId, projectId));
    const channelMap = new Map<string, string>();
    for (const c of channels) {
      const [nc] = await tx.insert(s.marketingChannels).values({ ...strip(c), userId: buyerId, projectId: pid, planId: null, status: "planned" }).returning({ id: s.marketingChannels.id });
      channelMap.set(c.id, nc.id);
    }
    const assetsRows = await tx.select().from(s.marketingAssets).where(eq(s.marketingAssets.projectId, projectId));
    const groups = new Map<string, string>();
    for (const a of assetsRows) {
      if (!groups.has(a.groupId)) groups.set(a.groupId, randomUUID());
      await tx.insert(s.marketingAssets).values({ ...strip(a), userId: buyerId, projectId: pid, channelId: a.channelId ? (channelMap.get(a.channelId) ?? null) : null, groupId: groups.get(a.groupId)! });
    }
  }
  let redacted = 0;
  if (has("landing_page")) {
    const pages = await tx.select().from(s.landingPages).where(eq(s.landingPages.projectId, projectId));
    for (const p of pages) {
      const [np] = await tx
        .insert(s.landingPages)
        .values({ ...strip(p), projectId: pid, experimentId: null, published: false, slug: `${p.slug}-copy-${randomUUID().slice(0, 6)}`.slice(0, 60) })
        .returning({ id: s.landingPages.id });
      // Traffic history comes along; the seller keeps the live page.
      const events = await tx.select().from(s.pageEvents).where(eq(s.pageEvents.landingPageId, p.id));
      if (events.length) await tx.insert(s.pageEvents).values(events.map((e) => ({ ...strip(e), landingPageId: np.id, createdAt: e.createdAt })));
      if (has("waitlist")) {
        const signups = await tx.select().from(s.waitlistSignups).where(eq(s.waitlistSignups.landingPageId, p.id));
        for (const w of signups) {
          const consented = w.consentTransfer && !w.redacted;
          if (!consented) redacted++;
          await tx.insert(s.waitlistSignups).values({ ...strip(w), landingPageId: np.id, email: consented ? w.email : redactedEmail(), redacted: !consented, source: consented ? w.source : null, createdAt: w.createdAt });
        }
      }
    }
  }
  return { projectId: pid, redacted };
}

/**
 * Idea listings. Exclusive: the idea itself moves to the buyer (detached from the seller's project
 * and Gold Mine evidence, which stay with the seller). Non-exclusive: the buyer gets a saved copy.
 */
export async function moveIdeaOwnership(tx: Tx, ideaId: string, sellerId: string, buyerId: string): Promise<string> {
  const s = schema;
  await tx.delete(s.ideaPainLinks).where(eq(s.ideaPainLinks.ideaId, ideaId));
  const [idea] = await tx
    .update(s.ideas)
    .set({ userId: buyerId, projectId: null, goldMineSessionId: null, status: "saved" })
    .where(and(eq(s.ideas.id, ideaId), eq(s.ideas.userId, sellerId)))
    .returning({ id: s.ideas.id });
  if (!idea) throw new Error("Idea is no longer owned by the seller");
  return idea.id;
}

export async function cloneIdea(tx: Tx, ideaId: string, buyerId: string): Promise<string> {
  const s = schema;
  const [src] = await tx.select().from(s.ideas).where(eq(s.ideas.id, ideaId));
  if (!src) throw new Error("Idea not found");
  const [copy] = await tx
    .insert(s.ideas)
    .values({ userId: buyerId, title: `${src.title} (licensed copy)`.slice(0, 120), content: src.content, inputs: src.inputs, status: "saved", promptVersion: src.promptVersion })
    .returning({ id: s.ideas.id });
  return copy.id;
}
