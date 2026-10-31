import "server-only";
import { asc, eq, sql } from "drizzle-orm";
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
 *
 * One person, one account: Firebase can give the same person a second uid (Google one day, email + password
 * the next, or a project that allows several accounts per email). When an unknown uid arrives with a
 * *verified* email that already has an account, that account is moved to the new uid instead of creating an
 * empty one, so the founder's projects never "disappear" after signing in a different way.
 */
export async function upsertUserFromVerifiedIdentity(identity: {
  firebaseUid: string;
  email: string;
  emailVerified?: boolean;
  name?: string | null;
}): Promise<AppUser> {
  const db = getDb();
  const [known] = await db.select(columns).from(schema.users).where(eq(schema.users.firebaseUid, identity.firebaseUid)).limit(1);
  if (known) {
    if (known.email !== identity.email) await db.update(schema.users).set({ email: identity.email }).where(eq(schema.users.id, known.id));
    return toAppUser({ ...known, email: identity.email });
  }
  if (identity.emailVerified) {
    const existing = await findUserByEmail(identity.email);
    if (existing) {
      const [row] = await db.update(schema.users).set({ firebaseUid: identity.firebaseUid, email: identity.email }).where(eq(schema.users.id, existing.id)).returning(columns);
      if (row) return toAppUser(row);
    }
  }
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

/** The oldest account with this email (case-insensitive): the one that holds the founder's work. */
export async function findUserByEmail(email: string): Promise<{ id: string; suspendedAt: Date | null; suspendedReason: string | null } | null> {
  const [row] = await getDb()
    .select({ id: schema.users.id, suspendedAt: schema.users.suspendedAt, suspendedReason: schema.users.suspendedReason })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = lower(${email})`)
    .orderBy(asc(schema.users.createdAt))
    .limit(1);
  return row ?? null;
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

/**
 * Repairs an account that was already split in two: when the signed-in Firebase uid points at an account with
 * no projects while an older account with the same (verified) email has some, the uid moves to the older
 * account. The empty account is kept, with its uid renamed, so nothing is deleted. Runs at sign-in.
 */
export async function reconcileSplitAccount(firebaseUid: string, email: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.users.id, firebaseUid: schema.users.firebaseUid, projects: sql<number>`(select count(*)::int from projects p where p.user_id = "users"."id")` })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = lower(${email})`)
    .orderBy(asc(schema.users.createdAt));
  const current = rows.find((r) => r.firebaseUid === firebaseUid);
  const keeper = rows.find((r) => r.projects > 0);
  if (!current || !keeper || current.id === keeper.id || current.projects > 0) return false;
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ firebaseUid: `merged:${current.id}` }).where(eq(schema.users.id, current.id));
    await tx.update(schema.users).set({ firebaseUid }).where(eq(schema.users.id, keeper.id));
  });
  return true;
}
