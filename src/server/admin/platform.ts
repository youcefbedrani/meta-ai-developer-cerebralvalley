import "server-only";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { refundCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError, UserFacingError } from "@/server/data/errors";
import { unsafeToUserId } from "@/server/data/user-id";
import { enqueueResearch } from "@/server/jobs/queue";
import { researchCreditRef } from "@/server/jobs/research/pipeline";
import { logAdmin, type AdminActor } from "./audit";

/* Projects ------------------------------------------------------------------ */

export async function listAllProjects({ q, status }: { q?: string; status?: string }) {
  const p = schema.projects;
  const where: SQL[] = [];
  if (q) where.push(or(ilike(p.name, `%${q}%`), ilike(schema.users.email, `%${q}%`))!);
  if (status === "active" || status === "archived") where.push(eq(p.status, status));
  return getDb()
    .select({
      id: p.id,
      name: p.name,
      stage: p.stage,
      status: p.status,
      decision: p.decision,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      ownerId: p.userId,
      ownerEmail: schema.users.email,
      signups: sql<number>`(select count(*)::int from waitlist_signups w join landing_pages l on l.id = w.landing_page_id where l.project_id = ${p.id})`,
      listed: sql<boolean>`exists (select 1 from listings li where li.project_id = ${p.id} and li.status = 'published')`,
    })
    .from(p)
    .innerJoin(schema.users, eq(schema.users.id, p.userId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(p.updatedAt))
    .limit(200);
}

export async function adminSetProjectStatus(actor: AdminActor, projectId: string, status: unknown) {
  const next = z.enum(["active", "archived"]).parse(status);
  const [row] = await getDb().update(schema.projects).set({ status: next }).where(eq(schema.projects.id, z.uuid().parse(projectId))).returning({ id: schema.projects.id, name: schema.projects.name });
  if (!row) throw new NotFoundError("Project");
  await logAdmin(actor, next === "archived" ? "project.archived" : "project.restored", "project", projectId, { name: row.name });
}

/* Research jobs & AI usage ---------------------------------------------------- */

const JOB_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;

export async function listJobs(status?: string) {
  const j = schema.researchJobs;
  const filter = (JOB_STATUSES as readonly string[]).includes(status ?? "") ? eq(j.status, status as (typeof JOB_STATUSES)[number]) : undefined;
  return getDb()
    .select({ job: j, email: schema.users.email, project: schema.projects.name })
    .from(j)
    .innerJoin(schema.users, eq(schema.users.id, j.userId))
    .innerJoin(schema.projects, eq(schema.projects.id, j.projectId))
    .where(filter)
    .orderBy(desc(j.createdAt))
    .limit(100);
}

/** Cancels a queued or running job and refunds its credits (refunds are idempotent). */
export async function adminCancelJob(actor: AdminActor, jobId: string) {
  const [job] = await getDb()
    .update(schema.researchJobs)
    .set({ status: "cancelled", error: "Cancelled by the Startum team. Your credits were refunded.", finishedAt: new Date() })
    .where(and(eq(schema.researchJobs.id, z.uuid().parse(jobId)), inArray(schema.researchJobs.status, ["queued", "running"])))
    .returning();
  if (!job) throw new UserFacingError("Only queued or running jobs can be cancelled.");
  const refunded = await refundCredits(unsafeToUserId(job.userId), researchCreditRef(job.id), "research job cancelled by admin");
  await logAdmin(actor, "job.cancelled", "research_job", job.id, { refunded });
}

/** Re-runs a failed or cancelled job at no charge (its credits were already refunded). */
export async function adminRetryJob(actor: AdminActor, jobId: string) {
  const [job] = await getDb()
    .update(schema.researchJobs)
    .set({ status: "queued", error: null, currentStage: null, startedAt: null, finishedAt: null })
    .where(and(eq(schema.researchJobs.id, z.uuid().parse(jobId)), inArray(schema.researchJobs.status, ["failed", "cancelled"])))
    .returning({ id: schema.researchJobs.id });
  if (!job) throw new UserFacingError("Only failed or cancelled jobs can be retried.");
  await enqueueResearch(job.id);
  await logAdmin(actor, "job.retried", "research_job", job.id, { charged: false });
}

export async function aiUsageByOperation(days = 30) {
  const a = schema.aiUsageLogs;
  return getDb()
    .select({
      operation: a.operation,
      calls: sql<number>`count(*)::int`,
      errors: sql<number>`count(*) filter (where ${a.status} <> 'success')::int`,
      tokensIn: sql<number>`coalesce(sum(${a.tokensIn}), 0)::int`,
      tokensOut: sql<number>`coalesce(sum(${a.tokensOut}), 0)::int`,
      cost: sql<number>`coalesce(sum(${a.estimatedCostUsd}), 0)::float`,
      avgMs: sql<number>`coalesce(avg(${a.durationMs}), 0)::int`,
    })
    .from(a)
    .where(sql`${a.createdAt} >= now() - make_interval(days => ${days})`)
    .groupBy(a.operation)
    .orderBy(sql`count(*) desc`);
}

/** Who uses the most AI this month (UTC), with their plan, so admins can spot one client using too much. */
export async function topAiUsers(limit = 15) {
  const a = schema.aiUsageLogs;
  return getDb()
    .select({
      userId: a.userId,
      email: schema.users.email,
      plan: schema.users.plan,
      calls: sql<number>`count(*)::int`,
      tokens: sql<number>`coalesce(sum(${a.tokensIn} + ${a.tokensOut}), 0)::int`,
      cost: sql<number>`coalesce(sum(${a.estimatedCostUsd}), 0)::float`,
    })
    .from(a)
    .innerJoin(schema.users, eq(schema.users.id, a.userId))
    .where(sql`${a.createdAt} >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'`)
    .groupBy(a.userId, schema.users.email, schema.users.plan)
    .orderBy(sql`sum(${a.tokensIn} + ${a.tokensOut}) desc`)
    .limit(limit);
}

export async function recentAiErrors(limit = 20) {
  const a = schema.aiUsageLogs;
  return getDb()
    .select({ id: a.id, operation: a.operation, provider: a.provider, model: a.model, status: a.status, errorCode: a.errorCode, createdAt: a.createdAt, email: schema.users.email })
    .from(a)
    .leftJoin(schema.users, eq(schema.users.id, a.userId))
    .where(sql`${a.status} <> 'success'`)
    .orderBy(desc(a.createdAt))
    .limit(limit);
}

/* Billing ---------------------------------------------------------------------- */

export async function listSubscriptions() {
  return getDb()
    .select({ sub: schema.subscriptions, email: schema.users.email, userId: schema.users.id })
    .from(schema.subscriptions)
    .innerJoin(schema.users, eq(schema.users.id, schema.subscriptions.userId))
    .orderBy(desc(schema.subscriptions.updatedAt))
    .limit(200);
}

export async function recentLedger(limit = 50) {
  return getDb()
    .select({ row: schema.creditLedger, email: schema.users.email })
    .from(schema.creditLedger)
    .innerJoin(schema.users, eq(schema.users.id, schema.creditLedger.userId))
    .orderBy(desc(schema.creditLedger.createdAt))
    .limit(limit);
}

export async function creditTotalsByReason(days = 30) {
  const c = schema.creditLedger;
  return getDb()
    .select({ reason: c.reason, total: sql<number>`coalesce(sum(${c.delta}), 0)::int`, rows: sql<number>`count(*)::int` })
    .from(c)
    .where(sql`${c.createdAt} >= now() - make_interval(days => ${days})`)
    .groupBy(c.reason);
}

/* Marketplace -------------------------------------------------------------------- */

export async function listAllListings(status?: string) {
  const l = schema.listings;
  const statuses = ["draft", "pending_review", "published", "rejected", "unpublished", "sold"] as const;
  const filter = (statuses as readonly string[]).includes(status ?? "") ? eq(l.status, status as (typeof statuses)[number]) : undefined;
  return getDb()
    .select({ id: l.id, title: l.title, kind: l.kind, niche: l.niche, earningMinCents: l.earningMinCents, earningMaxCents: l.earningMaxCents, status: l.status, priceCents: l.priceCents, currency: l.currency, licenseType: l.licenseType, validationLevel: l.validationLevel, updatedAt: l.updatedAt, sellerId: l.sellerId, sellerEmail: schema.users.email })
    .from(l)
    .innerJoin(schema.users, eq(schema.users.id, l.sellerId))
    .where(filter)
    .orderBy(desc(l.updatedAt))
    .limit(200);
}

export async function listAllDeals() {
  const d = schema.deals;
  return getDb()
    .select({
      id: d.id,
      state: d.state,
      amountCents: d.amountCents,
      feeCents: d.platformFeeCents,
      currency: d.currency,
      licenseType: d.licenseType,
      updatedAt: d.updatedAt,
      title: schema.listings.title,
      listingId: schema.listings.id,
      seller: sql<string>`(select email from users where id = ${d.sellerId})`,
      buyer: sql<string>`(select email from users where id = ${d.buyerId})`,
    })
    .from(d)
    .innerJoin(schema.listings, eq(schema.listings.id, d.listingId))
    .orderBy(desc(d.updatedAt))
    .limit(200);
}

export async function listPaymentsAndPayouts() {
  const [payments, payouts] = await Promise.all([
    getDb()
      .select({ p: schema.marketplacePayments, title: schema.listings.title })
      .from(schema.marketplacePayments)
      .innerJoin(schema.deals, eq(schema.deals.id, schema.marketplacePayments.dealId))
      .innerJoin(schema.listings, eq(schema.listings.id, schema.deals.listingId))
      .orderBy(desc(schema.marketplacePayments.createdAt))
      .limit(100),
    getDb()
      .select({ p: schema.payouts, email: schema.users.email })
      .from(schema.payouts)
      .innerJoin(schema.users, eq(schema.users.id, schema.payouts.sellerId))
      .orderBy(desc(schema.payouts.createdAt))
      .limit(100),
  ]);
  return { payments, payouts };
}
