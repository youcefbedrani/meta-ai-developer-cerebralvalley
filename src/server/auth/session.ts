import "server-only";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { signupDecision } from "@/lib/platform-settings";
import { findUserByFirebaseUid } from "@/server/data/users";
import { adminEmails } from "@/server/marketplace/config";
import { getPlatformSettings } from "@/server/platform/settings";
import { getAdminAuth } from "./firebase-admin";

export const SESSION_COOKIE = "__session";
/** Firebase allows session cookies between 5 minutes and 14 days. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;
/** Only mint a session from a recent sign-in, so a stolen old ID token is useless. */
const MAX_SIGN_IN_AGE_SECONDS = 5 * 60;

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}

/**
 * Exchanges a Firebase ID token for an httpOnly session cookie.
 * `remember: false` sets a browser-session cookie (cleared when the browser closes);
 * the Firebase session itself still expires after SESSION_MAX_AGE_SECONDS.
 */
export async function createSession(idToken: string, { remember = true }: { remember?: boolean } = {}): Promise<void> {
  const auth = getAdminAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    throw new SessionError("Invalid or expired sign-in token");
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - decoded.auth_time > MAX_SIGN_IN_AGE_SECONDS) {
    throw new SessionError("Sign-in is too old. Please sign in again.");
  }
  if (!decoded.email) {
    throw new SessionError("Your account has no email address.");
  }
  await checkAccountAllowed(decoded.uid, decoded.email);
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_SECONDS * 1000 });
  (await cookies()).set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: SESSION_MAX_AGE_SECONDS } : {}),
  });
}

/**
 * Admin console gates, checked before any session is issued:
 * - a suspended account can't sign in;
 * - a brand-new account (no local user yet) must pass the sign-up mode (open / invite-only / closed).
 *   A refused new account is deleted from Firebase, so the person can sign up later once allowed.
 * Emails in ADMIN_EMAILS are never locked out.
 */
async function checkAccountAllowed(firebaseUid: string, email: string): Promise<void> {
  const existing = await findUserByFirebaseUid(firebaseUid);
  if (existing?.suspendedAt) {
    throw new SessionError(existing.suspendedReason ? `This account is suspended: ${existing.suspendedReason}` : "This account is suspended. Contact support if you think this is a mistake.");
  }
  if (existing || adminEmails().includes(email.toLowerCase())) return;
  const decision = signupDecision((await getPlatformSettings()).signups, email);
  if (decision.allowed) return;
  try {
    await getAdminAuth().deleteUser(firebaseUid);
  } catch {
    // Already gone, or Firebase unreachable: refusing the session is what matters.
  }
  throw new SessionError(decision.reason);
}

/** Clears the cookie and revokes refresh tokens so other sessions end too. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (!value) return;
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifySessionCookie(value);
    await auth.revokeRefreshTokens(decoded.sub);
  } catch {
    // Cookie already invalid or Firebase unconfigured: clearing it is enough.
  }
}

/** Rejects cross-site requests to state-changing auth endpoints. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set([new URL(getEnv().APP_URL).origin, new URL(request.url).origin]);
  return allowed.has(origin);
}
