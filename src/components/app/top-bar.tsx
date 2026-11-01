"use client";

import { Bell, Check, CircleAlert, CornerDownLeft, FileSearch, Factory, FolderKanban, Languages, Lightbulb, Loader2, Moon, Search, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { markNotificationsSeenAction, searchAction, setLocaleAction, setThemeAction } from "@/app/(app)/app/shell-actions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LOCALE_INFO, LOCALES, t, type Locale, type Theme } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SearchHit, ShellNotification } from "@/server/services/shell";
import { visibleNavItems, type NavFeatures } from "./nav";

export type TopBarProps = { locale: Locale; theme: Theme; features: NavFeatures; notifications: ShellNotification[]; seenAt: string | null; lowCredits: boolean };

/** Keeps <html> in step with the user's theme and language (dialogs and toasts render outside the app shell). */
function useDocumentPrefs(locale: Locale, theme: Theme) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", theme === "dark");
    html.lang = locale;
    html.dir = LOCALE_INFO[locale].dir;
    return () => {
      // Leaving the app (landing page, sign-in): back to the defaults.
      html.classList.remove("dark");
      html.lang = "en";
      html.dir = "ltr";
    };
  }, [locale, theme]);
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const iconBtn = "relative grid size-8 shrink-0 place-items-center sm:size-9 rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

export function TopBar(props: TopBarProps) {
  useDocumentPrefs(props.locale, props.theme);
  return (
    <div className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-border bg-background/80 px-8 backdrop-blur lg:flex" data-no-translate>
      <SearchBox locale={props.locale} features={props.features} />
      <div className="ms-auto flex items-center gap-1">
        <ShellControls {...props} />
      </div>
    </div>
  );
}

/** Notifications, language and theme: in the desktop top bar and the mobile header. */
export function ShellControls({ locale, theme, notifications, seenAt, lowCredits }: TopBarProps) {
  return (
    <>
      <Notifications locale={locale} items={notifications} seenAt={seenAt} lowCredits={lowCredits} />
      <LanguageMenu locale={locale} />
      <ThemeToggle locale={locale} theme={theme} />
    </>
  );
}

function SearchBox({ locale, features }: { locale: Locale; features: NavFeatures }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-9 w-full max-w-md items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40">
        <Search className="size-4" />
        <span className="flex-1 text-start">{t(locale, "Search…")}</span>
        <kbd className="rounded border border-border bg-muted px-1.5 text-[10px] font-medium">Ctrl K</kbd>
      </button>
      <SearchDialog open={open} onOpenChange={setOpen} locale={locale} features={features} />
    </>
  );
}

export function SearchButton({ locale, features }: { locale: Locale; features: NavFeatures }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={iconBtn} aria-label={t(locale, "Search…")}>
        <Search className="size-4" />
      </button>
      <SearchDialog open={open} onOpenChange={setOpen} locale={locale} features={features} />
    </>
  );
}

const HIT_ICON = { project: FolderKanban, idea: Lightbulb, scan: Factory } as const;

function SearchDialog({ open, onOpenChange, locale, features }: { open: boolean; onOpenChange: (o: boolean) => void; locale: Locale; features: NavFeatures }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const pages = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return visibleNavItems(features)
      .map((i) => ({ ...i, label: t(locale, i.label) }))
      .filter((i) => !needle || i.label.toLowerCase().includes(needle) || i.href.includes(needle))
      .slice(0, needle ? 6 : 8);
  }, [q, features, locale]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const id = setTimeout(
      () =>
        start(async () => {
          const r = await searchAction(q);
          setHits(r.ok ? r.data : []);
        }),
      200,
    );
    return () => clearTimeout(id);
  }, [q]);

  const results = [...pages.map((p) => ({ key: p.href, href: p.href, title: p.label, detail: "", icon: p.icon, group: t(locale, "Pages") })), ...(q.trim().length < 2 ? [] : hits).map((h) => ({ key: `${h.kind}-${h.id}`, href: h.href, title: h.title, detail: h.detail, icon: HIT_ICON[h.kind], group: t(locale, h.kind === "project" ? "Projects" : h.kind === "idea" ? "Ideas" : "Scans") }))];
  const go = (href: string) => {
    onOpenChange(false);
    setQ("");
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">{t(locale, "Search…")}</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) go(results[active].href);
            }}
            placeholder={t(locale, "Search pages, projects, ideas…")}
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
          {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        </div>
        <ul className="max-h-[60vh] overflow-y-auto p-2" role="listbox">
          {results.length ? (
            results.map((r, i) => (
              <li key={r.key}>
                {i === 0 || results[i - 1].group !== r.group ? <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{r.group}</p> : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.href)}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start text-sm", i === active ? "bg-accent text-foreground" : "text-muted-foreground")}
                >
                  <r.icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground">{r.title}</span>
                    {r.detail ? <span className="block truncate text-xs">{r.detail}</span> : null}
                  </span>
                  {i === active ? <CornerDownLeft className="size-3.5" /> : null}
                </button>
              </li>
            ))
          ) : (
            <li className="flex items-center justify-center gap-2 px-2 py-8 text-sm text-muted-foreground"><FileSearch className="size-4" /> {t(locale, "No results")}</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

const timeFmt = (iso: string, locale: Locale) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (mins < 60) return rtf.format(-mins, "minute");
  if (mins < 60 * 24) return rtf.format(-Math.round(mins / 60), "hour");
  return rtf.format(-Math.round(mins / 1440), "day");
};

function Notifications({ locale, items, seenAt, lowCredits }: { locale: Locale; items: ShellNotification[]; seenAt: string | null; lowCredits: boolean }) {
  const router = useRouter();
  const { open, setOpen, ref } = usePopover();
  const [seen, setSeen] = useState(seenAt);
  // Relative times depend on the clock: computed after mount so server and browser render the same HTML.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const unread = items.filter((n) => !seen || n.at > seen).length + (lowCredits ? 1 : 0);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      setSeen(new Date().toISOString());
      void markNotificationsSeenAction();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggle} className={iconBtn} aria-label={t(locale, "Notifications")} aria-expanded={open}>
        <Bell className="size-4" />
        {unread ? <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-[var(--coral)] px-1 text-[10px] font-semibold leading-4 text-white">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="absolute end-0 top-11 z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          <p className="border-b border-border px-4 py-3 text-sm font-medium">{t(locale, "Notifications")}</p>
          <ul className="max-h-96 overflow-y-auto">
            {lowCredits ? (
              <li>
                <Link href="/app/settings#billing" onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 text-sm hover:bg-accent">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <span>{t(locale, "Running low on credits")}</span>
                </Link>
              </li>
            ) : null}
            {items.map((n) => {
              const isNew = !seenAt || n.at > seenAt;
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => (setOpen(false), router.push(n.href))} className="flex w-full gap-3 px-4 py-3 text-start text-sm hover:bg-accent">
                    {n.failed ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" /> : <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{t(locale, n.title)}</span>
                        {isNew ? <span className="size-1.5 rounded-full bg-[var(--coral)]" /> : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {n.failed ? t(locale, "Credits refunded") : n.detail}
                        {mounted ? ` · ${timeFmt(n.at, locale)}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!items.length && !lowCredits ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                <Bell className="mx-auto mb-2 size-5" />
                <p className="font-medium text-foreground">{t(locale, "No notifications yet")}</p>
                <p className="mt-1 text-xs">{t(locale, "When research, designs, videos or scans finish, they show up here.")}</p>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function LanguageMenu({ locale }: { locale: Locale }) {
  const router = useRouter();
  const { open, setOpen, ref } = usePopover();
  const [pending, start] = useTransition();
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className={cn(iconBtn, "flex items-center gap-1.5 text-xs font-medium uppercase sm:w-auto sm:px-2.5")} aria-label={t(locale, "Language")} aria-expanded={open}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />} <span className="max-sm:hidden">{locale}</span>
      </button>
      {open ? (
        <ul className="absolute end-0 top-11 z-50 w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl" role="menu">
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={l === locale}
                onClick={() =>
                  start(async () => {
                    setOpen(false);
                    if (l === locale) return;
                    const r = await setLocaleAction(l);
                    if (!r.ok) return void toast.error(r.error);
                    router.refresh();
                  })
                }
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent"
              >
                <span lang={l}>{LOCALE_INFO[l].label}</span>
                {l === locale ? <Check className="size-4 text-primary" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ThemeToggle({ locale, theme }: { locale: Locale; theme: Theme }) {
  const router = useRouter();
  const [current, setCurrent] = useState(theme);
  const next: Theme = current === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className={iconBtn}
      aria-label={t(locale, next === "dark" ? "Dark mode" : "Light mode")}
      title={t(locale, next === "dark" ? "Dark mode" : "Light mode")}
      onClick={() => {
        setCurrent(next);
        document.documentElement.classList.toggle("dark", next === "dark");
        void setThemeAction(next).then(() => router.refresh());
      }}
    >
      {current === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
