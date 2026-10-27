import "server-only";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import type { JourneyProgress } from "@/lib/journey";
import { getDb, schema } from "@/server/db/client";
import type { UserId } from "./user-id";

/*
 * Journey progress from the user's own data: each step is done once the
 * thing it asks for exists. Every check is scoped to the user's projects.
 */

type Row = Record<"goldMine" | "ideas" | "project" | "research" | "validate" | "decide" | "plan" | "launch" | "customers" | "results" | "signups", boolean>;

export async function getJourneyProgress(userId: UserId): Promise<{ progress: JourneyProgress; focusProjectId: string | null }> {
  const db = getDb();
  const { projects: p, reports, experiments, mvpPlans, landingPages, waitlistSignups, marketingPlans, channelResults, goldMineSessions, ideas } = schema;
  const own = sql`(select ${p.id} from ${p} where ${p.userId} = ${userId})`;
  const exists = (q: SQL) => sql`exists(${q})`;

  const fields = {
    goldMine: exists(sql`select 1 from ${goldMineSessions} where ${goldMineSessions.userId} = ${userId}`),
    ideas: exists(sql`select 1 from ${ideas} where ${ideas.userId} = ${userId}`),
    project: exists(sql`select 1 from ${p} where ${p.userId} = ${userId}`),
    research: exists(sql`select 1 from ${reports} where ${reports.projectId} in ${own} and ${reports.type} = 'validation'`),
    validate: exists(sql`select 1 from ${experiments} where ${experiments.projectId} in ${own} and ${experiments.status} = 'completed'`),
    decide: exists(sql`select 1 from ${p} where ${p.userId} = ${userId} and ${p.decision} is not null`),
    plan: sql`(${exists(sql`select 1 from ${mvpPlans} where ${mvpPlans.projectId} in ${own}`)} or ${exists(sql`select 1 from ${reports} where ${reports.projectId} in ${own} and ${reports.type} = 'business_model'`)})`,
    launch: exists(sql`select 1 from ${landingPages} where ${landingPages.projectId} in ${own} and ${landingPages.published}`),
    customers: exists(sql`select 1 from ${marketingPlans} where ${marketingPlans.projectId} in ${own}`),
    results: exists(sql`select 1 from ${channelResults} where ${channelResults.projectId} in ${own}`),
    signups: exists(
      sql`select 1 from ${waitlistSignups} join ${landingPages} on ${landingPages.id} = ${waitlistSignups.landingPageId} where ${landingPages.projectId} in ${own}`,
    ),
  } satisfies Record<keyof Row, SQL>;

  const select = sql.join(
    Object.entries(fields).map(([k, v]) => sql`${v} as ${sql.identifier(k)}`),
    sql`, `,
  );
  const [row] = (await db.execute(sql`select ${select}`)) as unknown as Row[];

  const [focus] = await db
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.userId, userId), eq(p.status, "active")))
    .orderBy(desc(p.updatedAt))
    .limit(1);

  return {
    progress: {
      idea: row.goldMine || row.ideas || row.project,
      project: row.project,
      research: row.research,
      validate: row.validate,
      decide: row.decide,
      plan: row.plan,
      launch: row.launch,
      customers: row.customers,
      measure: row.results || row.signups,
    },
    focusProjectId: focus?.id ?? null,
  };
}
