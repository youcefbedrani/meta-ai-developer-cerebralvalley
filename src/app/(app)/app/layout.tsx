import { Coins, Megaphone, Wrench } from "lucide-react";
import Link from "next/link";
import { MockModeBanner } from "@/components/app/mock-banner";
import { MobileTopbar, Sidebar } from "@/components/app/sidebar";
import { HelpWidget } from "@/components/help/help-widget";
import { CREDIT_COSTS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { isAdmin } from "@/server/marketplace/config";
import { moduleAccess } from "@/server/platform/guard";
import { getPlatformSettings } from "@/server/platform/settings";

/** Below this the user can no longer run research, so we suggest upgrading before they hit the wall. */
const LOW_CREDITS = CREDIT_COSTS.research_job;

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireOnboardedUser();
  const [settings, balance] = await Promise.all([getPlatformSettings(), getBalance(user.id)]);
  const admin = isAdmin(user);
  const shellUser = { email: user.email, name: user.name, plan: user.plan };
  const features = { admin, modules: moduleAccess(settings, user) };
  const { maintenance, announcement } = settings;

  if (maintenance.enabled && !admin) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="surface max-w-md p-8 text-center">
          <Wrench className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Startum is down for maintenance</h1>
          <p className="mt-2 text-sm text-muted-foreground">{maintenance.message || "We're making improvements and will be back shortly. Your data is safe."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={shellUser} features={features} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MockModeBanner />
        {maintenance.enabled ? <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">Maintenance mode is on: users see a maintenance page. Only admins can use the app.</p> : null}
        {announcement.enabled && announcement.message ? (
          <p role="status" className={cn("flex items-center justify-center gap-2 border-b px-4 py-2 text-center text-sm", announcement.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-violet-200 bg-violet-50 text-violet-900")}>
            <Megaphone className="size-4 shrink-0" /> {announcement.message}
          </p>
        ) : null}
        {!admin && balance < LOW_CREDITS ? (
          <p role="status" className="animate-slide-down flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-violet-200 bg-violet-50 px-4 py-2 text-center text-sm text-violet-900">
            <Coins className="size-4 shrink-0" />
            {balance === 0 ? "You're out of AI credits for this month." : `Only ${balance} AI credit${balance === 1 ? "" : "s"} left this month.`}
            <Link href="/app/settings#billing" className="font-medium underline underline-offset-2">
              {user.plan === "free" ? "Upgrade or buy a credit pack" : "Buy a credit pack"}
            </Link>
          </p>
        ) : null}
        <MobileTopbar user={shellUser} features={features} />
        <div className="relative flex-1">
          {/* Thin vertical rails from the landing page, behind the content only */}
          <div className="rails-bg pointer-events-none absolute inset-x-0 top-0 h-80" aria-hidden="true" />
          <main className="relative mx-auto w-full max-w-6xl px-4 pb-28 pt-8 sm:px-8 lg:pt-10">{children}</main>
        </div>
      </div>
      {!admin && features.modules.help ? <HelpWidget cost={CREDIT_COSTS.help_question} /> : null}
    </div>
  );
}
