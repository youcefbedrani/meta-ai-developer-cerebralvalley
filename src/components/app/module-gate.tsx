import { PowerOff } from "lucide-react";
import Link from "next/link";
import type { ModuleKey } from "@/lib/platform-settings";
import { moduleStatus } from "@/server/platform/guard";

/** Wraps a module's pages: shows a notice instead while an admin has turned the module off. */
export async function ModuleGate({ module, children }: { module: ModuleKey; children: React.ReactNode }) {
  const { blocked, adminPreview, label } = await moduleStatus(module);
  if (blocked) {
    return (
      <div className="surface mx-auto mt-10 max-w-lg p-8 text-center">
        <PowerOff className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold">{label} is turned off right now</h1>
        <p className="mt-2 text-sm text-muted-foreground">The Startum team has paused this part of the platform. Your data is safe and will be here when it&apos;s back.</p>
        <Link href="/app" className="mt-5 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">Back to dashboard</Link>
      </div>
    );
  }
  return (
    <>
      {adminPreview ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {label} is <strong>off for users</strong>. You can see it because you&apos;re an admin. <Link href="/app/admin/settings" className="underline">Change in settings</Link>
        </p>
      ) : null}
      {children}
    </>
  );
}
