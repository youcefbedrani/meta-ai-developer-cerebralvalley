"use client";

import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { t, type Locale } from "@/lib/i18n";

/*
 * Translates the page text the shell dictionary doesn't cover, like a built-in translator: it reads the text nodes
 * (and placeholders) inside [data-translate-root], asks /api/i18n for the ones it doesn't know (Muse Spark, cached in
 * Redis for everyone and in localStorage for this browser) and swaps them in place. React keeps owning the nodes:
 * when it changes a text, the new English text is picked up and translated again.
 * Skipped: long text (AI results are already written in the user's language), code, inputs, and [data-no-translate].
 */

const MAX_LEN = 400;
const BATCH = 30;
/** Batches in flight at once: a long page translates in a couple of seconds. */
const PARALLEL = 3;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "SVG", "KBD", "NOSCRIPT"]);
const original = new WeakMap<Node, string>();
const applied = new WeakMap<Node, string>();
const originalPlaceholder = new WeakMap<Element, string>();
/** After the first page load has hydrated, translations can start immediately on every later navigation. */
let hydrated = false;

function storageKey(locale: Locale) {
  return `startum_i18n_v1_${locale}`;
}

function loadCache(locale: Locale): Map<string, string> {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(storageKey(locale)) ?? "{}") as Record<string, string>));
  } catch {
    return new Map();
  }
}

function saveCache(locale: Locale, cache: Map<string, string>) {
  try {
    // Keep the most recent entries if the browser's storage gets tight.
    const entries = [...cache.entries()].slice(-4_000);
    localStorage.setItem(storageKey(locale), JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* storage full or blocked: the server cache still works */
  }
}

/** Worth translating: has English letters, isn't a number, a URL or an email. */
function translatable(text: string): boolean {
  const s = text.trim();
  return s.length >= 2 && s.length <= MAX_LEN && /[A-Za-z]{2}/.test(s) && !/^(https?:\/\/|www\.)\S+$/.test(s) && !/^\S+@\S+\.\S+$/.test(s);
}

function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName.toUpperCase()) || e.hasAttribute("data-no-translate") || e.getAttribute("translate") === "no" || (e as HTMLElement).isContentEditable) return true;
  }
  return false;
}

/** The English source of a text node: what React last wrote (if it changed since we translated it) or what we saved. */
function sourceOf(node: Text): string | null {
  const now = node.nodeValue ?? "";
  if (applied.has(node) && applied.get(node) === now) return original.get(node) ?? null;
  original.set(node, now);
  applied.delete(node);
  return now;
}

function collect(root: Element): { nodes: Text[]; placeholders: Element[] } {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n as Text;
    if (!skipped(text.parentElement)) nodes.push(text);
  }
  const placeholders = [...root.querySelectorAll("[placeholder]")].filter((el) => !skipped(el.parentElement) && !el.closest("[data-no-translate]"));
  return { nodes, placeholders };
}

function withSpaces(src: string, translated: string) {
  const lead = src.match(/^\s*/)?.[0] ?? "";
  const trail = src.match(/\s*$/)?.[0] ?? "";
  return `${lead}${translated}${trail}`;
}

export function PageTranslator({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const cache = useRef<Map<string, string>>(new Map());
  const inflight = useRef<Set<string>>(new Set());
  // The apply of the effect run that is current: a fetch started by an earlier run (cancelled by a re-render or
  // a navigation) still lands in the shared cache and gets applied by the run that is on screen now.
  const applyLatest = useRef<(() => string[]) | null>(null);

  useEffect(() => {
    const root = document.querySelector("[data-translate-root]");
    if (!root) return;

    if (locale === "en") {
      // Switched back to English: put the original text back.
      const { nodes, placeholders } = collect(root);
      for (const n of nodes) if (applied.get(n) === n.nodeValue && original.has(n)) n.nodeValue = original.get(n)!;
      for (const el of placeholders) if (originalPlaceholder.has(el)) el.setAttribute("placeholder", originalPlaceholder.get(el)!);
      return;
    }

    cache.current = loadCache(locale);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const apply = () => {
      const { nodes, placeholders } = collect(root);
      const missing = new Set<string>();
      for (const n of nodes) {
        const src = sourceOf(n);
        if (!src || !translatable(src)) continue;
        const key = src.trim();
        const hit = cache.current.get(key);
        if (hit !== undefined) {
          const next = withSpaces(src, hit);
          if (n.nodeValue !== next) n.nodeValue = next;
          applied.set(n, next);
        } else if (!inflight.current.has(key)) missing.add(key);
      }
      for (const el of placeholders) {
        const current = el.getAttribute("placeholder") ?? "";
        const src = originalPlaceholder.has(el) && cache.current.get(originalPlaceholder.get(el)!) === current ? originalPlaceholder.get(el)! : current;
        originalPlaceholder.set(el, src);
        if (!translatable(src)) continue;
        const hit = cache.current.get(src.trim());
        if (hit !== undefined) {
          if (current !== hit) el.setAttribute("placeholder", hit);
        } else if (!inflight.current.has(src.trim())) missing.add(src.trim());
      }
      return [...missing];
    };

    applyLatest.current = apply;

    const fetchMissing = async (missing: string[]) => {
      if (!missing.length) return;
      missing.forEach((s) => inflight.current.add(s));
      setBusy(true);
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < missing.length; i += BATCH) chunks.push(missing.slice(i, i + BATCH));
        const worker = async () => {
          for (let chunk = chunks.shift(); chunk; chunk = chunks.shift()) {
            const res = await fetch("/api/i18n", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale, strings: chunk }) }).catch(() => null);
            const body = (await res?.json().catch(() => ({}))) as { translations?: Record<string, string> } | undefined;
            for (const [en, tr] of Object.entries(body?.translations ?? {})) cache.current.set(en, tr);
            // Strings the server couldn't translate keep their English text (and aren't asked for again on this page).
            for (const s of chunk) if (!cache.current.has(s)) cache.current.set(s, s);
            applyLatest.current?.();
          }
        };
        await Promise.all(Array.from({ length: PARALLEL }, worker));
        saveCache(locale, cache.current);
      } finally {
        missing.forEach((s) => inflight.current.delete(s));
        setBusy(inflight.current.size > 0);
      }
    };

    const run = () => void fetchMissing(apply());
    const observer = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 150);
    });
    const begin = () => {
      hydrated = true;
      run();
      observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder"] });
    };
    // On a fresh page load, parts of the page stream in and hydrate after this layout: changing their text before React
    // has hydrated them causes a mismatch. Start once the page has loaded and React is idle; later navigations are
    // rendered on the client, so they can start right away.
    let started: ReturnType<typeof setTimeout> | null = null;
    const startSoon = () => (started = setTimeout(begin, hydrated ? 0 : 400));
    if (document.readyState === "complete") startSoon();
    else window.addEventListener("load", startSoon, { once: true });
    return () => {
      window.removeEventListener("load", startSoon);
      if (started) clearTimeout(started);
      if (applyLatest.current === apply) applyLatest.current = null;
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [locale, pathname]);

  if (!busy || locale === "en") return null;
  return (
    <div data-no-translate className="pointer-events-none fixed bottom-4 start-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-lg">
      <Languages className="size-3.5 animate-pulse text-primary" /> {t(locale, "Translating this page with Muse Spark…")}
    </div>
  );
}
