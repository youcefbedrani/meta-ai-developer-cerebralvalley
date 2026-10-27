import { z } from "zod";
import { inkOn, LOGO_SHAPES, LOGO_SYMBOLS, type BrandKit, type StoredBrand } from "@/lib/brand-kit";

/*
 * Landing page themes: ready-made looks a founder picks for their waitlist page.
 * Each theme is a palette, a font pair and a layout. "brand" reuses the project's Brand Kit.
 * Only values defined here (or validated Brand Kit values) ever reach the page's styles.
 */

export const LANDING_LAYOUTS = ["centered", "split", "bold"] as const;
export type LandingLayout = (typeof LANDING_LAYOUTS)[number];

export type LandingTheme = {
  id: string;
  name: string;
  description: string;
  layout: LandingLayout;
  palette: BrandKit["palette"];
  /** Optional hero background (CSS gradient built only from the palette above). */
  hero?: string;
  fonts: BrandKit["fonts"];
  dark: boolean;
};

export const LANDING_THEMES = [
  {
    id: "stratum",
    name: "Lavender",
    description: "Soft lavender and plum, calm and trustworthy.",
    layout: "centered",
    palette: { primary: "#41175E", secondary: "#C762F6", accent: "#F77373", background: "#FBF9F9", text: "#2A1440" },
    fonts: { heading: "Plus Jakarta Sans", body: "Inter" },
    dark: false,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Black on white, nothing in the way of your message.",
    layout: "split",
    palette: { primary: "#111111", secondary: "#6B7280", accent: "#2563EB", background: "#FFFFFF", text: "#111111" },
    fonts: { heading: "Inter", body: "Inter" },
    dark: false,
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark and techy, for developer and AI tools.",
    layout: "bold",
    palette: { primary: "#7C3AED", secondary: "#22D3EE", accent: "#F472B6", background: "#0B0B14", text: "#F4F4F8" },
    hero: "radial-gradient(900px circle at 15% -10%, #7C3AED40, transparent 60%), radial-gradient(700px circle at 95% 0%, #22D3EE26, transparent 55%)",
    fonts: { heading: "Space Grotesk", body: "Inter" },
    dark: true,
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm coral and peach, friendly for consumer products.",
    layout: "centered",
    palette: { primary: "#E2553F", secondary: "#F59E0B", accent: "#7C3AED", background: "#FFF7F1", text: "#3B1D14" },
    hero: "linear-gradient(180deg, #FFE4D3 0%, #FFF7F1 70%)",
    fonts: { heading: "Poppins", body: "DM Sans" },
    dark: false,
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Clean blues, the classic B2B SaaS look.",
    layout: "split",
    palette: { primary: "#1D4ED8", secondary: "#0EA5E9", accent: "#14B8A6", background: "#F5F9FF", text: "#0F1E3D" },
    hero: "linear-gradient(135deg, #E0EDFF 0%, #F5F9FF 60%)",
    fonts: { heading: "Manrope", body: "Inter" },
    dark: false,
  },
  {
    id: "forest",
    name: "Forest",
    description: "Deep green and cream, grounded and premium.",
    layout: "bold",
    palette: { primary: "#1F5135", secondary: "#86B49A", accent: "#D9A441", background: "#F6F3EA", text: "#14281D" },
    fonts: { heading: "Playfair Display", body: "Work Sans" },
    dark: false,
  },
] as const satisfies readonly LandingTheme[];

export const THEME_IDS = ["brand", ...LANDING_THEMES.map((t) => t.id)] as [string, ...string[]];
export type LandingThemeId = (typeof LANDING_THEMES)[number]["id"] | "brand";

/** Theme + logo settings stored with the page content. Optional so older pages keep working. */
export const landingStyleSchema = z.object({
  theme: z.enum(THEME_IDS).default("stratum"),
  logo: z
    .object({
      show: z.boolean().default(true),
      /** "brand" uses the Brand Kit logo; any shape draws a free logo from the product's initials. */
      source: z.enum(["brand", "generated"]).default("generated"),
      shape: z.enum(LOGO_SHAPES).default("rounded"),
      /** Optional icon instead of initials. */
      symbol: z.enum(LOGO_SYMBOLS).optional(),
      initials: z.string().trim().min(1).max(2).optional(),
    })
    .default({ show: true, source: "generated", shape: "rounded" }),
});
export type LandingStyle = z.output<typeof landingStyleSchema>;

const fallback = LANDING_THEMES[0];

/** The theme a page renders with. "brand" falls back to the default theme until a Brand Kit exists. */
export function resolveTheme(id: string | undefined, brand: StoredBrand | null): LandingTheme {
  if (id === "brand" && brand) {
    const dark = inkOn(brand.palette.background) === "#ffffff";
    return { id: "brand", name: "My brand", description: "Your Brand Kit colours, fonts and logo.", layout: "centered", palette: brand.palette, fonts: brand.fonts, dark };
  }
  return LANDING_THEMES.find((t) => t.id === id) ?? fallback;
}

/** Up to two initials from a product name ("Pipe Pilot" → "PP", "Notion" → "N"). */
export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "S";
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0][0]).toUpperCase();
}

/** The logo inputs for logoMarkSvg / logoFullSvg: the Brand Kit's own logo, or one drawn in the theme's colours. */
export function landingLogo(style: LandingStyle, theme: LandingTheme, brand: StoredBrand | null, name: string): Pick<BrandKit, "logo" | "palette" | "fonts"> {
  if (style.logo.source === "brand" && brand) return brand;
  return { logo: { shape: style.logo.shape, initials: style.logo.initials || initialsOf(name), symbol: style.logo.symbol }, palette: theme.palette, fonts: theme.fonts };
}

export const googleFontsHref = (fonts: BrandKit["fonts"]) =>
  `https://fonts.googleapis.com/css2?${[...new Set([fonts.heading, fonts.body])].map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`).join("&")}&display=swap`;
