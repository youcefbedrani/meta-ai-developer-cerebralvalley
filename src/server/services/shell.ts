import "server-only";
import { and, desc, eq, gt, ilike, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db/client";
import type { UserId } from "@/server/data/user-id";

/*
 * The top bar: notifications (built from work that finished: background jobs and Traditional → Innovative scans)
 * and search over the client's own projects, ideas and scans.
 */

export type ShellNotification = { id: string; title: string; detail: string; href: string; at: string; failed: boolean };

const JOB_TITLE: Record<string, string> = {
  competitor_scan: "Competitor scan finished",
  market_voices: "Market voices collected",
  design: "MVP design ready",
  codebase: "Code generated",
  codebase_edit: "Code updated",
  launch_video: "Launch video ready",
  social_post: "Posted to social",
};
const JOB_PATH: Record<string, string> = {
  competitor_scan: "competitors",
  market_voices: "language",
  design: "design",
  codebase: "design/code",
  codebase_edit: "design/code",
  launch_video: "videos",
  social_post: "videos",
};

const SINCE_DAYS = 14;

export async function listNotifications(userId: UserId): Promise<ShellNotification[]> {
  const db = getDb();
  const since = new Date(Date.now() - SINCE_DAYS * 86_400_000);
  const [jobs, scans] = await Promise.all([
    db
      .select({ id: schema.researchJobs.id, status: schema.researchJobs.status, input: schema.researchJobs.input, finishedAt: schema.researchJobs.finishedAt, projectId: schema.researchJobs.projectId, project: schema.projects.name })
      .from(schema.researchJobs)
      .innerJoin(schema.projects, eq(schema.projects.id, schema.researchJobs.projectId))
      .where(and(eq(schema.researchJobs.userId, userId), inArray(schema.researchJobs.status, ["succeeded", "failed"]), gt(schema.researchJobs.finishedAt, since)))
      .orderBy(desc(schema.researchJobs.finishedAt))
      .limit(20),
    db
      .select({ id: schema.innovationScans.id, status: schema.innovationScans.status, title: schema.innovationScans.title, finishedAt: schema.innovationScans.finishedAt })
      .from(schema.innovationScans)
      .where(and(eq(schema.innovationScans.userId, userId), inArray(schema.innovationScans.status, ["succeeded", "failed"]), gt(schema.innovationScans.finishedAt, since)))
      .orderBy(desc(schema.innovationScans.finishedAt))
      .limit(10),
  ]);
  const items: ShellNotification[] = [
    ...jobs.map((j) => {
      const kind = String(j.input?.kind ?? "research");
      const failed = j.status === "failed";
      return {
        id: j.id,
        title: failed ? "Something failed" : (JOB_TITLE[kind] ?? "Research finished"),
        detail: failed ? `${j.project} · ${JOB_TITLE[kind] ?? "Research finished"}` : j.project,
        href: `/app/projects/${j.projectId}/${JOB_PATH[kind] ?? "research"}`,
        at: j.finishedAt!.toISOString(),
        failed,
      };
    }),
    ...scans.map((s) => ({ id: s.id, title: s.status === "failed" ? "Something failed" : "Scan finished", detail: s.title || "Traditional → Innovative", href: `/app/innovation/${s.id}`, at: s.finishedAt!.toISOString(), failed: s.status === "failed" })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
}

export async function markNotificationsSeen(userId: UserId): Promise<void> {
  await getDb().update(schema.users).set({ notificationsSeenAt: new Date() }).where(eq(schema.users.id, userId));
}

export type SearchHit = { kind: "project" | "idea" | "scan"; id: string; title: string; detail: string; href: string };

/** The client's own projects, ideas and scans whose name matches (case-insensitive). */
export async function searchEverything(userId: UserId, query: string): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const db = getDb();
  const [projects, ideas, scans] = await Promise.all([
    db
      .select({ id: schema.projects.id, name: schema.projects.name, stage: schema.projects.stage })
      .from(schema.projects)
      .where(and(eq(schema.projects.userId, userId), ilike(schema.projects.name, like)))
      .orderBy(desc(schema.projects.updatedAt))
      .limit(6),
    db
      .select({ id: schema.ideas.id, title: sql<string>`${schema.ideas.content}->>'title'`, oneLiner: sql<string>`${schema.ideas.content}->>'oneLiner'` })
      .from(schema.ideas)
      .where(and(eq(schema.ideas.userId, userId), sql`(${schema.ideas.content}->>'title') ilike ${like}`))
      .orderBy(desc(schema.ideas.createdAt))
      .limit(5),
    db
      .select({ id: schema.innovationScans.id, title: schema.innovationScans.title, mode: schema.innovationScans.mode })
      .from(schema.innovationScans)
      .where(and(eq(schema.innovationScans.userId, userId), ilike(schema.innovationScans.title, like)))
      .orderBy(desc(schema.innovationScans.createdAt))
      .limit(5),
  ]);
  return [
    ...projects.map((p) => ({ kind: "project" as const, id: p.id, title: p.name, detail: p.stage, href: `/app/projects/${p.id}` })),
    ...ideas.map((i) => ({ kind: "idea" as const, id: i.id, title: i.title ?? "Idea", detail: i.oneLiner ?? "", href: `/app/ideas/${i.id}` })),
    ...scans.map((s) => ({ kind: "scan" as const, id: s.id, title: s.title || "Scan", detail: s.mode === "enterprise" ? "Enterprise" : "Manual work", href: `/app/innovation/${s.id}` })),
  ];
}
