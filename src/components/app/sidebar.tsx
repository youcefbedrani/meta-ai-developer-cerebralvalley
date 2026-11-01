"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HackathonLockup } from "@/components/brand/hackathon-lockup";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BRAND } from "@/lib/brand";
import { LOCALE_INFO, t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { groupedNavItems, isActive, type NavFeatures } from "./nav";
import { SearchButton, ShellControls, type TopBarProps } from "./top-bar";
import { UserMenu, type ShellUser } from "./user-menu";

function NavLinks({
  onNavigate,
  features,
  locale,
}: {
  onNavigate?: () => void;
  features: NavFeatures;
  locale: Locale;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={features.admin ? "Admin console" : "Main"} className="flex flex-col gap-3">
      {groupedNavItems(features).map((group) => (
        <div key={group.key} className="flex flex-col gap-0.5">
          {group.label ? (
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
              {t(locale, group.label)}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                  active && "bg-sidebar-accent text-foreground",
                )}
              >
                {active ? (
                  <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-brand-gradient" />
                ) : null}
                <item.icon className={cn("size-4 transition-transform duration-200 group-hover:scale-110", active && "text-primary")} />
                <span className="flex-1">{t(locale, item.label)}</span>
                {item.soon ? (
                  <span className="rounded-full border border-border px-1.5 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t(locale, "Soon")}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Brand({ admin = false }: { admin?: boolean }) {
  return (
    <Link
      href={admin ? "/app/admin" : "/app"}
      className="flex items-center gap-2.5 px-2"
      aria-label={`${BRAND.name} home`}
    >
      {admin ? <Wordmark className="text-[22px] text-foreground" /> : <HackathonLockup className="text-[18px] text-foreground sm:text-[20px]" />}
      {admin ? (
        <span className="rounded-full bg-[var(--plum)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
          Admin
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({
  user,
  features,
  locale,
}: {
  user: ShellUser;
  features: NavFeatures;
  locale: Locale;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar p-3 lg:flex">
      <div className="py-3">
        <Brand admin={features.admin} />
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        <NavLinks features={features} locale={locale} />
      </div>
      <UserMenu user={user} admin={features.admin} />
    </aside>
  );
}

export function MobileTopbar({
  user,
  ...prefs
}: {
  user: ShellUser;
} & TopBarProps) {
  const [open, setOpen] = useState(false);
  const { features, locale } = prefs;
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-1 border-b border-border bg-background/80 px-2 backdrop-blur sm:px-3 lg:hidden" data-no-translate>
      <div className="min-w-0 shrink overflow-hidden">
        <Brand admin={features.admin} />
      </div>
      <div className="ms-auto flex shrink-0 items-center">
        <SearchButton locale={locale} features={features} />
        <ShellControls {...prefs} />
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" aria-label={t(locale, "Open navigation")} />
          }
        >
          <Menu />
        </SheetTrigger>
        <SheetContent side={LOCALE_INFO[locale].dir === "rtl" ? "right" : "left"} className="flex w-72 flex-col bg-sidebar p-3">
          <SheetTitle className="px-2 py-3">
            <Brand admin={features.admin} />
          </SheetTitle>
          <div className="mt-2 flex-1">
            <NavLinks features={features} locale={locale} onNavigate={() => setOpen(false)} />
          </div>
          <UserMenu user={user} admin={features.admin} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
