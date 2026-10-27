import "server-only";
import { count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { ideaContentSchema } from "@/lib/validation/ideas";
import { adminListingEditSchema } from "@/lib/validation/marketplace";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError, UserFacingError } from "@/server/data/errors";
import { audit, parseTeaser, setListingStatus } from "@/server/data/marketplace";
import { refundDeal, transition } from "@/server/marketplace/deals";
import { logAdmin, type AdminActor } from "./audit";

/** Everything about a listing, including what buyers never see before access. Admins only. */
export async function getAdminListing(listingId: string) {
  if (!z.uuid().safeParse(listingId).success) return null;
  const db = getDb();
  const [row] = await db
    .select({ l: schema.listings, sellerEmail: schema.users.email, sellerName: schema.users.name, banned: schema.users.marketplaceBannedAt })
    .from(schema.listings)
    .innerJoin(schema.users, eq(schema.users.id, schema.listings.sellerId))
    .where(eq(schema.listings.id, listingId))
    .limit(1);
  if (!row) return null;
  const l = row.l;
  const [assets, [views], [ndas], access, deals, events, project, idea] = await Promise.all([
    db.select().from(schema.listingAssets).where(eq(schema.listingAssets.listingId, l.id)),
    db.select({ n: count() }).from(schema.listingViews).where(eq(schema.listingViews.listingId, l.id)),
    db.select({ n: count() }).from(schema.ndaAcceptances).where(eq(schema.ndaAcceptances.listingId, l.id)),
    db
      .select({ id: schema.listingAccess.id, status: schema.listingAccess.status, createdAt: schema.listingAccess.createdAt, buyerEmail: schema.users.email })
      .from(schema.listingAccess)
      .innerJoin(schema.users, eq(schema.users.id, schema.listingAccess.buyerId))
      .where(eq(schema.listingAccess.listingId, l.id))
      .orderBy(desc(schema.listingAccess.createdAt)),
    db
      .select({ id: schema.deals.id, state: schema.deals.state, amountCents: schema.deals.amountCents, currency: schema.deals.currency, updatedAt: schema.deals.updatedAt, buyerEmail: schema.users.email })
      .from(schema.deals)
      .innerJoin(schema.users, eq(schema.users.id, schema.deals.buyerId))
      .where(eq(schema.deals.listingId, l.id))
      .orderBy(desc(schema.deals.updatedAt)),
    db.select().from(schema.marketplaceAuditLog).where(eq(schema.marketplaceAuditLog.listingId, l.id)).orderBy(desc(schema.marketplaceAuditLog.createdAt)).limit(30),
    l.projectId ? db.select({ id: schema.projects.id, name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, l.projectId)) : Promise.resolve([]),
    l.ideaId ? db.select({ id: schema.ideas.id, content: schema.ideas.content }).from(schema.ideas).where(eq(schema.ideas.id, l.ideaId)) : Promise.resolve([]),
  ]);
  const ideaContent = idea[0] ? ideaContentSchema.safeParse(idea[0].content) : null;
  return {
    listing: l,
    seller: { id: l.sellerId, email: row.sellerEmail, name: row.sellerName, banned: !!row.banned },
    teaser: parseTeaser(l),
    assets,
    views: views.n,
    ndas: ndas.n,
    access,
    deals,
    events,
    project: project[0] ?? null,
    idea: ideaContent?.success ? ideaContent.data : null,
  };
}

async function requireListing(listingId: string) {
  if (!z.uuid().safeParse(listingId).success) throw new NotFoundError("Listing");
  const [l] = await getDb().select().from(schema.listings).where(eq(schema.listings.id, listingId)).limit(1);
  if (!l) throw new NotFoundError("Listing");
  return l;
}

/** Corrects a listing's public terms (e.g. a misleading earning estimate). */
export async function adminEditListing(actor: AdminActor, listingId: string, input: unknown) {
  const l = await requireListing(listingId);
  const d = adminListingEditSchema.parse(input);
  const changes = { niche: d.niche, priceCents: d.price, earningMinCents: d.earningMin, earningMaxCents: d.earningMax };
  await getDb().update(schema.listings).set(changes).where(eq(schema.listings.id, l.id));
  const before = { niche: l.niche, priceCents: l.priceCents, earningMinCents: l.earningMinCents, earningMaxCents: l.earningMaxCents };
  await audit({ listingId: l.id, actorId: actor.id, actorRole: "admin", action: "listing_edited", data: { before, after: changes, note: d.note } });
  await logAdmin(actor, "marketplace.listing_edited", "listing", l.id, { before, after: changes, note: d.note });
}

/** Puts an unpublished listing back live without another review round. */
export async function adminRepublish(actor: AdminActor, listingId: string) {
  await setListingStatus(listingId, ["unpublished"], "published", { id: actor.id, role: "admin" }, { publishedAt: new Date(), reviewedBy: actor.id });
  await logAdmin(actor, "marketplace.listing_republished", "listing", listingId);
}

/** Deletes a listing. Refused once any money moved (deal records must stay). */
export async function adminDeleteListing(actor: AdminActor, listingId: string, reason: string) {
  const l = await requireListing(listingId);
  if (reason.trim().length < 3) throw new UserFacingError("Give a short reason (it's kept in the audit log).");
  const [paid] = await getDb().select({ n: count() }).from(schema.deals).where(inArray(schema.deals.listingId, [l.id]));
  const [money] = await getDb()
    .select({ n: count() })
    .from(schema.marketplacePayments)
    .innerJoin(schema.deals, eq(schema.deals.id, schema.marketplacePayments.dealId))
    .where(eq(schema.deals.listingId, l.id));
  if (money.n > 0) throw new UserFacingError("Payments exist for this listing, so it can't be deleted. Unpublish it instead.");
  await getDb().delete(schema.listings).where(eq(schema.listings.id, l.id));
  await logAdmin(actor, "marketplace.listing_deleted", "listing", l.id, { title: l.title, niche: l.niche, seller: l.sellerId, deals: paid.n, reason: reason.trim() });
}

/** Admin stops a deal: cancels before payment, refunds the buyer after. */
export async function adminStopDeal(actor: AdminActor, dealId: string, reason: string) {
  if (!z.uuid().safeParse(dealId).success) throw new NotFoundError("Deal");
  if (reason.trim().length < 3) throw new UserFacingError("Give a short reason (it's kept in the audit log).");
  const [deal] = await getDb().select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) throw new NotFoundError("Deal");
  const who = { id: actor.id, role: "admin" as const };
  if (deal.state === "DRAFT_OFFER" || deal.state === "ACCEPTED") await transition(deal.id, "CANCELLED", who, { data: { reason } });
  else if (deal.state === "PAYMENT_HELD" || deal.state === "TRANSFER_IN_PROGRESS") await refundDeal(deal.id, who, `Stopped by admin: ${reason}`);
  else throw new UserFacingError(deal.state === "DISPUTED" ? "This deal is disputed. Resolve it from the dispute queue." : "This deal is already finished and can't be stopped.");
  await logAdmin(actor, "marketplace.deal_stopped", "deal", deal.id, { from: deal.state, reason });
}
