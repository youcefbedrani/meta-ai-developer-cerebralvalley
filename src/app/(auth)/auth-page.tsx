import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { getIntegrationStatus } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPlatformSettings } from "@/server/platform/settings";

export async function AuthPage({
  mode,
  searchParams,
}: {
  mode: "signin" | "signup";
  searchParams: Promise<{ next?: string }>;
}) {
  // Configuration is checked per request, not frozen into a static page at build time.
  await connection();
  const firebase = getIntegrationStatus("firebase");
  if (firebase.configured && (await getCurrentUser())) {
    redirect(safeNextPath((await searchParams).next));
  }
  const { signups } = await getPlatformSettings();
  const signupNotice =
    signups.mode === "open" ? null : signups.message.trim() || (signups.mode === "closed" ? "Sign-ups are closed right now. Existing accounts can still sign in." : "Startum is invite-only right now. Only invited emails can create an account.");
  return (
    <Suspense>
      <AuthScreen initialMode={mode} missingConfig={firebase.missing} signupNotice={signupNotice} />
    </Suspense>
  );
}
