"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export type ShellUser = { email: string; name: string | null; plan: string };

export function UserMenu({ user, admin = false }: { user: ShellUser; admin?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();

  async function signOut() {
    setBusy(true);
    const res = await fetch("/api/auth/session", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not sign out. Please try again.");
      setBusy(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-sidebar-border bg-card/60 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name || (admin ? "Admin" : "Founder")}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="rounded-full border border-border px-2 py-0.5 capitalize text-muted-foreground">{admin ? "Platform team" : `${user.plan} plan`}</span>
        <div className="flex items-center gap-1">
          <Link href={admin ? "/app/admin/settings" : "/app/settings"} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Settings">
            <Settings className="size-4" />
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
