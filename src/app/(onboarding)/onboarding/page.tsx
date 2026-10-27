import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { isAdmin } from "@/server/marketplace/config";
import { getProfile } from "@/server/data/profiles";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const user = await requireUser();
  // Platform admins don't have a founder profile; they go straight to the admin console.
  if (isAdmin(user)) redirect("/app/admin");
  const existing = await getProfile(user.id);
  return (
    <div className="ambient-glow min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Logo href="/app" />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-4 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          {existing ? "Update your founder profile" : <>Let&apos;s tailor ideas to <span className="text-gradient">you</span></>}
        </h1>
        <p className="mt-2 text-muted-foreground">
          These answers shape idea suggestions and plans. You can change them any time in Settings.
        </p>
        <div className="mt-8">
          <OnboardingForm defaultValues={existing ?? undefined} redirectTo={existing ? "/app/settings" : "/app/guide?welcome=1"} />
        </div>
      </main>
    </div>
  );
}
