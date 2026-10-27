import "server-only";
import { eq } from "drizzle-orm";
import { getIntegrationStatus, ConfigError } from "@/lib/env";
import { findPersonalData } from "@/lib/marketplace/pii";
import { DUPLICATE_THRESHOLD, textEmbedding } from "@/lib/marketplace/similarity";
import { levelAtLeast, publicMetrics } from "@/lib/marketplace/validation-level";
import { CREDIT_COSTS } from "@/lib/plans";
import { ASSET_LABELS, submitListingSchema, teaserSchema, type Teaser } from "@/lib/validation/marketplace";
import { buildTeaserPrompt, mockTeaser, TEASER_SYSTEM } from "@/server/ai/prompts/marketplace";
import { callStructured, withCredits } from "@/server/ai/run";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError, UserFacingError } from "@/server/data/errors";
import { audit, findSimilarListing, requireOwnListing, setListingStatus } from "@/server/data/marketplace";
import type { UserId } from "@/server/data/user-id";
import { getUserById } from "@/server/data/users";
import { enforceAiLimits } from "@/server/rate-limit";
import { getPlatformSettings } from "@/server/platform/settings";
import { getProjectContext } from "@/server/services/project-context";
import { getProjectValidation } from "./stats";

/** AI draft of the public teaser. Built from project data, with no secrets or personal data. */
export async function draftTeaser(userId: UserId, listingId: string): Promise<Teaser> {
  const ai = getIntegrationStatus("ai");
  if (!ai.configured) throw new ConfigError("ai", ai.missing);
  const listing = await requireOwnListing(userId, listingId);
  if (!listing.projectId) throw new UserFacingError("AI drafting is for project listings. Idea listings use the idea's own write-up.");
  await enforceAiLimits(userId);
  const [{ project, context }, validation] = await Promise.all([getProjectContext(userId, listing.projectId), getProjectValidation(listing.projectId)]);
  return withCredits(userId, "marketplace_teaser", CREDIT_COSTS.marketplace_teaser, () =>
    callStructured({
      userId,
      projectId: project.id,
      operation: "marketplace_teaser",
      tier: "smart",
      schema: teaserSchema,
      system: TEASER_SYSTEM,
      prompt: buildTeaserPrompt({ project: context, metrics: publicMetrics(validation.stats), level: validation.level, licenseType: listing.licenseType, assets: listing.assets.map((a) => ASSET_LABELS[a.kind]) }),
      maxOutputTokens: 3_000,
      mock: () => mockTeaser(project.name),
    }),
  );
}

export type ReadinessCheck = { id: string; label: string; ok: boolean; detail?: string };

/** Everything that must pass before a listing can go to review. */
export async function checkReadiness(userId: UserId, listingId: string, teaserInput: unknown, confirmations: { ownershipConfirmed?: boolean; originalWorkDeclared?: boolean }) {
  const listing = await requireOwnListing(userId, listingId);
  const isIdea = listing.kind === "idea";
  if (isIdea ? !listing.ideaId : !listing.projectId) throw new NotFoundError(isIdea ? "Idea" : "Project");
  const user = await getUserById(userId);
  const teaser = teaserSchema.safeParse(teaserInput);
  // The niche and earning note are public or semi-public: check them for personal data too.
  const text = [teaser.success ? Object.values(teaser.data).flat().join("\n") : "", listing.niche, listing.earningBasis].join("\n");
  const pii = findPersonalData(text, { names: user?.name ? [user.name] : [], emails: user ? [user.email] : [] });
  const validation = isIdea ? { level: "none" as const, stats: null } : await getProjectValidation(listing.projectId!);
  const checks: ReadinessCheck[] = [
    { id: "teaser", label: "Details for buyers are complete", ok: teaser.success, detail: teaser.success ? undefined : "Fill in every field." },
    { id: "pii", label: "No personal data in the niche, earning note or details", ok: pii.length === 0, detail: pii.length ? `Remove: ${pii.map((p) => p.match).join(", ")}` : undefined },
    { id: "public", label: "Niche and earning estimate are set", ok: listing.niche.trim().length >= 3 && (listing.earningMaxCents ?? 0) > 0 },
    ...(isIdea
      ? []
      : [{ id: "level", label: "Project has at least a researched validation level", ok: levelAtLeast(validation.level, "researched"), detail: levelAtLeast(validation.level, "researched") ? undefined : "Complete a research report with sources first." }]),
    { id: "ownership", label: "You confirm you own what you're selling", ok: confirmations.ownershipConfirmed === true },
    { id: "original", label: "You declare this is your original work", ok: confirmations.originalWorkDeclared === true },
  ];
  return { checks, ready: checks.every((c) => c.ok), validation, teaser: teaser.success ? teaser.data : null };
}

/**
 * Runs readiness checks, computes the level from tracked data and flags near-duplicates. In "auto" review mode a
 * listing that passes everything goes live at once; near-duplicates (and every listing in "manual" mode) wait for an admin.
 */
export async function submitListing(userId: UserId, listingId: string, input: unknown) {
  const d = submitListingSchema.parse(input);
  const listing = await requireOwnListing(userId, listingId);
  if (listing.status !== "draft" && listing.status !== "rejected" && listing.status !== "unpublished") throw new UserFacingError("Only drafts can be submitted for review.");
  const { checks, ready, validation } = await checkReadiness(userId, listingId, d.teaser, d);
  if (!ready) throw new UserFacingError(`Not ready yet: ${checks.filter((c) => !c.ok).map((c) => c.detail ?? c.label).join(" ")}`);

  const [report] = listing.projectId ? await getDb().select({ content: schema.reports.content }).from(schema.reports).where(eq(schema.reports.projectId, listing.projectId)).limit(1) : [];
  const embedding = textEmbedding(`${listing.niche} ${Object.values(d.teaser).flat().join(" ")} ${report ? JSON.stringify(report.content).slice(0, 4000) : ""}`);
  const similar = await findSimilarListing(listingId, embedding);
  const flagged = similar && similar.score >= DUPLICATE_THRESHOLD ? similar : null;

  const autoPublish = (await getPlatformSettings()).marketplace.reviewMode === "auto" && !flagged;
  await setListingStatus(listingId, ["draft", "rejected", "unpublished"], autoPublish ? "published" : "pending_review", { id: userId, role: "seller" }, {
    ...(autoPublish ? { publishedAt: new Date() } : {}),
    title: d.teaser.title,
    teaser: d.teaser,
    validationLevel: validation.level,
    metrics: validation.stats ? { public: publicMetrics(validation.stats), stats: validation.stats, computedAt: new Date().toISOString() } : {},
    ownershipConfirmed: true,
    originalWorkDeclared: true,
    embedding,
    similarity: flagged,
    reviewNote: null,
  });
  return { similarity: flagged, published: autoPublish };
}

export async function unpublishOwnListing(userId: UserId, listingId: string) {
  await requireOwnListing(userId, listingId);
  await setListingStatus(listingId, ["published", "pending_review"], "unpublished", { id: userId, role: "seller" });
}

/* ------------------------------------------------------------------ Admin */

export async function reviewListing(adminId: UserId, listingId: string, approve: boolean, note: string) {
  if (approve) await setListingStatus(listingId, ["pending_review"], "published", { id: adminId, role: "admin" }, { publishedAt: new Date(), reviewedBy: adminId, reviewNote: note || null });
  else await setListingStatus(listingId, ["pending_review"], "rejected", { id: adminId, role: "admin" }, { reviewedBy: adminId, reviewNote: note || "Rejected by review." });
}

export async function adminUnpublish(adminId: UserId, listingId: string, note: string) {
  await setListingStatus(listingId, ["published", "pending_review"], "unpublished", { id: adminId, role: "admin" }, { reviewedBy: adminId, reviewNote: note || "Unpublished by an admin." });
}

export async function setMarketplaceBan(adminId: UserId, userId: string, banned: boolean) {
  await getDb().update(schema.users).set({ marketplaceBannedAt: banned ? new Date() : null }).where(eq(schema.users.id, userId));
  if (banned) {
    // A banned seller's live listings come down too.
    const live = await getDb().select({ id: schema.listings.id, status: schema.listings.status }).from(schema.listings).where(eq(schema.listings.sellerId, userId));
    for (const l of live.filter((x) => x.status === "published" || x.status === "pending_review")) await adminUnpublish(adminId, l.id, "Seller suspended.");
  }
  await audit({ actorId: adminId, actorRole: "admin", action: banned ? "user_banned" : "user_unbanned", data: { userId } });
}
