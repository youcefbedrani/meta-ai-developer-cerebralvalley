import "server-only";
import { WAITLIST_CONSENT_VERSION } from "@/lib/marketplace/terms";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getDb, schema } from "@/server/db/client";
import { parseStoredBrand, type StoredBrand } from "@/lib/brand-kit";
import { landingContentSchema, slugSchema, type LandingContent } from "@/lib/validation/experiments";
import { NotFoundError } from "./errors";
import { requireProject } from "./projects";
import type { UserId } from "./user-id";

/*
 * Landing pages & waitlists. Owner operations are scoped by project ownership.
 * Public operations (view, visit, signup) only ever touch *published* pages
 * and never expose owner data.
 */

const isUuid = (id: string) => z.uuid().safeParse(id).success;

export type LandingPage = Omit<typeof schema.landingPages.$inferSelect, "content"> & { content: LandingContent };

export class SlugTakenError extends Error {
  constructor() {
    super("That address is already taken. Try another.");
    this.name = "SlugTakenError";
  }
}

const parse = (row: typeof schema.landingPages.$inferSelect): LandingPage => ({ ...row, content: landingContentSchema.parse(row.content) });

export function suggestSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) || "page";
  return `${base}-${randomBytes(2).toString("hex")}`;
}

async function ownedPage(userId: UserId, pageId: string) {
  if (!isUuid(pageId)) return null;
  const [row] = await getDb()
    .select({ p: schema.landingPages })
    .from(schema.landingPages)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.landingPages.projectId))
    .where(and(eq(schema.landingPages.id, pageId), eq(schema.projects.userId, userId)))
    .limit(1);
  return row?.p ?? null;
}

export async function getLandingPage(userId: UserId, pageId: string): Promise<LandingPage | null> {
  const row = await ownedPage(userId, pageId);
  return row ? parse(row) : null;
}

export async function listLandingPages(userId: UserId, projectId: string): Promise<(LandingPage & { signups: number })[]> {
  if (!isUuid(projectId)) return [];
  const db = getDb();
  const rows = await db
    .select({ p: schema.landingPages })
    .from(schema.landingPages)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.landingPages.projectId))
    .where(and(eq(schema.landingPages.projectId, projectId), eq(schema.projects.userId, userId)))
    .orderBy(desc(schema.landingPages.createdAt));
  const ids = rows.map((r) => r.p.id);
  const counts = ids.length
    ? await db
        .select({ pageId: schema.waitlistSignups.landingPageId, n: count() })
        .from(schema.waitlistSignups)
        .where(inArray(schema.waitlistSignups.landingPageId, ids))
        .groupBy(schema.waitlistSignups.landingPageId)
    : [];
  const byPage = new Map(counts.map((c) => [c.pageId, c.n]));
  return rows.map((r) => ({ ...parse(r.p), signups: byPage.get(r.p.id) ?? 0 }));
}

export async function createLandingPage(
  userId: UserId,
  projectId: string,
  input: { content: LandingContent; slug: string; experimentId?: string | null },
): Promise<LandingPage> {
  const project = await requireProject(userId, projectId);
  const content = landingContentSchema.parse(input.content);
  const slug = slugSchema.parse(input.slug);
  let experimentId: string | null = null;
  if (input.experimentId) {
    const [exp] = await getDb()
      .select({ id: schema.experiments.id })
      .from(schema.experiments)
      .where(and(eq(schema.experiments.id, input.experimentId), eq(schema.experiments.projectId, project.id)))
      .limit(1);
    if (!exp) throw new NotFoundError("Experiment");
    experimentId = exp.id;
  }
  try {
    const [row] = await getDb().insert(schema.landingPages).values({ projectId: project.id, experimentId, slug, content }).returning();
    return parse(row);
  } catch (err) {
    if (err instanceof Error && /landing_pages_slug_idx|duplicate key/.test(`${err.message} ${(err as { cause?: Error }).cause?.message ?? ""}`)) throw new SlugTakenError();
    throw err;
  }
}

export async function updateLandingPage(userId: UserId, pageId: string, input: { content: LandingContent; slug: string }): Promise<LandingPage> {
  const page = await ownedPage(userId, pageId);
  if (!page) throw new NotFoundError("Landing page");
  const content = landingContentSchema.parse(input.content);
  const slug = slugSchema.parse(input.slug);
  try {
    const [row] = await getDb().update(schema.landingPages).set({ content, slug }).where(eq(schema.landingPages.id, page.id)).returning();
    return parse(row);
  } catch (err) {
    if (err instanceof Error && /landing_pages_slug_idx|duplicate key/.test(`${err.message} ${(err as { cause?: Error }).cause?.message ?? ""}`)) throw new SlugTakenError();
    throw err;
  }
}

export async function setLandingPublished(userId: UserId, pageId: string, published: boolean): Promise<void> {
  const page = await ownedPage(userId, pageId);
  if (!page) throw new NotFoundError("Landing page");
  await getDb().update(schema.landingPages).set({ published }).where(eq(schema.landingPages.id, page.id));
}

export async function deleteLandingPage(userId: UserId, pageId: string): Promise<void> {
  const page = await ownedPage(userId, pageId);
  if (!page) throw new NotFoundError("Landing page");
  await getDb().delete(schema.landingPages).where(eq(schema.landingPages.id, page.id));
}

export async function listSignups(userId: UserId, pageId: string) {
  const page = await ownedPage(userId, pageId);
  if (!page) return [];
  return getDb()
    .select({ email: schema.waitlistSignups.email, createdAt: schema.waitlistSignups.createdAt })
    .from(schema.waitlistSignups)
    .where(eq(schema.waitlistSignups.landingPageId, page.id))
    .orderBy(desc(schema.waitlistSignups.createdAt));
}

/** Live funnel numbers for a page (real counts only). */
export async function getPageStats(pageId: string) {
  const db = getDb();
  const [page] = await db.select({ visits: schema.landingPages.visitCount }).from(schema.landingPages).where(eq(schema.landingPages.id, pageId));
  const [signupRow] = await db.select({ n: count() }).from(schema.waitlistSignups).where(eq(schema.waitlistSignups.landingPageId, pageId));
  const visits = page?.visits ?? 0;
  const signups = signupRow?.n ?? 0;
  return { visits, signups, conversion: visits > 0 ? signups / visits : null };
}

export async function getLandingPageForExperiment(userId: UserId, experimentId: string) {
  if (!isUuid(experimentId)) return null;
  const [row] = await getDb()
    .select({ p: schema.landingPages })
    .from(schema.landingPages)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.landingPages.projectId))
    .where(and(eq(schema.landingPages.experimentId, experimentId), eq(schema.projects.userId, userId)))
    .limit(1);
  return row ? parse(row.p) : null;
}

/* ------------------------------------------------------------ public */

export async function getPublishedPage(slug: string): Promise<(LandingPage & { projectName: string; brand: StoredBrand | null }) | null> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  const [row] = await getDb()
    .select({ p: schema.landingPages, projectName: schema.projects.name, brand: schema.projects.brand })
    .from(schema.landingPages)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.landingPages.projectId))
    .where(and(eq(schema.landingPages.slug, parsed.data), eq(schema.landingPages.published, true)))
    .limit(1);
  return row ? { ...parse(row.p), projectName: row.projectName, brand: parseStoredBrand(row.brand) } : null;
}

export type UtmTags = Partial<Record<"source" | "medium" | "campaign" | "content" | "term", string>>;

const utmValues = (utm: UtmTags | undefined) => ({
  utmSource: utm?.source ?? null,
  utmMedium: utm?.medium ?? null,
  utmCampaign: utm?.campaign ?? null,
  utmContent: utm?.content ?? null,
  utmTerm: utm?.term ?? null,
});

export async function recordVisit(slug: string, utm?: UtmTags): Promise<boolean> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return false;
  return getDb().transaction(async (tx) => {
    const updated = await tx
      .update(schema.landingPages)
      .set({ visitCount: sql`${schema.landingPages.visitCount} + 1` })
      .where(and(eq(schema.landingPages.slug, parsed.data), eq(schema.landingPages.published, true)))
      .returning({ id: schema.landingPages.id });
    if (!updated.length) return false;
    await tx.insert(schema.pageEvents).values({ landingPageId: updated[0].id, type: "visit", ...utmValues(utm) });
    return true;
  });
}

/** Adds an email to a published page's waitlist. Duplicate emails are accepted silently, not double-counted. */
export async function addSignup(slug: string, email: string, source?: string, utm?: UtmTags, consentTransfer = false): Promise<boolean> {
  const page = await getPublishedPage(slug);
  if (!page) return false;
  await getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.waitlistSignups)
      .values({
        landingPageId: page.id,
        email: email.trim().toLowerCase(),
        source: source?.slice(0, 200) ?? null,
        consentTransfer,
        consentAt: consentTransfer ? new Date() : null,
        consentVersion: consentTransfer ? WAITLIST_CONSENT_VERSION : null,
      })
      .onConflictDoNothing()
      .returning({ id: schema.waitlistSignups.id });
    // Only new signups count as events, so a repeated email isn't double-counted.
    if (inserted.length) await tx.insert(schema.pageEvents).values({ landingPageId: page.id, type: "signup", ...utmValues({ source, ...utm }) });
  });
  return true;
}
