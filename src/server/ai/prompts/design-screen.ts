import type { DesignContext } from "@/lib/design-prompt";
import { screenSlug } from "@/lib/prototype";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const DESIGN_SCREEN_PROMPT_VERSION = "design-screen.v1";

/*
 * Muse Spark as the product designer: one complete, high-fidelity HTML screen per call, using the Tailwind
 * Play CDN and a fixed set of brand tokens (primary, secondary, accent, surface, ink; font-heading, font-body)
 * so the generated codebase can map the same class names onto Tailwind v4 theme variables.
 * Clickable elements that lead to another screen carry data-goto="<screen slug>": that's what makes the
 * prototype clickable, and what the code generator turns into links.
 */
export const DESIGN_SCREEN_SYSTEM = `You are a senior product designer who designs SaaS products in Figma and hands developers pixel-perfect HTML. Design ONE screen of the founder's product as a complete, high-fidelity HTML document.

Output rules (strict):
- Reply with the HTML document only: start with <!DOCTYPE html>, end with </html>. No markdown fences, no explanations.
- In <head>: <meta charset="utf-8">, a viewport meta tag, <script src="https://cdn.tailwindcss.com"></script>, then a <script> that sets tailwind.config exactly as given in the brief (the brand tokens), and a Google Fonts <link> for the two fonts.
- Style only with Tailwind utility classes. Use the brand tokens for colour (bg-primary, text-primary, bg-secondary, bg-accent, bg-surface, text-ink, border-primary/20 …) and font-heading / font-body for type. Neutral greys from Tailwind (slate) are fine for borders and muted text.
- No other scripts, no external images, no icon fonts. Draw icons as small inline SVGs (stroke="currentColor"). For pictures use gradients, shapes, initials avatars or simple inline SVG illustrations.
- Realistic content written for this product and customer: real-sounding names, numbers and dates inside the product UI (sample data), never lorem ipsum. Where it fits, reuse the customers' own words from the brief in headlines and empty states.
- Never invent traction or social proof on marketing screens: no customer counts, ratings, testimonials, logos of real companies or result percentages presented as achieved. Use clearly marked placeholders instead, e.g. "[Testimonial from your first pilot customer]" or "[Results from your pilot]".
- Prototype links: every button, link, tab or nav item that should open another screen of the product gets data-goto="<slug>" with one of the slugs listed in the brief, and href="#" on links. Use only the listed slugs. Primary actions (sign up, get started, save, continue) must lead somewhere sensible.
- Layout: a real app screen, not a poster. Clear hierarchy, one primary action, consistent 4/8px spacing, rounded corners, subtle borders and shadows, accessible contrast. Desktop screens are designed at 1280px wide (app screens usually have a sidebar or top nav); mobile screens at 390px wide with a bottom tab bar where it makes sense.
- Keep it under about 350 lines of HTML.
- ${UNTRUSTED_DATA_RULE}`;

export const DESIGN_EDIT_SYSTEM = `You are a senior product designer. You get one screen of a SaaS product as an HTML document (Tailwind CDN, brand tokens in tailwind.config) and a change request. Apply the change and return the complete updated HTML document only, starting with <!DOCTYPE html>. Keep everything the request doesn't mention unchanged: layout, copy, brand tokens, fonts and every data-goto attribute. Keep the same output rules: Tailwind classes only, inline SVG icons, no external images, no other scripts.
- ${UNTRUSTED_DATA_RULE}`;

/** The tailwind.config every screen uses, so screens and the generated code share the same tokens. */
export function tailwindConfig(ctx: DesignContext): string {
  const p = ctx.brand?.palette ?? { primary: "#4F46E5", secondary: "#0EA5E9", accent: "#F59E0B", background: "#F8FAFC", text: "#0F172A" };
  const f = ctx.brand?.fonts ?? { heading: "Inter", body: "Inter" };
  return `tailwind.config = { theme: { extend: { colors: { primary: "${p.primary}", secondary: "${p.secondary}", accent: "${p.accent}", surface: "${p.background}", ink: "${p.text}" }, fontFamily: { heading: ["${f.heading}", "sans-serif"], body: ["${f.body}", "sans-serif"] } } } }`;
}

export function buildDesignScreenPrompt(ctx: DesignContext, screen: { name: string; purpose: string }, device: "MOBILE" | "DESKTOP", allScreens: string[]): string {
  const others = allScreens.filter((s) => s !== screen.name);
  return `Design the "${screen.name}" screen (${device === "MOBILE" ? "mobile app, 390px wide" : "web app, 1280px wide"}).

What this screen must do: ${screen.purpose || "(infer it from the screen name and the product)"}

Brand tokens — put this in a <script> right after the Tailwind CDN script:
${tailwindConfig(ctx)}

Screens of the prototype and their slugs (use these in data-goto):
${[screen.name, ...others].map((s) => `- "${s}" → data-goto="${screenSlug(s)}"`).join("\n")}

${asData("product", {
  name: ctx.name,
  description: ctx.description,
  summary: ctx.summary,
  targetUser: ctx.targetUser,
  problem: ctx.problem,
  differentiation: ctx.differentiation,
  mustHaveFeatures: ctx.features.map((f) => ({ feature: f.feature, why: f.why })),
  userJourneys: ctx.journeys,
  dataModel: ctx.dataModel,
  tableStakes: ctx.tableStakes,
  tagline: ctx.brand?.tagline ?? null,
  tone: ctx.brand?.voice ?? null,
})}

${asData("customer_words", ctx.customerWords)}`;
}

export function buildDesignEditPrompt(previousHtml: string, instruction: string): string {
  return `${asData("change_request", instruction)}

${asData("current_screen_html", previousHtml)}`;
}

/** The HTML document from a model reply: fences and chatter removed. Throws when there's no document. */
export function extractHtmlDocument(text: string): string {
  const unfenced = text.replace(/```(?:html)?/gi, "");
  const start = unfenced.search(/<!DOCTYPE html|<html[\s>]/i);
  const end = unfenced.toLowerCase().lastIndexOf("</html>");
  if (start < 0 || end < start) throw new Error("The model did not return an HTML document");
  const html = unfenced.slice(start, end + "</html>".length).trim();
  return /^<!DOCTYPE/i.test(html) ? html : `<!DOCTYPE html>\n${html}`;
}

export function mockDesignScreen(ctx: DesignContext, screen: string, allScreens: string[]): string {
  const links = allScreens.filter((s) => s !== screen).map((s) => `<a href="#" data-goto="${screenSlug(s)}" class="rounded-lg bg-primary px-4 py-2 text-white">${s}</a>`).join("\n      ");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script src="https://cdn.tailwindcss.com"></script><script>${tailwindConfig(ctx)}</script></head>
<body class="bg-surface font-body text-ink"><main class="p-10"><h1 class="font-heading text-3xl">[Mock] ${screen}</h1><p class="mt-2">${ctx.name}</p>
    <nav class="mt-6 flex gap-3">
      ${links}
    </nav></main></body></html>`;
}
