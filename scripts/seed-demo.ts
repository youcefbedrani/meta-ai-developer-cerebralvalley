/**
 * Creates (or resets) the local demo accounts in the Firebase Auth emulator:
 *   seed/demo-account.json   admin (its email is in ADMIN_EMAILS)
 *   seed/client-account.json regular client
 * Fixed uids keep each account linked to the same local user (and its data) after an emulator restart.
 * Refuses to run against real Firebase.
 *   pnpm seed:demo
 */
import { existsSync, readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
if (!emulator || !projectId) {
  console.error("Refusing to run: FIREBASE_AUTH_EMULATOR_HOST and FIREBASE_ADMIN_PROJECT_ID must be set (emulator only).");
  process.exit(1);
}

type Account = { uid?: string; name: string; email: string; password: string };
const files = ["seed/demo-account.json", "seed/client-account.json"].filter((f) => existsSync(f));
const auth = getAuth(initializeApp({ projectId }));

async function upsert(file: string) {
  const a = JSON.parse(readFileSync(file, "utf8")) as Account;
  const existing = await auth.getUserByEmail(a.email).catch(() => null);
  // A fixed uid must match: recreate an account that was made with a random one.
  if (existing && a.uid && existing.uid !== a.uid) await auth.deleteUser(existing.uid);
  if (existing && (!a.uid || existing.uid === a.uid)) {
    await auth.updateUser(existing.uid, { password: a.password, displayName: a.name });
    console.log(`Account reset: ${a.email}`);
  } else {
    await auth.createUser({ uid: a.uid, email: a.email, password: a.password, displayName: a.name, emailVerified: true });
    console.log(`Account created: ${a.email}`);
  }
  console.log(`Password: see ${file}`);
}

async function main() {
  for (const f of files) await upsert(f);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
