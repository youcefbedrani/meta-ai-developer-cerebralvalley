import type { BrandKit } from "@/lib/brand-kit";
import { BRAND_FONTS, LOGO_SHAPES, LOGO_SYMBOLS, suggestSymbol } from "@/lib/brand-kit";
import type { ProjectContextData } from "@/server/services/project-context";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const BRAND_PROMPT_VERSION = "brand.v2";

export const BRAND_SYSTEM = `You are a brand designer for micro-SaaS products.
Create a small, coherent brand kit for the product described in the data.
Rules:
- Names: short (ideally one word, 4–10 letters), easy to spell and say, not an existing well-known brand. "domainIdea" is a suggestion to check (e.g. "getname.com"); never claim a domain or trademark is available.
- Use the customers' own words from the research when choosing the tagline and voice.
- Palette: "background" and "text" must have strong contrast (at least 7:1). "primary" must be readable with white or black text on it.
- Fonts: choose heading and body ONLY from: ${BRAND_FONTS.join(", ")}.
- Logo: choose a shape ONLY from: ${LOGO_SHAPES.join(", ")}; "initials" are 1–2 letters of the first name idea; "symbol" is the icon drawn in the mark, ONLY from: ${LOGO_SYMBOLS.join(", ")}. Pick the symbol that best fits what the product does.
- ${UNTRUSTED_DATA_RULE}`;

export function buildBrandPrompt(ctx: ProjectContextData) {
  return `Create the brand kit.\n\n${asData("project", ctx)}`;
}

export function mockBrandKit(ctx: ProjectContextData): BrandKit {
  const base = ctx.name.replace(/[^A-Za-z]/g, "") || "Brand";
  return {
    names: [
      { name: base.slice(0, 12), why: "[Mock] Keeps your project name.", domainIdea: `get${base.toLowerCase().slice(0, 12)}.com` },
      { name: "Clearly", why: "[Mock] Promises clarity.", domainIdea: "clearly.app" },
      { name: "Tidyflow", why: "[Mock] Suggests an organised workflow.", domainIdea: "tidyflow.io" },
    ],
    tagline: "[Mock] The simple way to get it done.",
    voice: ["Friendly", "Clear", "Confident"],
    palette: { primary: "#4f46e5", secondary: "#0ea5e9", accent: "#f59e0b", background: "#ffffff", text: "#111827" },
    fonts: { heading: "Space Grotesk", body: "Inter" },
    logo: { shape: "squircle", initials: base.slice(0, 1).toUpperCase() || "B", symbol: suggestSymbol(`${ctx.name} ${ctx.description}`) },
    rationale: "[Mock] Calm indigo for trust, a warm accent for action.",
  };
}
