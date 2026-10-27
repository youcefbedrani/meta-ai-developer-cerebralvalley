/**
 * A user id that came from a verified session (or a test fixture).
 *
 * Every data-access function requires a `UserId`, never a plain string, so a
 * value read from a request body or URL cannot be passed in by accident.
 * Only `getCurrentUser()` (src/server/auth/current-user.ts) and tests may call
 * `unsafeToUserId`.
 */
export type UserId = string & { readonly __brand: "VerifiedUserId" };

export function unsafeToUserId(id: string): UserId {
  return id as UserId;
}
