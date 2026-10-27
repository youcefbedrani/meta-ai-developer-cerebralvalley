import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db/client";
import { unsafeToUserId, type UserId } from "./user-id";

export type AppUser = {
  id: UserId;
  email: string;
  name: string | null;
  plan: "free" | "founder" | "studio";
  role: "user" | "admin";
  marketplaceBannedAt: Date | null;
  suspendedAt: Date | null;
  onboardedAt: Date | null;
  welcomeSeenAt: Date | null;
};

const columns = {
  id: schema.users.id,
  email: schema.users.email,
  name: schema.users.name,
  plan: schema.users.plan,
  role: schema.users.role,
  marketplaceBannedAt: schema.users.marketplaceBannedAt,
  suspendedAt: schema.users.suspendedAt,
  onboardedAt: schema.users.onboardedAt,
  welcomeSeenAt: schema.users.welcomeSeenAt,
};

const toAppUser = (row: Omit<AppUser, "id"> & { id: string }): AppUser => ({
  ...row,
  id: unsafeToUserId(row.id),
});

/**
 * Finds or creates the local user for a *verified* Firebase identity.
 * Must only be called with claims from firebase-admin verification.
 */
export async function upsertUserFromVerifiedIdentity(identity: {
  firebaseUid: string;
  email: string;
  name?: string | null;
}): Promise<AppUser> {
  const db = getDb();
  const [row] = await db
    .insert(schema.users)
    .values({ firebaseUid: identity.firebaseUid, email: identity.email, name: identity.name ?? null })
    .onConflictDoUpdate({
      target: schema.users.firebaseUid,
      set: { email: identity.email },
    })
    .returning(columns);
  return toAppUser(row);
}

/** Sign-in gate: does a local account exist for this Firebase identity, and is it suspended? */
export async function findUserByFirebaseUid(firebaseUid: string): Promise<{ id: string; suspendedAt: Date | null; suspendedReason: string | null } | null> {
  const [row] = await getDb()
    .select({ id: schema.users.id, suspendedAt: schema.users.suspendedAt, suspendedReason: schema.users.suspendedReason })
    .from(schema.users)
    .where(eq(schema.users.firebaseUid, firebaseUid))
    .limit(1);
  return row ?? null;
}

export async function getUserById(userId: UserId): Promise<AppUser | null> {
  const [row] = await getDb().select(columns).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return row ? toAppUser(row) : null;
}

export async function updateUserName(userId: UserId, name: string): Promise<void> {
  await getDb().update(schema.users).set({ name }).where(eq(schema.users.id, userId));
}

/** Records that the founder closed the one-time welcome popup. */
export async function markWelcomeSeen(userId: UserId): Promise<void> {
  await getDb().update(schema.users).set({ welcomeSeenAt: new Date() }).where(eq(schema.users.id, userId));
}
