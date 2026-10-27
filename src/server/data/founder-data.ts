import "server-only";
import { sql } from "drizzle-orm";
import { getCreditSummary } from "@/server/billing/credits";
import { getDb } from "@/server/db/client";
import { getProfile } from "./profiles";
import type { UserId } from "./user-id";

const n = (v: unknown) => Number(v ?? 0);

export const STAGES = ["idea", "research", "validation", "planning", "building", "launched"] as const;

/** Everything a founder (or an admin looking at them) needs to see their own data at a glance. Real counts only. */
export async function getFounderData(userId: UserId) {
  const [profile, credits, [row]] = await Promise.all([
    getProfile(userId),
    getCreditSummary(userId),
    getDb().execute(sql`
      select
        (select count(*) from ideas where user_id = ${userId} and status <> 'dismissed') as ideas,
        (select count(*) from ideas where user_id = ${userId} and status = 'saved') as ideas_saved,
        (select count(*) from projects where user_id = ${userId} and status = 'active') as projects,
        (select coalesce(json_object_agg(stage, c), '{}') from (select stage, count(*) as c from projects where user_id = ${userId} and status = 'active' group by stage) s) as stages,
        (select count(*) from reports r join projects p on p.id = r.project_id where p.user_id = ${userId} and r.type = 'validation') as reports,
        (select count(*) from evidence e join reports r on r.id = e.report_id join projects p on p.id = r.project_id where p.user_id = ${userId} and e.kind = 'FACT') as facts,
        (select count(*) from competitors c join projects p on p.id = c.project_id where p.user_id = ${userId}) as competitors,
        (select count(*) from customer_language_quotes where user_id = ${userId}) as quotes,
        (select count(*) from experiments e join projects p on p.id = e.project_id where p.user_id = ${userId} and e.status = 'completed') as experiments,
        (select count(*) from waitlist_signups w join landing_pages l on l.id = w.landing_page_id join projects p on p.id = l.project_id where p.user_id = ${userId}) as signups,
        (select count(*) from listings where seller_id = ${userId} and status = 'published') as listings
    `) as unknown as Promise<Record<string, unknown>[]>,
  ]);
  const stages = (row.stages ?? {}) as Record<string, unknown>;
  return {
    profile,
    credits: { balance: credits.balance, allowance: credits.monthlyAllowance, used: credits.usedThisMonth, plan: credits.plan },
    counts: {
      ideas: n(row.ideas),
      ideasSaved: n(row.ideas_saved),
      projects: n(row.projects),
      reports: n(row.reports),
      facts: n(row.facts),
      competitors: n(row.competitors),
      quotes: n(row.quotes),
      experiments: n(row.experiments),
      signups: n(row.signups),
      listings: n(row.listings),
    },
    stages: STAGES.map((s) => ({ stage: s, count: n(stages[s]) })),
  };
}

export type FounderData = Awaited<ReturnType<typeof getFounderData>>;
