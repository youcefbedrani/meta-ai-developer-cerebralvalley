import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getIntegrationEnv, requireIntegration } from "@/lib/env";

const APP_NAME = "server";

/**
 * Returns the firebase-admin Auth instance.
 * Throws ConfigError (rendered by the UI) when credentials are missing.
 * With FIREBASE_AUTH_EMULATOR_HOST set, firebase-admin talks to the local
 * emulator and no service-account key is required.
 */
export function getAdminAuth(): Auth {
  requireIntegration("firebase");
  const env = getIntegrationEnv();
  const existing = getApps().find((a) => a.name === APP_NAME);
  const app: App =
    existing ??
    initializeApp(
      env.FIREBASE_AUTH_EMULATOR_HOST
        ? { projectId: env.FIREBASE_ADMIN_PROJECT_ID }
        : {
            projectId: env.FIREBASE_ADMIN_PROJECT_ID,
            credential: cert({
              projectId: env.FIREBASE_ADMIN_PROJECT_ID,
              clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
              privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            }),
          },
      APP_NAME,
    );
  return getAuth(app);
}
