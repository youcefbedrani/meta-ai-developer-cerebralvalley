"use client";

import { useEffect, useState } from "react";
import { WAITLIST_CONSENT_TEXT } from "@/lib/marketplace/terms";

/** UTM tags from the page URL, used to attribute visits and signups to channels, campaigns and ad variants. */
function utmFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const get = (k: string) => q.get(`utm_${k}`) ?? undefined;
  return { source: get("source"), utm: { medium: get("medium"), campaign: get("campaign"), content: get("content"), term: get("term") } };
}

export function VisitPing({ slug }: { slug: string }) {
  useEffect(() => {
    const { source, utm } = utmFromUrl();
    void fetch(`/api/p/${encodeURIComponent(slug)}/visit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source, utm }) }).catch(() => {});
  }, [slug]);
  return null;
}

export function WaitlistForm({ slug, ctaLabel }: { slug: string; ctaLabel: string }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const res = await fetch(`/api/p/${encodeURIComponent(slug)}/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, website, consentTransfer: consent, ...utmFromUrl() }),
    }).catch(() => null);
    if (res?.ok) return setState("done");
    const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    setMessage(body?.error ?? "Something went wrong. Please try again.");
    setState("error");
  }

  if (state === "done") {
    return <p className="rounded-xl bg-[#18b26b14] px-4 py-3 text-sm font-medium text-[#0f7a49]">You&apos;re on the list. We&apos;ll email you when it&apos;s ready.</p>;
  }
  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="wl-email" className="sr-only">Email</label>
        <input id="wl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-12 w-full rounded-xl border sm:flex-1 border-[var(--lp-line,rgb(65_23_94/0.15))] bg-[var(--lp-surface,#fff)] px-4 text-[15px] text-[var(--lp-text,#2a1440)] outline-none focus:border-[var(--lp-secondary,#c9a8f3)] focus:ring-4 focus:ring-[var(--lp-secondary,#c762f6)]/20" />
        {/* Honeypot: hidden from people, tempting for bots */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden="true" />
        <button disabled={state === "busy"} className="h-12 rounded-xl bg-[var(--lp-primary,#41175e)] px-5 text-[15px] font-medium text-[var(--lp-on-primary,#fff)] shadow-[0_10px_24px_-10px_rgba(0,0,0,.45)] transition hover:-translate-y-0.5 disabled:opacity-60">
          {state === "busy" ? "Joining…" : ctaLabel}
        </button>
      </div>
      <label className="mt-3 flex items-start justify-center gap-2 text-left text-xs text-[var(--lp-text,#2a1440)]/60">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-3.5 accent-[var(--lp-primary,#41175e)]" />
        <span>{WAITLIST_CONSENT_TEXT} (optional)</span>
      </label>
      {state === "error" ? <p role="alert" className="mt-2 text-sm text-[#b03b3b]">{message}</p> : null}
      <p className="mt-3 text-xs text-[var(--lp-text,#2a1440)]/55">We&apos;ll only use your email to tell you about this product. No spam.</p>
    </form>
  );
}
