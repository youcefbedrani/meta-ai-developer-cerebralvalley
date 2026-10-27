import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { ASSET_LABELS, EXTERNAL_ASSETS, type AssetKind } from "@/lib/validation/marketplace";
import { getDb, schema } from "@/server/db/client";
import { ideaContentSchema } from "@/lib/validation/ideas";
import { getAccessState, listingDetails, logListingView } from "@/server/data/marketplace";
import type { UserId } from "@/server/data/user-id";

/**
 * Full package details for a buyer who signed the NDA and has access (granted
 * or via an offer). Only the assets included in the listing are returned, and
 * every access is logged.
 */
export async function getListingPackage(viewerId: UserId, listingId: string, ip: string | null) {
  const access = await getAccessState(viewerId, listingId);
  if (!access.full) return { access, pkg: null };
  const db = getDb();
  const [listing] = await db.select().from(schema.listings).where(eq(schema.listings.id, listingId));
  if (!listing) return { access, pkg: null };
  const assets = await db.select().from(schema.listingAssets).where(eq(schema.listingAssets.listingId, listingId));
  const details = listingDetails(listing, assets);

  if (listing.kind === "idea") {
    const [row] = listing.ideaId ? await db.select({ content: schema.ideas.content }).from(schema.ideas).where(eq(schema.ideas.id, listing.ideaId)) : [];
    const parsed = row ? ideaContentSchema.safeParse(row.content) : null;
    await logListingView(listingId, viewerId, "full", ip);
    return { access, details, pkg: null, idea: parsed?.success ? parsed.data : null };
  }
  if (!listing.projectId) return { access, details, pkg: null };
  const pid = listing.projectId;
  const has = (k: AssetKind) => assets.some((a) => a.kind === k);
  await logListingView(listingId, viewerId, "full", ip);

  const [report] = has("research_reports") ? await db.select().from(schema.reports).where(and(eq(schema.reports.projectId, pid), eq(schema.reports.type, "validation"))).orderBy(desc(schema.reports.createdAt)).limit(1) : [];
  const sources = report ? await db.select({ title: schema.sources.title, domain: schema.sources.domain, url: schema.sources.url }).from(schema.sources).where(eq(schema.sources.reportId, report.id)).limit(20) : [];
  const competitors = has("competitors") ? await db.select({ name: schema.competitors.name, type: schema.competitors.type, website: schema.competitors.website }).from(schema.competitors).where(eq(schema.competitors.projectId, pid)) : [];
  const quotes = has("pain_quotes") ? await db.select({ quote: schema.customerLanguageQuotes.quote, cluster: schema.customerLanguageQuotes.clusterTitle, platform: schema.customerLanguageQuotes.platform }).from(schema.customerLanguageQuotes).where(eq(schema.customerLanguageQuotes.projectId, pid)).limit(30) : [];
  const experiments = has("experiments")
    ? await db.select({ title: schema.experiments.title, type: schema.experiments.type, status: schema.experiments.status, passed: schema.experiments.passed, learnings: schema.experiments.learnings, successCriteria: schema.experiments.successCriteria }).from(schema.experiments).where(eq(schema.experiments.projectId, pid))
    : [];
  const [mvp] = has("mvp_plan") ? await db.select({ content: schema.mvpPlans.content }).from(schema.mvpPlans).where(eq(schema.mvpPlans.projectId, pid)).orderBy(desc(schema.mvpPlans.createdAt)).limit(1) : [];
  const [marketing] = has("marketing") ? await db.select({ content: schema.marketingPlans.content }).from(schema.marketingPlans).where(eq(schema.marketingPlans.projectId, pid)).orderBy(desc(schema.marketingPlans.createdAt)).limit(1) : [];
  const pages = has("landing_page") ? await db.select({ id: schema.landingPages.id, slug: schema.landingPages.slug, visits: schema.landingPages.visitCount }).from(schema.landingPages).where(eq(schema.landingPages.projectId, pid)) : [];
  let waitlist: { total: number; consented: number } | null = null;
  if (has("waitlist") && pages.length) {
    const [t] = await db.select({ n: count() }).from(schema.waitlistSignups).innerJoin(schema.landingPages, eq(schema.landingPages.id, schema.waitlistSignups.landingPageId)).where(eq(schema.landingPages.projectId, pid));
    const [c] = await db
      .select({ n: count() })
      .from(schema.waitlistSignups)
      .innerJoin(schema.landingPages, eq(schema.landingPages.id, schema.waitlistSignups.landingPageId))
      .where(and(eq(schema.landingPages.projectId, pid), eq(schema.waitlistSignups.consentTransfer, true), eq(schema.waitlistSignups.redacted, false)));
    // Counts only. Emails are never shown before transfer.
    waitlist = { total: t.n, consented: c.n };
  }
  return {
    access,
    details,
    pkg: {
      research: report ? { summary: report.summary, sources } : null,
      competitors,
      quotes,
      experiments,
      mvp: mvp?.content ?? null,
      marketing: marketing ? { positioning: (marketing.content as { positioning?: unknown }).positioning ?? null } : null,
      landingPages: pages.map((p) => ({ visits: p.visits })),
      waitlist,
      external: assets.filter((a) => (EXTERNAL_ASSETS as readonly string[]).includes(a.kind)).map((a) => ({ label: ASSET_LABELS[a.kind], description: a.description })),
    },
  };
}
