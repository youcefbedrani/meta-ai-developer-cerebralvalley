import "server-only";
import { sql } from "drizzle-orm";
import type { ProjectCounts } from "@/lib/project-map";
import type { RatingKey } from "@/lib/validation/research";
import { getDb } from "@/server/db/client";
import { getProject } from "./projects";
import type { UserId } from "./user-id";

const n = (v: unknown) => Number(v ?? 0);

/** Everything the project map needs, in one query. Returns null when the project isn't the user's. */
export async function getProjectMapData(userId: UserId, projectId: string) {
  const project = await getProject(userId, projectId);
  if (!project) return null;
  const pid = project.id;
  const [row] = (await getDb().execute(sql`
    with latest as (
      select id, ratings from reports where project_id = ${pid} and type = 'validation' order by created_at desc limit 1
    )
    select
      exists(select 1 from ideas where project_id = ${pid}) as has_idea,
      (select count(*) from reports where project_id = ${pid} and type = 'validation') as reports,
      (select count(*) from sources where report_id = (select id from latest)) as sources,
      (select count(*) from evidence where report_id = (select id from latest) and kind = 'FACT') as facts,
      (select count(*) from evidence where report_id = (select id from latest) and kind = 'ANALYSIS') as analysis,
      (select count(*) from evidence where report_id = (select id from latest) and kind = 'ASSUMPTION') as assumptions,
      (select ratings from latest) as ratings,
      (select count(*) from competitors where project_id = ${pid}) as competitors,
      (select count(*) from competitors where project_id = ${pid} and pricing_source_id is not null) as competitors_with_pricing,
      (select count(*) from customer_language_quotes where project_id = ${pid}) as customer_quotes,
      (select count(*) from experiments where project_id = ${pid}) as experiments,
      (select count(*) from experiments where project_id = ${pid} and status = 'completed') as experiments_completed,
      (select count(*) from experiment_results r join experiments e on e.id = r.experiment_id where e.project_id = ${pid}) as results,
      (select count(*) from landing_pages where project_id = ${pid}) as landing_pages,
      (select count(*) from landing_pages where project_id = ${pid} and published) as landing_published,
      (select count(*) from page_events pe join landing_pages l on l.id = pe.landing_page_id where l.project_id = ${pid} and pe.type = 'visit') as visits,
      (select count(*) from waitlist_signups w join landing_pages l on l.id = w.landing_page_id where l.project_id = ${pid}) as signups,
      exists(select 1 from mvp_plans where project_id = ${pid}) as mvp_plan,
      exists(select 1 from reports where project_id = ${pid} and type = 'business_model') as business_model,
      exists(select 1 from marketing_plans where project_id = ${pid}) as marketing_plan,
      (select count(*) from marketing_channels where project_id = ${pid}) as channels,
      (select count(*) from channel_results where project_id = ${pid}) as channel_results,
      (select count(*) from ad_experiments where project_id = ${pid}) as ad_tests,
      (select status::text from listings where project_id = ${pid} order by updated_at desc limit 1) as listing
  `)) as unknown as Record<string, unknown>[];

  const counts: ProjectCounts = {
    descriptionLength: project.description.trim().length,
    hasIdea: !!row.has_idea,
    reports: n(row.reports),
    sources: n(row.sources),
    facts: n(row.facts),
    analysis: n(row.analysis),
    assumptions: n(row.assumptions),
    competitors: n(row.competitors),
    competitorsWithPricing: n(row.competitors_with_pricing),
    customerQuotes: n(row.customer_quotes),
    experiments: n(row.experiments),
    experimentsCompleted: n(row.experiments_completed),
    results: n(row.results),
    landingPages: n(row.landing_pages),
    landingPublished: n(row.landing_published),
    visits: n(row.visits),
    signups: n(row.signups),
    decision: project.decision,
    mvpPlan: !!row.mvp_plan,
    businessModel: !!row.business_model,
    marketingPlan: !!row.marketing_plan,
    channels: n(row.channels),
    channelResults: n(row.channel_results),
    adTests: n(row.ad_tests),
    listing: (row.listing as string | null) ?? null,
  };
  const ratings = (row.ratings ?? null) as Partial<Record<RatingKey, { score: number; label?: string; justification: string }>> | null;
  return { project, counts, ratings };
}
