"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { toActionError, type ActionResult } from "@/server/action-result";
import { UserFacingError } from "@/server/data/errors";
import { logAdmin, type AdminActor } from "@/server/admin/audit";
import { adminDeleteListing, adminEditListing, adminRepublish, adminStopDeal } from "@/server/admin/marketplace";
import { adminCancelJob, adminRetryJob, adminSetProjectStatus } from "@/server/admin/platform";
import { adminAdjustCredits, adminDeleteUser, adminMarketplaceBan, adminSetPlan, adminSuspend } from "@/server/admin/users";
import { isAdmin } from "@/server/marketplace/config";
import { getPlatformSettings, savePlatformSettings } from "@/server/platform/settings";

/** Every admin action: re-checks the admin role on the server, then revalidates the console. */
async function admin<T>(fn: (actor: AdminActor) => Promise<T>): Promise<ActionResult<T>> {
  const user = await requireOnboardedUser();
  try {
    if (!isAdmin(user)) throw new UserFacingError("Admins only.");
    const data = await fn({ id: user.id, email: user.email });
    revalidatePath("/app", "layout");
    return { ok: true, data };
  } catch (err) {
    return toActionError(err);
  }
}

/* Users */
export const setPlanAction = async (userId: string, plan: string) => admin((a) => adminSetPlan(a, userId, plan));
export const adjustCreditsAction = async (userId: string, delta: number, reason: string) => admin((a) => adminAdjustCredits(a, userId, { delta, reason }));
export const suspendUserAction = async (userId: string, suspend: boolean, reason?: string) => admin((a) => adminSuspend(a, userId, suspend, reason));
export const marketplaceBanAction = async (userId: string, banned: boolean) => admin((a) => adminMarketplaceBan(a, userId, banned));
export const deleteUserAction = async (userId: string, confirmEmail: string) => admin((a) => adminDeleteUser(a, userId, confirmEmail));

/* Projects & jobs */
export const setProjectStatusAction = async (projectId: string, status: string) => admin((a) => adminSetProjectStatus(a, projectId, status));
export const cancelJobAction = async (jobId: string) => admin((a) => adminCancelJob(a, jobId));
export const retryJobAction = async (jobId: string) => admin((a) => adminRetryJob(a, jobId));

/* Marketplace */
export const editListingAction = async (listingId: string, input: unknown) => admin((a) => adminEditListing(a, listingId, input));
export const republishListingAction = async (listingId: string) => admin((a) => adminRepublish(a, listingId));
export const deleteListingAction = async (listingId: string, reason: string) => admin((a) => adminDeleteListing(a, listingId, reason));
export const stopDealAction = async (dealId: string, reason: string) => admin((a) => adminStopDeal(a, dealId, reason));

/* Platform settings (sign-ups, modules, maintenance, credits, marketplace) */
export const saveSettingsAction = async (input: unknown) =>
  admin(async (a) => {
    const before = await getPlatformSettings();
    const saved = await savePlatformSettings(a.id, input);
    const changed = (Object.keys(saved) as (keyof typeof saved)[]).filter((k) => JSON.stringify(saved[k]) !== JSON.stringify(before[k]));
    await logAdmin(a, "settings.updated", "settings", null, { changed, after: Object.fromEntries(changed.map((k) => [k, saved[k]])) });
    return { changed };
  });
