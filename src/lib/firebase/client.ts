"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";
import { missingPublicFirebaseVars, publicAuthEmulatorHost, publicFirebaseConfig } from "@/lib/env.client";

let authInstance: Auth | null = null;

/**
 * Browser Firebase Auth. Used only to sign in and obtain an ID token; the
 * server then issues an httpOnly session cookie. Persistence is in-memory so
 * no long-lived Firebase credentials sit in browser storage.
 */
export async function getClientAuth(): Promise<Auth> {
  const missing = missingPublicFirebaseVars();
  if (missing.length) throw new Error(`Firebase is not configured. Missing: ${missing.join(", ")}`);
  if (authInstance) return authInstance;
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(publicFirebaseConfig);
  const auth = getAuth(app);
  if (publicAuthEmulatorHost) {
    connectAuthEmulator(auth, `http://${publicAuthEmulatorHost}`, { disableWarnings: true });
  }
  await setPersistence(auth, inMemoryPersistence);
  authInstance = auth;
  return auth;
}
