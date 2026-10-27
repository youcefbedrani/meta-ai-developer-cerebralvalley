import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

/*
 * Admin overview numbers. Every figure is a count or sum over real rows; nothing is estimated.
 * One round trip per block, using scalar sub-selects.
 */

const n = (v: unknown) => Number(v ?? 0);

export type Overview = Awaited<ReturnType<typeof getOverview>>;

export async function getOverview() {
  const db = getDb();
  const [row] = (await db.execute(sql`
    select
      (select count(*) from users) as users_total,
      (select count(*) from users where created_at >= now() - interval '7 days') as users_7d,
      (select count(*) from users where created_at >= now() - interval '30 days') as users_30d,
      (select count(*) from users where onboarded_at is not null) as users_onboarded,
      (select count(*) from users where suspended_at is not null) as users_suspended,
      (select count(*) from users where plan = 'free') as plan_free,
      (select count(*) from users where plan = 'founder') as plan_founder,
      (select count(*) from users where plan = 'studio') as plan_studio,
      (select count(distinct user_id) from ai_usage_logs where created_at >= now() - interval '7 days') as active_7d,
      (select count(*) from projects) as projects_total,
      (select count(*) from projects where created_at >= now() - interval '30 days') as projects_30d,
      (select count(*) from research_jobs where created_at >= now() - interval '30 days') as jobs_30d,
      (select count(*) from research_jobs where status = 'failed' and created_at >= now() - interval '30 days') as jobs_failed_30d,
      (select count(*) from research_jobs where status in ('queued', 'running')) as jobs_active,
      (select count(*) from ai_usage_logs where created_at >= now() - interval '30 days') as ai_calls_30d,
      (select count(*) from ai_usage_logs where status <> 'success' and created_at >= now() - interval '30 days') as ai_errors_30d,
      (select coalesce(sum(estimated_cost_usd), 0) from ai_usage_logs where created_at >= now() - interval '30 days') as ai_cost_30d,
      (select coalesce(-sum(delta), 0) from credit_ledger where reason in ('reservation', 'refund', 'usage') and created_at >= now() - interval '30 days') as credits_used_30d,
      (select count(*) from subscriptions where status in ('active', 'trialing')) as subs_active,
      (select count(*) from landing_pages where published) as pages_published,
      (select count(*) from waitlist_signups) as waitlist_total,
      (select count(*) from listings where status = 'published') as listings_published,
      (select count(*) from listings where status = 'pending_review') as listings_pending,
      (select count(*) from deals where state in ('ACCEPTED', 'PAYMENT_HELD', 'TRANSFER_IN_PROGRESS', 'BUYER_CONFIRMED')) as deals_open,
      (select coalesce(sum(amount_cents), 0) from marketplace_payments where status = 'succeeded') as gmv_cents,
      (select coalesce(sum(fee_cents), 0) from marketplace_payments where status = 'succeeded') as fees_cents,
      (select count(*) from listing_reports where status = 'open') as reports_open,
      (select count(*) from disputes where status = 'open') as disputes_open
  `)) as unknown as Record<string, unknown>[];
  const r = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, n(v)])) as Record<string, number>;
  return {
    users: { total: r.users_total, last7d: r.users_7d, last30d: r.users_30d, onboarded: r.users_onboarded, suspended: r.users_suspended, active7d: r.active_7d },
    plans: { free: r.plan_free, founder: r.plan_founder, studio: r.plan_studio, activeSubscriptions: r.subs_active },
    projects: { total: r.projects_total, last30d: r.projects_30d, pagesPublished: r.pages_published, waitlistSignups: r.waitlist_total },
    jobs: { last30d: r.jobs_30d, failed30d: r.jobs_failed_30d, active: r.jobs_active },
    ai: { calls30d: r.ai_calls_30d, errors30d: r.ai_errors_30d, costUsd30d: r.ai_cost_30d, creditsUsed30d: r.credits_used_30d },
    marketplace: {
      published: r.listings_published,
      pending: r.listings_pending,
      openDeals: r.deals_open,
      gmvCents: r.gmv_cents,
      feesCents: r.fees_cents,
      openReports: r.reports_open,
      openDisputes: r.disputes_open,
    },
  };
}

/** New accounts per UTC day for the last `days` days, zero-filled, oldest first. */
export async function signupsByDay(days = 30): Promise<{ day: string; count: number }[]> {
  const rows = (await getDb().execute(sql`
    select to_char(d, 'YYYY-MM-DD') as day, count(u.id) as count
    from generate_series((now() at time zone 'utc')::date - ${days - 1}::int, (now() at time zone 'utc')::date, interval '1 day') d
    left join users u on (u.created_at at time zone 'utc')::date = d::date
    group by d order by d
  `)) as unknown as { day: string; count: unknown }[];
  return rows.map((r) => ({ day: r.day, count: n(r.count) }));
}
