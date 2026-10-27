import { inkOn, logoMarkSvg, LOGO_SHAPES, LOGO_SYMBOLS, suggestSymbol, type LogoSymbol } from "@/lib/brand-kit";
import type { DesignContext } from "@/lib/design-prompt";

/*
 * Built-in designer: turns a project's own data (idea, MVP plan, Brand Kit, customer quotes) into a
 * polished, self-contained HTML screen with no API key and no network calls (only Google Fonts).
 * Pure and unit-tested. Every piece of text is escaped; colours and fonts come from validated values.
 * Screen types are picked from the screen name: landing, sign-up, dashboard/home, onboarding,
 * pricing, settings, or a feature screen built from the feature's acceptance criteria.
 */

export type BuiltinOptions = { dark?: boolean; accent?: string; sidebar?: boolean; variant?: number; compact?: boolean };
export type ScreenKind = "landing" | "auth" | "dashboard" | "onboarding" | "pricing" | "settings" | "feature";

const DEFAULT_PALETTE = { primary: "#4F46E5", secondary: "#0EA5E9", accent: "#F59E0B", background: "#FFFFFF", text: "#111827" };
const DEFAULT_FONTS = { heading: "Plus Jakarta Sans", body: "Inter" };
const HEX = /^#[0-9a-fA-F]{6}$/;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const cut = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").replace(/\[Mock\]\s*/g, "").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
const safeFont = (f: string) => f.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 40) || "Inter";

export function screenKind(name: string): ScreenKind {
  const n = name.toLowerCase();
  if (/landing|marketing|homepage|home page|website/.test(n)) return "landing";
  if (/sign ?up|sign ?in|log ?in|register|auth|account creation/.test(n)) return "auth";
  if (/welcome|onboard|intro|get started/.test(n)) return "onboarding";
  if (/pricing|plans?\b|billing|checkout|upgrade/.test(n)) return "pricing";
  if (/setting|profile|preferences/.test(n)) return "settings";
  if (/dashboard|^home$|overview|main screen|home\b/.test(n)) return "dashboard";
  return "feature";
}

/** Reads simple edit requests ("make it dark", "use green", "add a sidebar") into options. Anything else gives a new variant. */
export function parseEditInstruction(instruction: string, prev: BuiltinOptions = {}): BuiltinOptions {
  const t = instruction.toLowerCase();
  const next: BuiltinOptions = { ...prev, variant: (prev.variant ?? 0) + 1 };
  if (/\b(dark|night|black background)\b/.test(t)) next.dark = true;
  if (/\b(light|white background|bright)\b/.test(t)) next.dark = false;
  if (/sidebar|side nav|side menu/.test(t)) next.sidebar = !/remove|no sidebar|without/.test(t);
  if (/compact|denser|tighter|smaller/.test(t)) next.compact = true;
  if (/spacious|more space|bigger|larger|airy/.test(t)) next.compact = false;
  const colours: Record<string, string> = { red: "#DC2626", orange: "#EA580C", amber: "#D97706", yellow: "#CA8A04", green: "#16A34A", emerald: "#059669", teal: "#0D9488", cyan: "#0891B2", blue: "#2563EB", indigo: "#4F46E5", violet: "#7C3AED", purple: "#9333EA", pink: "#DB2777", rose: "#E11D48", black: "#111111" };
  const hex = t.match(/#[0-9a-f]{6}\b/)?.[0];
  const word = Object.keys(colours).find((c) => new RegExp(`\\b${c}\\b`).test(t));
  if (hex) next.accent = hex.toUpperCase();
  else if (word && !/background/.test(t)) next.accent = colours[word];
  return next;
}

type Theme = { p: string; s: string; a: string; bg: string; tx: string; muted: string; surface: string; line: string; onP: string; hf: string; bf: string; dark: boolean };

function theme(ctx: DesignContext, o: BuiltinOptions): Theme {
  const pal = ctx.brand?.palette ?? DEFAULT_PALETTE;
  const fonts = ctx.brand?.fonts ?? DEFAULT_FONTS;
  const p = o.accent && HEX.test(o.accent) ? o.accent : HEX.test(pal.primary) ? pal.primary : DEFAULT_PALETTE.primary;
  const dark = !!o.dark;
  const bg = dark ? "#0B0D14" : HEX.test(pal.background) ? pal.background : "#FFFFFF";
  const tx = dark ? "#F3F4F8" : HEX.test(pal.text) ? pal.text : "#111827";
  return {
    p,
    s: HEX.test(pal.secondary) ? pal.secondary : DEFAULT_PALETTE.secondary,
    a: HEX.test(pal.accent) ? pal.accent : DEFAULT_PALETTE.accent,
    bg,
    tx,
    muted: dark ? "rgba(243,244,248,.62)" : "rgba(17,24,39,.6)",
    surface: dark ? "#141824" : "#FFFFFF",
    line: dark ? "rgba(255,255,255,.1)" : "rgba(17,24,39,.09)",
    onP: inkOn(p),
    hf: safeFont(fonts.heading),
    bf: safeFont(fonts.body),
    dark,
  };
}

function initials(name: string) {
  const w = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0]?.[0] ?? "A")).toUpperCase();
}

function logo(ctx: DesignContext, t: Theme, size = 32) {
  const l = ctx.brand?.logo;
  const shape = (LOGO_SHAPES as readonly string[]).includes(l?.shape ?? "") ? (l!.shape as (typeof LOGO_SHAPES)[number]) : "rounded";
  const symbol = (LOGO_SYMBOLS as readonly string[]).includes(l?.symbol ?? "") ? (l!.symbol as LogoSymbol) : l ? undefined : suggestSymbol(`${ctx.name} ${ctx.description}`);
  const svg = logoMarkSvg({ logo: { shape, initials: (l?.initials ?? initials(ctx.name)).slice(0, 2), symbol }, palette: { primary: t.p, secondary: t.s, accent: t.a, background: t.bg, text: t.tx }, fonts: { heading: t.hf, body: t.bf } }, size);
  return `<span class="logo">${svg}<b>${esc(cut(ctx.name, 24))}</b></span>`;
}

function copy(ctx: DesignContext) {
  const features = ctx.features.length
    ? ctx.features.slice(0, 6).map((f) => ({ title: cut(f.feature, 48), body: cut(f.why, 120), criteria: (f.acceptanceCriteria ?? []).map((c) => cut(c, 90)).slice(0, 5) }))
    : [
        { title: "Set up in minutes", body: `Get started with ${cut(ctx.name, 24)} without a long setup or training.`, criteria: [] },
        { title: "Automate the busywork", body: "Let the repetitive steps run on their own.", criteria: [] },
        { title: "See what matters", body: "One clear view of where things stand and what to do next.", criteria: [] },
      ];
  // A short first sentence of the summary reads better as a headline than a cut-off paragraph.
  const sentence = cut(ctx.summary, 400).split(/(?<=[.!?])\s/)[0]?.replace(/[.!]$/, "") ?? "";
  const headline = cut(ctx.brand?.tagline, 80) || (sentence.length >= 12 && sentence.length <= 80 ? sentence : "") || `${cut(ctx.name, 24)}, made simple`;
  return {
    headline,
    sub: cut(ctx.summary || ctx.description, 190),
    audience: cut(ctx.targetUser, 80) || "teams like yours",
    problem: cut(ctx.problem, 160),
    features,
    quotes: ctx.customerWords.map((q) => cut(q, 150)).slice(0, 3),
    different: ctx.differentiation.map((d) => cut(d, 140)).slice(0, 3),
  };
}

const icon = (i: number) =>
  [
    '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>',
    '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    '<path d="M4 5h16v11H8l-4 4z"/>',
    '<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
  ][i % 6];
const svgIcon = (i: number) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon(i)}</svg>`;

function css(t: Theme, mobile: boolean, o: BuiltinOptions) {
  const gap = o.compact ? 0.75 : 1;
  return `*{box-sizing:border-box;margin:0;padding:0}
:root{--p:${t.p};--s:${t.s};--a:${t.a};--bg:${t.bg};--tx:${t.tx};--mu:${t.muted};--sf:${t.surface};--ln:${t.line};--onp:${t.onP}}
body{background:var(--bg);color:var(--tx);font:15px/1.55 "${t.bf}",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
h1,h2,h3,.logo b{font-family:"${t.hf}","${t.bf}",system-ui,sans-serif;letter-spacing:-.02em;line-height:1.1}
a{color:inherit;text-decoration:none}
.wrap{max-width:${mobile ? "390px" : "1180px"};margin:0 auto;padding:0 ${mobile ? 20 : 32}px}
.logo{display:inline-flex;align-items:center;gap:10px}.logo svg{width:32px;height:32px;flex:none}.logo b{font-size:18px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:${mobile ? 50 : 46}px;padding:0 22px;border-radius:12px;font-weight:600;border:1px solid transparent;cursor:pointer;font-size:15px;white-space:nowrap}
.btn-p{background:var(--p);color:var(--onp);box-shadow:0 10px 24px -12px var(--p)}
.btn-o{background:var(--sf);border-color:var(--ln);color:var(--tx)}
.card{background:var(--sf);border:1px solid var(--ln);border-radius:18px;padding:${22 * gap}px}
.muted{color:var(--mu)}.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;padding:6px 12px;border-radius:99px;background:color-mix(in srgb,var(--p) 12%,transparent);color:var(--p)}
.ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--p) 13%,transparent);color:var(--p)}
.grid{display:grid;gap:${18 * gap}px}
input,select{width:100%;height:48px;border-radius:12px;border:1px solid var(--ln);background:var(--sf);color:var(--tx);padding:0 14px;font:inherit}
label{display:block;font-size:13px;font-weight:600;margin:0 0 6px}
.pill{display:inline-block;font-size:12px;font-weight:600;padding:3px 10px;border-radius:99px}
.ok{background:color-mix(in srgb,#16a34a 14%,transparent);color:#15803d}.warn{background:color-mix(in srgb,var(--a) 18%,transparent);color:color-mix(in srgb,var(--a) 70%,var(--tx))}
.bar{height:8px;border-radius:99px;background:var(--ln);overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--p),var(--s))}`;
}

function doc(title: string, t: Theme, mobile: boolean, o: BuiltinOptions, body: string) {
  const fonts = [...new Set([t.hf, t.bf])].map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700;800`).join("&");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<!--builtin:${JSON.stringify(o).replace(/-->/g, "")}-->
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<style>${css(t, mobile, o)}</style></head><body>${body}</body></html>`;
}

/* --------------------------------- screens -------------------------------- */

function landing(ctx: DesignContext, t: Theme, m: boolean) {
  const c = copy(ctx);
  const mock = `<div class="card" style="padding:0;overflow:hidden;box-shadow:0 40px 80px -40px rgba(0,0,0,.35)">
<div style="display:flex;gap:6px;padding:12px 14px;border-bottom:1px solid var(--ln)"><i style="width:10px;height:10px;border-radius:50%;background:#f87171"></i><i style="width:10px;height:10px;border-radius:50%;background:#fbbf24"></i><i style="width:10px;height:10px;border-radius:50%;background:#34d399"></i></div>
<div style="padding:18px" class="grid">${c.features
    .slice(0, 3)
    .map((f, i) => `<div style="display:flex;align-items:center;gap:12px"><span class="ico">${svgIcon(i)}</span><div style="flex:1"><b style="font-size:14px">${esc(f.title)}</b><div class="bar" style="margin-top:8px"><i style="width:${[82, 64, 45][i]}%"></i></div></div><span class="pill ok">${["Done", "Live", "Next"][i]}</span></div>`)
    .join("")}</div></div>`;
  return `<header class="wrap" style="display:flex;justify-content:space-between;align-items:center;padding-top:22px;padding-bottom:22px">${logo(ctx, t)}${m ? `<a class="btn btn-p" style="height:40px;padding:0 16px">Join</a>` : `<nav style="display:flex;gap:28px;align-items:center" class="muted"><a>Features</a><a>How it works</a><a>Pricing</a><a class="btn btn-p" style="height:40px">Get early access</a></nav>`}</header>
<section class="wrap" style="display:grid;${m ? "" : "grid-template-columns:1.05fr 1fr;"}gap:${m ? 32 : 56}px;align-items:center;padding-top:${m ? 24 : 56}px;padding-bottom:${m ? 40 : 88}px">
<div><span class="eyebrow">● For ${esc(c.audience)}</span><h1 style="font-size:${m ? 36 : 58}px;margin:18px 0">${esc(c.headline)}</h1><p class="muted" style="font-size:${m ? 16 : 19}px;max-width:540px">${esc(c.sub)}</p>
<div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap"><a class="btn btn-p">Get early access →</a><a class="btn btn-o">See how it works</a></div></div>${mock}</section>
${c.problem ? `<section style="background:color-mix(in srgb,var(--p) 6%,var(--bg));padding:${m ? 44 : 72}px 0"><div class="wrap" style="max-width:${m ? "390px" : "820px"};text-align:center"><p class="eyebrow">The problem</p><h2 style="font-size:${m ? 26 : 36}px;margin-top:14px">${esc(c.problem)}</h2>${c.quotes.length ? `<div class="grid" style="margin-top:28px;${m ? "" : `grid-template-columns:repeat(${Math.min(3, c.quotes.length)},1fr);`}text-align:left">${c.quotes.map((q) => `<div class="card"><p style="font-size:14px">“${esc(q)}”</p><p class="muted" style="font-size:12px;margin-top:10px">Said online about the problem today</p></div>`).join("")}</div>` : ""}</div></section>` : ""}
<section class="wrap" style="padding-top:${m ? 44 : 80}px;padding-bottom:${m ? 44 : 80}px"><h2 style="font-size:${m ? 26 : 38}px;text-align:center">Everything you need, nothing you don't</h2>
<div class="grid" style="margin-top:36px;${m ? "" : "grid-template-columns:repeat(3,1fr);"}">${c.features.map((f, i) => `<div class="card"><span class="ico">${svgIcon(i)}</span><h3 style="font-size:18px;margin:16px 0 8px">${esc(f.title)}</h3><p class="muted" style="font-size:14px">${esc(f.body)}</p></div>`).join("")}</div></section>
${c.different.length ? `<section class="wrap" style="padding-bottom:${m ? 44 : 80}px"><div class="card" style="display:grid;${m ? "" : "grid-template-columns:1fr 1.4fr;"}gap:28px;align-items:center;background:linear-gradient(135deg,color-mix(in srgb,var(--p) 10%,var(--sf)),var(--sf))"><h2 style="font-size:${m ? 24 : 32}px">Why ${esc(cut(ctx.name, 24))} is different</h2><ul style="list-style:none" class="grid">${c.different.map((d) => `<li style="display:flex;gap:10px"><span style="color:var(--p)">✓</span><span>${esc(d)}</span></li>`).join("")}</ul></div></section>` : ""}
<section style="padding:${m ? 48 : 80}px 0;background:var(--p);color:var(--onp);text-align:center"><div class="wrap"><h2 style="font-size:${m ? 28 : 40}px">Be first to try ${esc(cut(ctx.name, 24))}</h2><p style="opacity:.85;margin-top:10px">Join the early-access list. No spam, just a note when it's ready.</p>
<div style="display:flex;gap:10px;max-width:460px;margin:26px auto 0;${m ? "flex-direction:column" : ""}"><input placeholder="you@company.com" style="background:rgba(255,255,255,.95);color:#111;border:0"><a class="btn" style="background:var(--onp);color:var(--p)">Join the waitlist</a></div></div></section>
<footer class="wrap muted" style="display:flex;justify-content:space-between;padding-top:26px;padding-bottom:26px;font-size:13px"><span>© ${esc(cut(ctx.name, 24))}</span><span>Privacy · Terms</span></footer>`;
}

function auth(ctx: DesignContext, t: Theme, m: boolean, name: string) {
  const c = copy(ctx);
  const login = /sign ?in|log ?in/i.test(name) && !/sign ?up/i.test(name);
  const form = `<div style="width:100%;max-width:400px">${m ? `<div style="margin-bottom:28px">${logo(ctx, t)}</div>` : ""}<h1 style="font-size:${m ? 28 : 32}px">${login ? "Welcome back" : `Create your ${esc(cut(ctx.name, 24))} account`}</h1><p class="muted" style="margin-top:8px">${login ? "Sign in to pick up where you left off." : "Free to start. Takes less than a minute."}</p>
<a class="btn btn-o" style="width:100%;margin-top:26px"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Continue with Google</a>
<div style="display:flex;align-items:center;gap:12px;margin:22px 0" class="muted"><i style="flex:1;height:1px;background:var(--ln)"></i><span style="font-size:13px">or with email</span><i style="flex:1;height:1px;background:var(--ln)"></i></div>
<div class="grid" style="gap:14px">${login ? "" : `<div><label>Full name</label><input placeholder="Alex Morgan"></div>`}<div><label>Work email</label><input placeholder="alex@company.com"></div><div><label>Password</label><input type="password" value="password123"></div></div>
<a class="btn btn-p" style="width:100%;margin-top:22px">${login ? "Sign in" : "Create account"}</a><p class="muted" style="text-align:center;font-size:13px;margin-top:16px">${login ? "New here? <b style='color:var(--p)'>Create an account</b>" : "Already have an account? <b style='color:var(--p)'>Sign in</b>"}</p></div>`;
  if (m) return `<main class="wrap" style="padding-top:48px;padding-bottom:40px">${form}</main>`;
  return `<main style="display:grid;grid-template-columns:1fr 1fr;min-height:100vh">
<aside style="background:linear-gradient(150deg,var(--p),color-mix(in srgb,var(--p) 55%,var(--s)));color:var(--onp);padding:44px;display:flex;flex-direction:column;justify-content:space-between">${logo(ctx, { ...t, p: t.onP, s: t.onP, tx: t.onP })}
<div><h2 style="font-size:40px;max-width:460px">${esc(c.headline)}</h2><ul style="list-style:none;margin-top:28px" class="grid">${c.features.slice(0, 3).map((f) => `<li style="display:flex;gap:12px;align-items:center"><span style="width:26px;height:26px;border-radius:8px;background:rgba(255,255,255,.18);display:grid;place-items:center">✓</span>${esc(f.title)}</li>`).join("")}</ul></div>
<p style="opacity:.75;font-size:13px">Built for ${esc(c.audience)}</p></aside>
<section style="display:grid;place-items:center;padding:40px">${form}</section></main>`;
}

function shell(ctx: DesignContext, t: Theme, m: boolean, o: BuiltinOptions, active: string, content: string) {
  const c = copy(ctx);
  const nav = ["Overview", ...c.features.slice(0, 4).map((f) => cut(f.title, 22)), "Settings"];
  if (m) {
    return `<div style="min-height:100vh;padding-bottom:84px"><header class="wrap" style="display:flex;justify-content:space-between;align-items:center;padding-top:18px;padding-bottom:12px">${logo(ctx, t)}<span style="width:36px;height:36px;border-radius:50%;background:color-mix(in srgb,var(--p) 18%,var(--sf));display:grid;place-items:center;font-weight:700;color:var(--p)">AM</span></header>
<main class="wrap">${content}</main>
<nav style="position:fixed;bottom:0;left:0;right:0;max-width:390px;margin:0 auto;background:var(--sf);border-top:1px solid var(--ln);display:flex;justify-content:space-around;padding:10px 0 22px">${["Home", "Tasks", "Insights", "Profile"].map((n, i) => `<span style="display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;font-weight:600;color:${i === 0 ? "var(--p)" : "var(--mu)"}">${svgIcon(i + 1)}${n}</span>`).join("")}</nav></div>`;
  }
  const side = o.sidebar !== false;
  return `<div style="display:${side ? "grid" : "block"};grid-template-columns:248px 1fr;min-height:100vh">
${side ? `<aside style="border-right:1px solid var(--ln);padding:22px 16px;background:var(--sf)">${logo(ctx, t)}<nav style="margin-top:28px" class="grid">${nav.map((n, i) => `<a style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;font-weight:${n === active ? 600 : 500};${n === active ? "background:color-mix(in srgb,var(--p) 12%,transparent);color:var(--p)" : "color:var(--mu)"}">${svgIcon(i)}${esc(n)}</a>`).join("")}</nav></aside>` : ""}
<div><header style="display:flex;justify-content:space-between;align-items:center;padding:18px 32px;border-bottom:1px solid var(--ln)">${side ? `<input placeholder="Search…" style="max-width:340px;height:40px">` : logo(ctx, t)}<div style="display:flex;gap:12px;align-items:center"><a class="btn btn-p" style="height:40px">+ New</a><span style="width:38px;height:38px;border-radius:50%;background:color-mix(in srgb,var(--p) 18%,var(--sf));display:grid;place-items:center;font-weight:700;color:var(--p)">AM</span></div></header>
<main style="padding:28px 32px">${content}</main></div></div>`;
}

function dashboard(ctx: DesignContext, t: Theme, m: boolean, o: BuiltinOptions) {
  const c = copy(ctx);
  const kpis = [["Active", "128", "+12%"], ["Time saved", "14h", "this week"], ["Completed", "86%", "+5 pts"], ["Open items", "7", "2 due today"]];
  const bars = [42, 58, 51, 70, 64, 82, 76, 90, 72, 88, 95, 84];
  const chart = `<svg viewBox="0 0 480 160" width="100%" height="${m ? 120 : 170}" preserveAspectRatio="none">${bars.map((v, i) => `<rect x="${i * 40 + 6}" y="${160 - v * 1.5}" width="26" height="${v * 1.5}" rx="6" fill="${i === bars.length - 2 ? t.p : `color-mix(in srgb, ${t.p} 28%, transparent)`}"/>`).join("")}</svg>`;
  const rows = c.features.slice(0, 4).map((f, i) => [f.title, ["Running", "Done", "Needs review", "Scheduled"][i], ["2m ago", "1h ago", "Today", "Tomorrow"][i]]);
  const content = `<div style="display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap"><div><p class="muted" style="font-size:14px">Good morning, Alex</p><h1 style="font-size:${m ? 26 : 30}px;margin-top:4px">Here's where things stand</h1></div>${m ? "" : `<a class="btn btn-o" style="height:40px">Last 30 days ▾</a>`}</div>
<div class="grid" style="margin-top:22px;grid-template-columns:repeat(${m ? 2 : 4},1fr)">${kpis.map(([k, v, d]) => `<div class="card" style="padding:16px"><p class="muted" style="font-size:13px">${k}</p><p style="font-size:${m ? 24 : 28}px;font-weight:700;margin-top:4px;font-family:'${t.hf}'">${v}</p><p style="font-size:12px;color:#16a34a">${d}</p></div>`).join("")}</div>
<div class="grid" style="margin-top:18px;${m ? "" : "grid-template-columns:1.6fr 1fr;"}"><div class="card"><div style="display:flex;justify-content:space-between"><h3 style="font-size:16px">Activity</h3><span class="pill ok">+18% vs last month</span></div><div style="margin-top:14px">${chart}</div></div>
<div class="card" style="background:linear-gradient(150deg,var(--p),color-mix(in srgb,var(--p) 60%,var(--s)));color:var(--onp);border:0"><p style="font-size:13px;opacity:.85">Next best action</p><h3 style="font-size:20px;margin:8px 0 10px">${esc(c.features[0].title)}</h3><p style="opacity:.85;font-size:14px">${esc(c.features[0].body)}</p><a class="btn" style="margin-top:18px;background:var(--onp);color:var(--p);height:42px">Start now</a></div></div>
<div class="card" style="margin-top:18px;padding:0"><div style="padding:16px 20px;border-bottom:1px solid var(--ln);display:flex;justify-content:space-between"><h3 style="font-size:16px">Recent</h3><span class="muted" style="font-size:13px">View all</span></div>${rows.map(([a, s, w], i) => `<div style="display:flex;align-items:center;gap:14px;padding:14px 20px;${i ? "border-top:1px solid var(--ln)" : ""}"><span class="ico" style="width:34px;height:34px">${svgIcon(i)}</span><b style="flex:1;font-size:14px">${esc(a)}</b><span class="pill ${s === "Done" ? "ok" : "warn"}">${s}</span>${m ? "" : `<span class="muted" style="font-size:13px;width:80px;text-align:right">${w}</span>`}</div>`).join("")}</div>`;
  return shell(ctx, t, m, o, "Overview", content);
}

function onboarding(ctx: DesignContext, t: Theme, m: boolean) {
  const c = copy(ctx);
  const art = `<div style="position:relative;height:${m ? 260 : 320}px;border-radius:28px;background:linear-gradient(160deg,color-mix(in srgb,var(--p) 22%,var(--bg)),color-mix(in srgb,var(--s) 22%,var(--bg)));display:grid;place-items:center;overflow:hidden">
<div class="card" style="width:72%;box-shadow:0 30px 60px -30px rgba(0,0,0,.35)">${c.features.slice(0, 3).map((f, i) => `<div style="display:flex;gap:10px;align-items:center;${i ? "margin-top:12px" : ""}"><span class="ico" style="width:32px;height:32px">${svgIcon(i)}</span><div style="flex:1"><b style="font-size:13px">${esc(cut(f.title, 26))}</b><div class="bar" style="margin-top:6px"><i style="width:${[90, 60, 35][i]}%"></i></div></div></div>`).join("")}</div>
<span style="position:absolute;top:22px;right:22px;width:56px;height:56px;border-radius:18px;background:var(--a);opacity:.85"></span><span style="position:absolute;bottom:26px;left:24px;width:36px;height:36px;border-radius:50%;background:var(--p);opacity:.6"></span></div>`;
  return `<main class="wrap" style="max-width:${m ? "390px" : "560px"};padding-top:${m ? 28 : 64}px;padding-bottom:40px;min-height:100vh;display:flex;flex-direction:column">
<div style="display:flex;justify-content:space-between;align-items:center">${logo(ctx, t)}<span class="muted" style="font-size:14px;font-weight:600">Skip</span></div>
<div style="margin-top:28px">${art}</div>
<div style="display:flex;gap:6px;justify-content:center;margin-top:26px"><i style="width:22px;height:6px;border-radius:9px;background:var(--p)"></i><i style="width:6px;height:6px;border-radius:9px;background:var(--ln)"></i><i style="width:6px;height:6px;border-radius:9px;background:var(--ln)"></i></div>
<h1 style="font-size:${m ? 28 : 34}px;text-align:center;margin-top:22px">${esc(c.headline)}</h1><p class="muted" style="text-align:center;margin-top:12px">${esc(c.sub)}</p>
<div style="margin-top:auto;padding-top:32px" class="grid"><a class="btn btn-p" style="width:100%">Get started</a><a class="btn btn-o" style="width:100%">I already have an account</a></div></main>`;
}

function pricing(ctx: DesignContext, t: Theme, m: boolean) {
  const c = copy(ctx);
  const tiers = [
    ["Starter", "0", "For trying it out", c.features.slice(0, 2).map((f) => f.title)],
    ["Pro", "19", "For growing teams", ["Everything in Starter", ...c.features.slice(2, 5).map((f) => f.title)]],
    ["Team", "49", "For larger teams", ["Everything in Pro", "Priority support", "Admin controls"]],
  ] as const;
  return `<header class="wrap" style="display:flex;justify-content:space-between;align-items:center;padding-top:22px;padding-bottom:22px">${logo(ctx, t)}<a class="btn btn-o" style="height:40px">Sign in</a></header>
<section class="wrap" style="text-align:center;padding-top:${m ? 16 : 40}px"><span class="eyebrow">Pricing</span><h1 style="font-size:${m ? 32 : 48}px;margin-top:16px">Simple plans that grow with you</h1><p class="muted" style="margin-top:12px">Start free. Upgrade when ${esc(cut(ctx.name, 24))} saves you time.</p></section>
<section class="wrap grid" style="margin-top:36px;padding-bottom:64px;${m ? "" : "grid-template-columns:repeat(3,1fr);align-items:start"}">${tiers
    .map(
      ([n, p, d, items], i) => `<div class="card" style="${i === 1 ? "border:2px solid var(--p);box-shadow:0 30px 60px -36px var(--p);" : ""}position:relative">${i === 1 ? `<span class="pill" style="position:absolute;top:-12px;left:22px;background:var(--p);color:var(--onp)">Most popular</span>` : ""}<h3 style="font-size:18px">${n}</h3><p class="muted" style="font-size:14px">${d}</p><p style="margin:16px 0"><b style="font-size:42px;font-family:'${t.hf}'">$${p}</b><span class="muted">/month</span></p><a class="btn ${i === 1 ? "btn-p" : "btn-o"}" style="width:100%">${i === 0 ? "Start free" : `Choose ${n}`}</a><ul style="list-style:none;margin-top:18px" class="grid">${items.map((it) => `<li style="display:flex;gap:10px;font-size:14px"><span style="color:var(--p)">✓</span>${esc(it)}</li>`).join("")}</ul></div>`,
    )
    .join("")}</section>`;
}

function settings(ctx: DesignContext, t: Theme, m: boolean, o: BuiltinOptions) {
  const toggle = (on: boolean) => `<span style="width:42px;height:24px;border-radius:99px;background:${on ? "var(--p)" : "var(--ln)"};position:relative;flex:none"><i style="position:absolute;top:3px;${on ? "right" : "left"}:3px;width:18px;height:18px;border-radius:50%;background:#fff"></i></span>`;
  const content = `<h1 style="font-size:${m ? 26 : 30}px">Settings</h1><p class="muted" style="margin-top:4px">Manage your account and preferences.</p>
<div class="grid" style="margin-top:22px;${m ? "" : "grid-template-columns:1fr 1fr;align-items:start"}"><div class="card"><h3 style="font-size:16px;margin-bottom:16px">Profile</h3><div class="grid" style="gap:14px"><div><label>Full name</label><input value="Alex Morgan"></div><div><label>Email</label><input value="alex@company.com"></div><div><label>Time zone</label><select><option>Europe/London</option></select></div></div><a class="btn btn-p" style="margin-top:18px">Save changes</a></div>
<div class="card"><h3 style="font-size:16px;margin-bottom:6px">Notifications</h3>${[["Weekly summary", true], ["When something needs my review", true], ["Product updates", false]].map(([l, on]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid var(--ln)"><span style="font-size:14px">${l}</span>${toggle(on as boolean)}</div>`).join("")}</div></div>`;
  return shell(ctx, t, m, o, "Settings", content);
}

function feature(ctx: DesignContext, t: Theme, m: boolean, o: BuiltinOptions, name: string, purpose: string) {
  const f = ctx.features.find((x) => cut(x.feature, 60).toLowerCase() === cut(name, 60).toLowerCase());
  const title = cut(f?.feature ?? name, 60);
  const why = cut(f?.why ?? purpose, 200);
  const steps = (f?.acceptanceCriteria ?? []).map((c) => cut(c, 100)).slice(0, 5);
  const items = steps.length ? steps : ["Set it up once", "Review what it found", "Approve and it runs on its own"];
  const content = `<div style="display:flex;justify-content:space-between;align-items:start;gap:16px;flex-wrap:wrap"><div><p class="muted" style="font-size:13px">${esc(cut(ctx.name, 24))} / ${esc(title)}</p><h1 style="font-size:${m ? 26 : 30}px;margin-top:6px">${esc(title)}</h1><p class="muted" style="margin-top:8px;max-width:620px">${esc(why)}</p></div>${m ? "" : `<a class="btn btn-p">Create new</a>`}</div>
<div class="grid" style="margin-top:22px;${m ? "" : "grid-template-columns:1.5fr 1fr;align-items:start"}"><div class="card" style="padding:0">${items.map((s, i) => `<div style="display:flex;gap:14px;align-items:center;padding:16px 20px;${i ? "border-top:1px solid var(--ln)" : ""}"><span style="width:28px;height:28px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:13px;font-weight:700;${i < 2 ? "background:var(--p);color:var(--onp)" : "border:2px solid var(--ln);color:var(--mu)"}">${i < 2 ? "✓" : i + 1}</span><span style="flex:1;font-size:14px">${esc(s)}</span><span class="pill ${i < 2 ? "ok" : "warn"}">${i < 2 ? "Done" : "To do"}</span></div>`).join("")}</div>
<div class="card"><h3 style="font-size:16px">Quick setup</h3><div class="grid" style="gap:14px;margin-top:14px"><div><label>Name</label><input placeholder="e.g. ${esc(cut(title, 30))}"></div><div><label>How often</label><select><option>Automatically</option><option>Daily</option><option>Weekly</option></select></div></div><a class="btn btn-p" style="width:100%;margin-top:18px">Save and turn on</a><p class="muted" style="font-size:12px;margin-top:10px;text-align:center">You can change this any time.</p></div></div>`;
  return shell(ctx, t, m, o, cut(title, 22), content);
}

/** Renders one screen. `purpose` is what the screen must do (from the screen list). */
export function renderBuiltinScreen(ctx: DesignContext, screen: { name: string; purpose?: string }, device: "MOBILE" | "DESKTOP", options: BuiltinOptions = {}): string {
  const t = theme(ctx, options);
  const m = device === "MOBILE";
  const kind = screenKind(screen.name);
  const body =
    kind === "landing"
      ? landing(ctx, t, m)
      : kind === "auth"
        ? auth(ctx, t, m, screen.name)
        : kind === "dashboard"
          ? dashboard(ctx, t, m, options)
          : kind === "onboarding"
            ? onboarding(ctx, t, m)
            : kind === "pricing"
              ? pricing(ctx, t, m)
              : kind === "settings"
                ? settings(ctx, t, m, options)
                : feature(ctx, t, m, options, screen.name, screen.purpose ?? "");
  return doc(`${cut(screen.name, 60)} · ${cut(ctx.name, 40)}`, t, m, options, body);
}

/** Options a previous built-in screen was rendered with (stored in an HTML comment). */
export function readBuiltinOptions(html: string): BuiltinOptions {
  try {
    const raw = html.match(/<!--builtin:([\s\S]*?)-->/)?.[1];
    const o = raw ? (JSON.parse(raw) as BuiltinOptions) : {};
    return { dark: o.dark === true, sidebar: typeof o.sidebar === "boolean" ? o.sidebar : undefined, compact: o.compact === true, variant: Number.isInteger(o.variant) ? o.variant : 0, accent: typeof o.accent === "string" && HEX.test(o.accent) ? o.accent : undefined };
  } catch {
    return {};
  }
}
