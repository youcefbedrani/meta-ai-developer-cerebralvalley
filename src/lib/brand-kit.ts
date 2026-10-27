import { z } from "zod";

/*
 * Brand Kit: name ideas, tagline, palette, fonts and a logo. The AI only picks from safe options
 * (hex colours, a font allowlist, a logo shape); the SVG itself is drawn here, so nothing the model
 * writes is ever rendered as markup.
 */

export const BRAND_FONTS = ["Inter", "Poppins", "Space Grotesk", "DM Sans", "Manrope", "Sora", "Outfit", "Plus Jakarta Sans", "Work Sans", "IBM Plex Sans", "Playfair Display", "Lora"] as const;
export const LOGO_SHAPES = ["circle", "rounded", "hexagon", "squircle", "diamond", "stack"] as const;
/** Symbols drawn inside the logo shape instead of initials. */
export const LOGO_SYMBOLS = ["bolt", "spark", "leaf", "wave", "chart", "chat", "shield", "layers", "orbit", "check", "target", "bloom"] as const;
export type LogoSymbol = (typeof LOGO_SYMBOLS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour");

export const brandKitSchema = z.object({
  names: z.array(z.object({ name: z.string().min(2).max(24), why: z.string().max(160), domainIdea: z.string().max(40) })).min(3).max(6),
  tagline: z.string().max(90),
  voice: z.array(z.string().max(20)).min(2).max(4),
  palette: z.object({ primary: hex, secondary: hex, accent: hex, background: hex, text: hex }),
  fonts: z.object({ heading: z.enum(BRAND_FONTS), body: z.enum(BRAND_FONTS) }),
  logo: z.object({ shape: z.enum(LOGO_SHAPES), initials: z.string().min(1).max(2), symbol: z.enum(LOGO_SYMBOLS).optional() }),
  rationale: z.string().max(400),
});
export type BrandKit = z.output<typeof brandKitSchema>;

/** What we store: the kit plus the name the founder picked (defaults to the first idea). */
export const storedBrandSchema = brandKitSchema.extend({ chosen: z.number().int().min(0).max(5).default(0), generatedAt: z.string() });
export type StoredBrand = z.output<typeof storedBrandSchema>;

export function parseStoredBrand(raw: unknown): StoredBrand | null {
  const r = storedBrandSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/* ---------------------------- colour contrast ---------------------------- */

function luminance(h: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on the colour. */
export const inkOn = (bg: string) => (contrast(bg, "#ffffff") >= contrast(bg, "#111111") ? "#ffffff" : "#111111");

/* --------------------------------- logo --------------------------------- */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const SHAPES: Record<(typeof LOGO_SHAPES)[number], (fill: string, accent: string) => string> = {
  circle: (f) => `<circle cx="32" cy="32" r="30" fill="${f}"/>`,
  rounded: (f) => `<rect x="2" y="2" width="60" height="60" rx="16" fill="${f}"/>`,
  squircle: (f) => `<path d="M32 2C56 2 62 8 62 32S56 62 32 62 2 56 2 32 8 2 32 2Z" fill="${f}"/>`,
  hexagon: (f) => `<path d="M32 2 58 17v30L32 62 6 47V17Z" fill="${f}"/>`,
  diamond: (f) => `<rect x="11" y="11" width="42" height="42" rx="10" transform="rotate(45 32 32)" fill="${f}"/>`,
  stack: (f, a) => `<rect x="2" y="14" width="60" height="48" rx="14" fill="${a}"/><rect x="2" y="2" width="60" height="50" rx="14" fill="${f}"/>`,
};

/** Symbols on a 64×64 grid, centred on (32, 32), drawn in the ink colour. */
const SYMBOLS: Record<LogoSymbol, (ink: string, accent: string) => string> = {
  bolt: (i) => `<path d="M35 14 21 35h10l-3 15 15-22H33z" fill="${i}"/>`,
  spark: (i, a) => `<path d="M32 13c1.6 9.2 4.8 12.4 14 14-9.2 1.6-12.4 4.8-14 14-1.6-9.2-4.8-12.4-14-14 9.2-1.6 12.4-4.8 14-14Z" fill="${i}"/><circle cx="45" cy="44" r="4" fill="${a}"/>`,
  leaf: (i) => `<path d="M18 45c0-17 11-27 29-28 0 19-10 29-27 29" fill="${i}"/><path d="M20 45c6-8 12-13 20-18" stroke-width="3" stroke-linecap="round" fill="none" stroke="currentColor" opacity=".35"/>`,
  wave: (i, a) => `<path d="M14 30c5-6 9-6 13 0s8 6 13 0 8-6 10 0" stroke="${i}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M14 41c5-6 9-6 13 0s8 6 13 0 8-6 10 0" stroke="${a}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  chart: (i, a) => `<rect x="17" y="34" width="7" height="13" rx="2" fill="${i}" opacity=".7"/><rect x="28.5" y="25" width="7" height="22" rx="2" fill="${i}" opacity=".85"/><rect x="40" y="17" width="7" height="30" rx="2" fill="${i}"/><circle cx="43.5" cy="13" r="3" fill="${a}"/>`,
  chat: (i, a) => `<path d="M16 21a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v13a6 6 0 0 1-6 6H29l-9 7v-7h0a6 6 0 0 1-4-6Z" fill="${i}"/><circle cx="25" cy="27.5" r="2.5" fill="${a}"/><circle cx="32" cy="27.5" r="2.5" fill="${a}"/><circle cx="39" cy="27.5" r="2.5" fill="${a}"/>`,
  shield: (i, a) => `<path d="M32 13 47 19v11c0 10-6.5 17-15 20-8.5-3-15-10-15-20V19Z" fill="${i}"/><path d="m25 31 5 5 9-10" stroke="${a}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  layers: (i, a) => `<path d="M32 14 49 23 32 32 15 23Z" fill="${i}"/><path d="m15 31 17 9 17-9" stroke="${i}" stroke-width="4" fill="none" stroke-linejoin="round" opacity=".8"/><path d="m15 39 17 9 17-9" stroke="${a}" stroke-width="4" fill="none" stroke-linejoin="round"/>`,
  orbit: (i, a) => `<circle cx="32" cy="32" r="7" fill="${i}"/><ellipse cx="32" cy="32" rx="18" ry="9" stroke="${i}" stroke-width="3.5" fill="none" transform="rotate(-30 32 32)"/><circle cx="47" cy="22" r="3.5" fill="${a}"/>`,
  check: (i) => `<path d="m19 33 9 9 18-20" stroke="${i}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  target: (i, a) => `<circle cx="32" cy="32" r="16" stroke="${i}" stroke-width="4" fill="none"/><circle cx="32" cy="32" r="8" stroke="${i}" stroke-width="4" fill="none"/><circle cx="32" cy="32" r="3" fill="${a}"/>`,
  bloom: (i, a) => `${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="32" cy="21" rx="6" ry="10" fill="${i}" opacity=".9" transform="rotate(${r} 32 32)"/>`).join("")}<circle cx="32" cy="32" r="5" fill="${a}"/>`,
};

type LogoInput = { logo: { shape: (typeof LOGO_SHAPES)[number]; initials: string; symbol?: LogoSymbol }; palette: BrandKit["palette"]; fonts: { heading: string; body: string } };

/** A second colour for the symbol's details that stands out on the ink. */
function detailOn(ink: string, kit: LogoInput) {
  const options = [kit.palette.accent, kit.palette.secondary, kit.palette.primary];
  return options.find((c) => contrast(c, ink) >= 2.2) ?? (ink === "#ffffff" ? kit.palette.primary : "#ffffff");
}

/** The logo mark as a standalone SVG string. Only validated values reach it, and text is escaped. */
export function logoMarkSvg(kit: LogoInput, size = 64): string {
  const { shape, initials, symbol } = kit.logo;
  const fill = kit.palette.primary;
  const ink = inkOn(fill);
  // A soft diagonal gradient from the primary colour into the secondary gives the mark depth.
  const id = `g${(fill + kit.palette.secondary).replace(/#/g, "")}`;
  const blend = contrast(kit.palette.secondary, ink) >= 3 ? kit.palette.secondary : fill;
  const defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${fill}"/><stop offset="1" stop-color="${blend}"/></linearGradient></defs>`;
  const body = SHAPES[shape](`url(#${id})`, kit.palette.accent);
  const glyph =
    symbol && SYMBOLS[symbol]
      ? `<g${shape === "stack" ? ' transform="translate(0 -3)"' : ""} style="color:${ink}">${SYMBOLS[symbol](ink, detailOn(ink, kit))}</g>`
      : (() => {
          const text = esc(initials.toUpperCase().slice(0, 2));
          const fontSize = text.length > 1 ? 24 : 30;
          const y = shape === "stack" ? 28 : 32;
          return `<text x="32" y="${y}" dy=".35em" text-anchor="middle" font-family="${esc(kit.fonts.heading)}, system-ui, sans-serif" font-weight="800" font-size="${fontSize}" letter-spacing="-1" fill="${ink}">${text}</text>`;
        })();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${defs}${body}${glyph}</svg>`;
}

/** Mark + wordmark, for headers and social profiles. */
export function logoFullSvg(kit: LogoInput, name: string): string {
  const safe = esc(name.slice(0, 24));
  const width = 84 + Math.round(name.slice(0, 24).length * 18);
  const mark = logoMarkSvg(kit).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="64" viewBox="0 0 ${width} 64">${mark}<text x="78" y="32" dy=".35em" font-family="${esc(kit.fonts.heading)}, system-ui, sans-serif" font-weight="800" font-size="30" letter-spacing="-1" fill="${kit.palette.text}">${safe}</text></svg>`;
}

/** Logo options to pick from for free: symbol marks and initials in every shape, in the kit's colours. */
export function logoVariants(kit: LogoInput): LogoInput["logo"][] {
  const shapes = LOGO_SHAPES;
  const symbols = LOGO_SYMBOLS.map((symbol, i) => ({ shape: shapes[i % shapes.length], initials: kit.logo.initials, symbol }));
  const letters = shapes.map((shape) => ({ shape, initials: kit.logo.initials }));
  return [...symbols, ...letters];
}

/** A sensible symbol for a product from its description (used when the AI didn't pick one). */
export function suggestSymbol(text: string): LogoSymbol {
  const t = text.toLowerCase();
  const rules: [RegExp, LogoSymbol][] = [
    [/secur|privacy|complian|protect|fraud|safe/, "shield"],
    [/chat|message|support|inbox|email|comment|community/, "chat"],
    [/analytic|report|dashboard|metric|insight|revenue|finance|invoice/, "chart"],
    [/automat|fast|speed|instant|workflow|ai\b/, "bolt"],
    [/health|eco|green|garden|plant|wellness|food/, "leaf"],
    [/audio|music|podcast|ocean|flow|stream/, "wave"],
    [/task|todo|checklist|habit|approval|done/, "check"],
    [/goal|lead|sales|market|ads|seo|growth/, "target"],
    [/stack|layer|data|api|integrat|sync/, "layers"],
    [/space|global|travel|network|connect/, "orbit"],
    [/creat|design|beauty|art|photo/, "bloom"],
  ];
  return rules.find(([re]) => re.test(t))?.[1] ?? "spark";
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** CSS custom properties to paste into a stylesheet. */
export function cssVariables(kit: BrandKit): string {
  const p = kit.palette;
  return [":root {", `  --brand-primary: ${p.primary};`, `  --brand-secondary: ${p.secondary};`, `  --brand-accent: ${p.accent};`, `  --brand-background: ${p.background};`, `  --brand-text: ${p.text};`, `  --font-heading: "${kit.fonts.heading}", system-ui, sans-serif;`, `  --font-body: "${kit.fonts.body}", system-ui, sans-serif;`, "}"].join("\n");
}
