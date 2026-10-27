import "server-only";
import { createHash } from "node:crypto";
import { and, avg, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { NDA_VERSION } from "@/lib/marketplace/terms";
import { publicMetrics } from "@/lib/marketplace/validation-level";
import { IN_PLATFORM_ASSETS, listingInputSchema, teaserSchema, type ListingInput, type Teaser } from "@/lib/validation/marketplace";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError, UserFacingError } from "./errors";
import type { IdeaContent } from "@/lib/validation/ideas";
import { getIdea } from "./ideas";
import { requireProject } from "./projects";
import type { UserId } from "./user-id";

/*
 * Marketplace listings, access control (NDA + access grants) and access log.
 * Sellers manage only their own listings; buyers see the public teaser, and
 * full details only after the NDA plus a granted access request or an offer.
 */

const isUuid = (id: string) => z.uuid().safeParse(id).success;
export type Listing = typeof schema.listings.$inferSelect;
export type ListingAsset = typeof schema.listingAssets.$inferSelect;

export function parseTeaser(listing: Pick<Listing, "teaser">): Teaser | null {
  const r = teaserSchema.safeParse(listing.teaser);
  return r.success ? r.data : null;
}

export async function audit(entry: { listingId?: string | null; dealId?: string | null; actorId?: string | null; actorRole: string; action: string; fromState?: string | null; toState?: string | null; data?: Record<string, unknown> }, tx: Pick<ReturnType<typeof getDb>, "insert"> = getDb()) {
  await tx.insert(schema.marketplaceAuditLog).values({ listingId: entry.listingId ?? null, dealId: entry.dealId ?? null, actorId: entry.actorId ?? null, actorRole: entry.actorRole, action: entry.action, fromState: entry.fromState ?? null, toState: entry.toState ?? null, data: entry.data ?? null });
}

async function assertNotBanned(userId: UserId) {
  const [u] = await getDb().select({ banned: schema.users.marketplaceBannedAt }).from(schema.users).where(eq(schema.users.id, userId));
  if (u?.banned) throw new UserFacingError("Your marketplace access has been suspended. Contact support.");
}

/* -------------------------------------------------------------- Seller side */

/** A private teaser built from a saved idea (shown to buyers only after NDA + access). */
export function teaserFromIdea(c: IdeaContent, niche: string): Teaser {
  const cut = (v: string, n: number) => (v.length > n ? `${v.slice(0, n - 1)}…` : v);
  return {
    title: cut(c.title, 100).padEnd(5, "."),
    problem: cut(c.problem, 600),
    market: cut(c.targetCustomer, 600).padEnd(10, "."),
    solution: cut(c.solution, 600),
    highlights: [c.oneLiner, ...c.pricingHypotheses].filter((h) => h.trim().length >= 3).slice(0, 5).map((h) => cut(h, 200)),
    idealBuyer: cut(`A founder building in ${niche}`, 300),
  };
}

export async function createListingDraft(userId: UserId, input: ListingInput): Promise<Listing> {
  await assertNotBanned(userId);
  const d = listingInputSchema.parse(input);
  const db = getDb();
  const common = {
    sellerId: userId,
    kind: d.kind,
    licenseType: d.licenseType,
    priceType: d.priceType,
    priceCents: d.price,
    minPriceCents: d.priceType === "offers" ? d.minPrice : null,
    maxPriceCents: d.priceType === "offers" ? d.maxPrice : null,
    currency: d.currency,
    niche: d.niche,
    earningMinCents: d.earningMin,
    earningMaxCents: d.earningMax,
    earningBasis: d.earningBasis,
    nonCompeteMonths: d.licenseType === "exclusive_transfer" ? d.nonCompeteMonths : 0,
    nonCompeteScope: d.nonCompeteScope,
  };
  const activeStatuses = ["draft", "pending_review", "published"] as const;

  if (d.kind === "idea") {
    const idea = await getIdea(userId, d.ideaId!);
    if (!idea) throw new NotFoundError("Idea");
    const [open] = await db.select({ id: schema.listings.id }).from(schema.listings).where(and(eq(schema.listings.ideaId, idea.id), inArray(schema.listings.status, [...activeStatuses]))).limit(1);
    if (open) throw new UserFacingError("This idea already has an active listing.");
    return db.transaction(async (tx) => {
      const [listing] = await tx
        .insert(schema.listings)
        .values({ ...common, ideaId: idea.id, projectId: null, title: idea.content.title.slice(0, 100), teaser: teaserFromIdea(idea.content, d.niche) })
        .returning();
      await tx.insert(schema.listingAssets).values({ listingId: listing.id, kind: "idea", description: "" });
      await audit({ listingId: listing.id, actorId: userId, actorRole: "seller", action: "listing_created", toState: "draft", data: { kind: "idea" } }, tx);
      return listing;
    });
  }

  const project = await requireProject(userId, d.projectId!);
  const [open] = await db.select({ id: schema.listings.id }).from(schema.listings).where(and(eq(schema.listings.projectId, project.id), inArray(schema.listings.status, [...activeStatuses]))).limit(1);
  if (open) throw new UserFacingError("This project already has an active listing.");
  return db.transaction(async (tx) => {
    const [listing] = await tx
      .insert(schema.listings)
      .values({ ...common, projectId: project.id, title: project.name.slice(0, 100), teaser: {} })
      .returning();
    // An exclusive transfer moves the whole project, so every in-platform asset is included.
    const kinds = d.licenseType === "exclusive_transfer" ? [...new Set([...IN_PLATFORM_ASSETS, ...d.assets])] : d.assets;
    await tx.insert(schema.listingAssets).values(kinds.map((kind) => ({ listingId: listing.id, kind, description: d.externalDescriptions[kind] ?? "" })));
    await audit({ listingId: listing.id, actorId: userId, actorRole: "seller", action: "listing_created", toState: "draft" }, tx);
    return listing;
  });
}

export async function getOwnListing(userId: UserId, listingId: string): Promise<(Listing & { assets: ListingAsset[] }) | null> {
  if (!isUuid(listingId)) return null;
  const [listing] = await getDb().select().from(schema.listings).where(and(eq(schema.listings.id, listingId), eq(schema.listings.sellerId, userId))).limit(1);
  if (!listing) return null;
  const assets = await getDb().select().from(schema.listingAssets).where(eq(schema.listingAssets.listingId, listing.id));
  return { ...listing, assets };
}

export async function requireOwnListing(userId: UserId, listingId: string) {
  const l = await getOwnListing(userId, listingId);
  if (!l) throw new NotFoundError("Listing");
  return l;
}

export async function listOwnListings(userId: UserId) {
  return getDb().select().from(schema.listings).where(eq(schema.listings.sellerId, userId)).orderBy(desc(schema.listings.updatedAt));
}

export async function setListingStatus(listingId: string, from: Listing["status"][], to: Listing["status"], actor: { id: string | null; role: string }, extra: Partial<typeof schema.listings.$inferInsert> = {}) {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .update(schema.listings)
      .set({ status: to, ...extra })
      .where(and(eq(schema.listings.id, listingId), inArray(schema.listings.status, from)))
      .returning();
    if (!row) throw new UserFacingError("This listing can't change to that status right now.");
    await audit({ listingId, actorId: actor.id, actorRole: actor.role, action: `listing_${to}`, toState: to, data: extra.reviewNote ? { note: extra.reviewNote } : undefined }, tx);
    return row;
  });
}

/* --------------------------------------------------------------- Browsing */

/**
 * What anyone can see before NDA + access: the niche, the price and the seller's earning estimate,
 * plus what kind of thing it is. No title, teaser, metrics or asset details.
 */
export type PublicListing = {
  id: string;
  kind: Listing["kind"];
  niche: string;
  licenseType: Listing["licenseType"];
  priceType: Listing["priceType"];
  priceCents: number;
  currency: string;
  earning: { minCents: number; maxCents: number } | null;
  publishedAt: Date | null;
  sellerRating: { average: number | null; count: number };
  /** Live counts from the seller's linked project, computed by the platform (never typed by the seller). */
  proof: ListingProof | null;
};

export type ListingProof = { facts: number; quotes: number; competitors: number; signups: number; results: number };

/** Validation proof per listing: counts from the linked project (or the project the sold idea belongs to). */
async function listingProofs(rows: Listing[]): Promise<Map<string, ListingProof>> {
  if (!rows.length) return new Map();
  const ids = rows.map((r) => r.id);
  const result = (await getDb().execute(sql`
    with l as (
      select li.id, coalesce(li.project_id, i.project_id) as pid
      from listings li left join ideas i on i.id = li.idea_id
      where li.id in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
    ), latest as (
      select distinct on (r.project_id) r.project_id, r.id from reports r join l on l.pid = r.project_id
      where r.type = 'validation' order by r.project_id, r.created_at desc
    )
    select l.id,
      (select count(*) from evidence e where e.report_id = (select id from latest where latest.project_id = l.pid) and e.kind = 'FACT') as facts,
      (select count(*) from customer_language_quotes q where q.project_id = l.pid) as quotes,
      (select count(*) from competitors c where c.project_id = l.pid) as competitors,
      (select count(*) from waitlist_signups w join landing_pages p on p.id = w.landing_page_id where p.project_id = l.pid) as signups,
      (select count(*) from experiment_results x join experiments e on e.id = x.experiment_id where e.project_id = l.pid) as results
    from l where l.pid is not null
  `)) as unknown as Record<string, unknown>[];
  return new Map(result.map((r) => [String(r.id), { facts: Number(r.facts), quotes: Number(r.quotes), competitors: Number(r.competitors), signups: Number(r.signups), results: Number(r.results) }]));
}

/** Shown to a buyer only once they have full access (NDA + granted access or an offer). */
export type ListingDetails = {
  title: string;
  teaser: Teaser | null;
  validationLevel: Listing["validationLevel"];
  metrics: ReturnType<typeof publicMetrics>;
  assets: { kind: ListingAsset["kind"] }[];
  earningBasis: string;
};

async function sellerRatings(sellerIds: string[]) {
  if (!sellerIds.length) return new Map<string, { average: number | null; count: number }>();
  const rows = await getDb()
    .select({ id: schema.reviews.revieweeId, average: avg(schema.reviews.rating), n: count() })
    .from(schema.reviews)
    .where(inArray(schema.reviews.revieweeId, sellerIds))
    .groupBy(schema.reviews.revieweeId);
  return new Map(rows.map((r) => [r.id, { average: r.average === null ? null : Number(r.average), count: r.n }]));
}

function toPublic(l: Listing, ratings: Map<string, { average: number | null; count: number }>, proofs: Map<string, ListingProof>): PublicListing {
  return {
    id: l.id,
    kind: l.kind,
    niche: l.niche || "Undisclosed niche",
    licenseType: l.licenseType,
    priceType: l.priceType,
    priceCents: l.priceCents,
    currency: l.currency,
    earning: l.earningMaxCents ? { minCents: l.earningMinCents ?? 0, maxCents: l.earningMaxCents } : null,
    publishedAt: l.publishedAt,
    sellerRating: ratings.get(l.sellerId) ?? { average: null, count: 0 },
    proof: proofs.get(l.id) ?? null,
  };
}

export function listingDetails(l: Listing, assets: ListingAsset[]): ListingDetails {
  return {
    title: l.title,
    teaser: parseTeaser(l),
    validationLevel: l.validationLevel,
    metrics: (l.metrics as { public?: ReturnType<typeof publicMetrics> }).public ?? [],
    assets: assets.filter((a) => a.listingId === l.id).map((a) => ({ kind: a.kind })),
    earningBasis: l.earningBasis,
  };
}

export async function listPublishedListings(filter: { kind?: Listing["kind"]; q?: string } = {}): Promise<PublicListing[]> {
  const where = [eq(schema.listings.status, "published")];
  if (filter.kind) where.push(eq(schema.listings.kind, filter.kind));
  if (filter.q) where.push(sql`${schema.listings.niche} ilike ${`%${filter.q.replace(/[%_]/g, "")}%`}`);
  const rows = await getDb().select().from(schema.listings).where(and(...where)).orderBy(desc(schema.listings.publishedAt)).limit(100);
  if (!rows.length) return [];
  const [ratings, proofs] = await Promise.all([sellerRatings([...new Set(rows.map((r) => r.sellerId))]), listingProofs(rows)]);
  return rows.map((l) => toPublic(l, ratings, proofs));
}

/** The public card of a published (or sold) listing: niche, price, earning estimate. */
export async function getPublicListing(listingId: string): Promise<(PublicListing & { status: Listing["status"]; sellerId: string }) | null> {
  if (!isUuid(listingId)) return null;
  const [l] = await getDb().select().from(schema.listings).where(and(eq(schema.listings.id, listingId), inArray(schema.listings.status, ["published", "sold"]))).limit(1);
  if (!l) return null;
  const [ratings, proofs] = await Promise.all([sellerRatings([l.sellerId]), listingProofs([l])]);
  return { ...toPublic(l, ratings, proofs), status: l.status, sellerId: l.sellerId };
}

/* ------------------------------------------------------- Access & NDA */

const hashIp = (ip: string | null) => (ip ? createHash("sha256").update(`listing-view:${ip}`).digest("hex").slice(0, 32) : null);

export async function logListingView(listingId: string, viewerId: string | null, kind: "teaser" | "full" | "package", ip: string | null) {
  await getDb().insert(schema.listingViews).values({ listingId, viewerId, kind, ipHash: hashIp(ip) });
}

export async function acceptNda(userId: UserId, listingId: string, meta: { ip: string | null; userAgent: string | null }) {
  await assertNotBanned(userId);
  const listing = await getPublicListing(listingId);
  if (!listing || listing.status !== "published") throw new NotFoundError("Listing");
  if (listing.sellerId === userId) throw new UserFacingError("You can't sign an NDA for your own listing.");
  await getDb()
    .insert(schema.ndaAcceptances)
    .values({ listingId, userId, version: NDA_VERSION, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300) ?? null })
    .onConflictDoNothing();
  await audit({ listingId, actorId: userId, actorRole: "buyer", action: "nda_accepted", data: { version: NDA_VERSION } });
}

export async function requestAccess(userId: UserId, listingId: string, message: string) {
  if (!(await hasSignedNda(userId, listingId))) throw new UserFacingError("Accept the NDA first.");
  await getDb()
    .insert(schema.listingAccess)
    .values({ listingId, buyerId: userId, message: message.trim().slice(0, 1000) || null })
    .onConflictDoNothing();
}

export async function decideAccess(sellerId: UserId, accessId: string, grant: boolean) {
  if (!isUuid(accessId)) throw new NotFoundError("Access request");
  const [row] = await getDb()
    .select({ a: schema.listingAccess })
    .from(schema.listingAccess)
    .innerJoin(schema.listings, eq(schema.listings.id, schema.listingAccess.listingId))
    .where(and(eq(schema.listingAccess.id, accessId), eq(schema.listings.sellerId, sellerId)))
    .limit(1);
  if (!row) throw new NotFoundError("Access request");
  await getDb().update(schema.listingAccess).set({ status: grant ? "granted" : "declined", decidedAt: new Date() }).where(eq(schema.listingAccess.id, accessId));
  await audit({ listingId: row.a.listingId, actorId: sellerId, actorRole: "seller", action: grant ? "access_granted" : "access_declined", data: { buyerId: row.a.buyerId } });
}

export async function listAccessRequests(sellerId: UserId, listingId: string) {
  return getDb()
    .select({ id: schema.listingAccess.id, status: schema.listingAccess.status, message: schema.listingAccess.message, createdAt: schema.listingAccess.createdAt, buyerName: schema.users.name, buyerEmail: schema.users.email })
    .from(schema.listingAccess)
    .innerJoin(schema.listings, eq(schema.listings.id, schema.listingAccess.listingId))
    .innerJoin(schema.users, eq(schema.users.id, schema.listingAccess.buyerId))
    .where(and(eq(schema.listingAccess.listingId, listingId), eq(schema.listings.sellerId, sellerId)))
    .orderBy(desc(schema.listingAccess.createdAt));
}

export async function hasSignedNda(userId: UserId, listingId: string): Promise<boolean> {
  if (!isUuid(listingId)) return false;
  const [row] = await getDb()
    .select({ id: schema.ndaAcceptances.id })
    .from(schema.ndaAcceptances)
    .where(and(eq(schema.ndaAcceptances.listingId, listingId), eq(schema.ndaAcceptances.userId, userId), eq(schema.ndaAcceptances.version, NDA_VERSION)))
    .limit(1);
  return !!row;
}

export type AccessState = { nda: boolean; access: "none" | "requested" | "granted" | "declined"; hasDeal: boolean; full: boolean };

/** Full details need: signed in + current NDA + (seller-granted access OR an offer/deal on the listing). */
export async function getAccessState(userId: UserId, listingId: string): Promise<AccessState> {
  if (!isUuid(listingId)) return { nda: false, access: "none", hasDeal: false, full: false };
  const db = getDb();
  const [nda, [access], [deal]] = await Promise.all([
    hasSignedNda(userId, listingId),
    db.select({ status: schema.listingAccess.status }).from(schema.listingAccess).where(and(eq(schema.listingAccess.listingId, listingId), eq(schema.listingAccess.buyerId, userId))).limit(1),
    db.select({ id: schema.deals.id }).from(schema.deals).where(and(eq(schema.deals.listingId, listingId), eq(schema.deals.buyerId, userId), ne(schema.deals.state, "CANCELLED"))).limit(1),
  ]);
  const accessStatus = (access?.status ?? "none") as AccessState["access"];
  return { nda, access: accessStatus, hasDeal: !!deal, full: nda && (accessStatus === "granted" || !!deal) };
}

/* ---------------------------------------------------------- Reports */

export async function reportListing(userId: UserId, listingId: string, reason: string) {
  const listing = await getPublicListing(listingId);
  if (!listing) throw new NotFoundError("Listing");
  await getDb().insert(schema.listingReports).values({ listingId, reporterId: userId, reason: reason.slice(0, 1000) });
  await audit({ listingId, actorId: userId, actorRole: "user", action: "listing_reported" });
}

/** Listings similar to `embedding` among other active listings (cosine similarity via pgvector). */
export async function findSimilarListing(listingId: string, embedding: number[]): Promise<{ listingId: string; score: number } | null> {
  const vec = `[${embedding.join(",")}]`;
  const [row] = await getDb()
    .select({ id: schema.listings.id, score: sql<number>`1 - (${schema.listings.embedding} <=> ${vec}::vector)`.mapWith(Number) })
    .from(schema.listings)
    .where(and(ne(schema.listings.id, listingId), sql`${schema.listings.embedding} is not null`, or(eq(schema.listings.status, "published"), eq(schema.listings.status, "pending_review"), eq(schema.listings.status, "sold"))))
    .orderBy(sql`${schema.listings.embedding} <=> ${vec}::vector`)
    .limit(1);
  return row ? { listingId: row.id, score: row.score } : null;
}
