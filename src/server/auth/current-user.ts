import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ConfigError } from "@/lib/env";
import { upsertUserFromVerifiedIdentity, type AppUser } from "@/server/data/users";
import { isAdmin } from "@/server/marketplace/config";
import { getAdminAuth } from "./firebase-admin";
import { SESSION_COOKIE } from "./session";

/**
 * Data-access entry point for authentication.
 * Verifies the httpOnly session cookie with firebase-admin (including
 * revocation) and maps it to our local user. Memoised per request.
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  let decoded;
  try {
    decoded = await getAdminAuth().verifySessionCookie(value, true);
  } catch (err) {
    if (err instanceof ConfigError) throw err;
    return null;
  }
  if (!decoded.email) return null;
  const user = await upsertUserFromVerifiedIdentity({
    firebaseUid: decoded.uid,
    email: decoded.email,
    emailVerified: decoded.email_verified === true,
    name: typeof decoded.name === "string" ? decoded.name : null,
  });
  // Suspended by an admin: treated as signed out everywhere.
  return user.suspendedAt ? null : user;
});

/** For pages, layouts and server actions that need a signed-in user. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Like requireUser, but also sends users who haven't finished onboarding there first.
 * Platform admins have no founder profile, so they skip onboarding. Which pages they may open is
 * decided by layouts: founder tools live under app/(founder), whose layout sends admins to /app/admin.
 */
export async function requireOnboardedUser(): Promise<AppUser> {
  const user = await requireUser();
  if (!user.onboardedAt && !isAdmin(user)) redirect("/onboarding");
  return user;
}

/** For founder-only pages: platform admins only use the admin console, so they are sent there. */
export async function requireFounder(): Promise<AppUser> {
  const user = await requireOnboardedUser();
  if (isAdmin(user)) redirect("/app/admin");
  return user;
}
