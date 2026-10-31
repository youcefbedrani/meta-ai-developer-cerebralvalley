import { z } from "zod";

/*
 * MVP design with Google Stitch. Pure (no DB, no network) so every rule is unit-tested.
 * - suggestScreens: which screens a first version needs, from the MVP plan.
 * - buildScreenPrompt: one Stitch prompt per screen, built from everything we know about the founder's
 *   product: idea, research, MVP plan, Brand Kit and customers' own words.
 * - buildCodingPrompt: the hand-off prompt for Claude Code, Cursor or any AI coding tool.
 */

export type Platform = "web" | "mobile";
export const DEVICE: Record<Platform, "DESKTOP" | "MOBILE"> = { web: "DESKTOP", mobile: "MOBILE" };
export const MAX_SCREENS = 6;

export type DesignContext = {
  name: string;
  description: string;
  summary: string | null;
  targetUser: string | null;
  problem: string | null;
  differentiation: string[];
  features: { feature: string; why: string; acceptanceCriteria?: string[] }[];
  journeys: { name: string; steps: string[] }[];
  customerWords: string[];
  tableStakes: string[];
  brand: {
    tagline: string;
    voice: string[];
    palette: { primary: string; secondary: string; accent: string; background: string; text: string };
    fonts: { heading: string; body: string };
    /** The Brand Kit logo, drawn by the built-in designer (not sent to Stitch). */
    logo?: { shape: string; initials: string; symbol?: string };
  } | null;
  stack: string[];
  dataModel: { entity: string; fields: string[] }[];
};

export type ScreenSpec = { name: string; purpose: string };

export const screenSpecSchema = z.object({ name: z.string().trim().min(2, "Name the screen").max(60), purpose: z.string().trim().max(300) });
export const designRequestSchema = z.object({
  platform: z.enum(["web", "mobile"]),
  screens: z.array(screenSpecSchema).min(1, "Pick at least one screen").max(MAX_SCREENS, `Up to ${MAX_SCREENS} screens at a time`),
});
export const designEditSchema = z.object({ instruction: z.string().trim().min(4, "Say what to change").max(500) });

const cut = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** The screens a first version needs: entry, sign-up, the main screen, then the must-have features. */
export function suggestScreens(ctx: DesignContext, platform: Platform): ScreenSpec[] {
  const customer = cut(ctx.targetUser, 80) || "the target customer";
  const base: ScreenSpec[] =
    platform === "web"
      ? [
          { name: "Landing page", purpose: `Convince ${customer} in seconds: the problem in their words, how ${ctx.name} solves it, key features and a clear sign-up call to action.` },
          { name: "Sign up", purpose: "Create an account in under a minute with as few fields as possible." },
          { name: "Main dashboard", purpose: "The first screen after sign-in: shows the core value at a glance and the next action to take." },
        ]
      : [
          { name: "Welcome & onboarding", purpose: `Two or three short steps that show ${customer} why ${ctx.name} is worth using, then a sign-up button.` },
          { name: "Sign up", purpose: "Create an account quickly, with social sign-in and as few fields as possible." },
          { name: "Home", purpose: "The main screen after sign-in: the core value at a glance and the primary action within thumb reach." },
        ];
  const features = ctx.features.slice(0, MAX_SCREENS - base.length).map((f) => ({ name: cut(f.feature, 60), purpose: cut(f.why, 300) }));
  return [...base, ...features].slice(0, MAX_SCREENS);
}

/** One Stitch prompt for one screen. Kept well under the model's comfortable prompt size. */
export function buildScreenPrompt(ctx: DesignContext, screen: ScreenSpec, platform: Platform): string {
  const lines: string[] = [];
  const kind = platform === "web" ? "responsive web app (designed at desktop width)" : "mobile app (iOS and Android, 390px wide)";
  lines.push(`Design the "${cut(screen.name, 60)}" screen of ${ctx.name}, a ${kind}.`);
  lines.push("");
  lines.push(`Product: ${cut(ctx.summary || ctx.description, 400)}`);
  if (ctx.targetUser) lines.push(`Who it's for: ${cut(ctx.targetUser, 200)}`);
  if (ctx.problem) lines.push(`Problem it solves: ${cut(ctx.problem, 250)}`);
  if (screen.purpose) lines.push(`What this screen must do: ${cut(screen.purpose, 300)}`);
  if (ctx.features.length) {
    lines.push("", "Key features of the product:");
    for (const f of ctx.features.slice(0, 5)) lines.push(`- ${cut(f.feature, 90)}`);
  }
  if (ctx.differentiation.length) lines.push("", `What makes it different: ${ctx.differentiation.slice(0, 2).map((d) => cut(d, 150)).join(" ")}`);
  if (ctx.customerWords.length) {
    lines.push("", "Real customers describe the problem like this (reuse their words in headlines and copy where it fits):");
    for (const q of ctx.customerWords.slice(0, 3)) lines.push(`- "${cut(q, 140)}"`);
  }
  lines.push("");
  if (ctx.brand) {
    const p = ctx.brand.palette;
    lines.push(`Brand: name "${ctx.name}", tagline "${cut(ctx.brand.tagline, 90)}".`);
    lines.push(`Colours: primary ${p.primary}, secondary ${p.secondary}, accent ${p.accent}, background ${p.background}, text ${p.text}.`);
    lines.push(`Fonts: headings ${ctx.brand.fonts.heading}, body ${ctx.brand.fonts.body}. Tone: ${ctx.brand.voice.slice(0, 3).join(", ")}.`);
  } else {
    lines.push(`Style: clean, modern and trustworthy, generous whitespace, one strong accent colour. Use "${ctx.name}" as the product name.`);
  }
  lines.push("", "Requirements: realistic content (no lorem ipsum), one clear primary action, accessible colour contrast, consistent spacing.");
  return lines.join("\n").slice(0, 3500);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "screen";
export const screenFileName = (position: number, name: string) => `${String(position + 1).padStart(2, "0")}-${slug(name)}.html`;

/** The hand-off prompt for Claude Code, Cursor, Windsurf, Lovable, Bolt or v0. */
export function buildCodingPrompt(ctx: DesignContext, screens: { name: string; file: string }[], platform: Platform): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`) : ["- (not defined yet)"]);
  const stack = ctx.stack.length ? ctx.stack : platform === "web" ? ["Next.js (App Router) + TypeScript", "Tailwind CSS", "Postgres", "Auth with email + Google"] : ["React Native with Expo + TypeScript", "A hosted backend (e.g. Supabase or Firebase)", "Email + Apple/Google sign-in"];
  const lines = [
    `# Build ${ctx.name}: MVP`,
    "",
    `You are building the first version (MVP) of **${ctx.name}**, a ${platform === "web" ? "web app" : "mobile app"}. Everything below comes from validation work on Startum: research, real customer quotes, an MVP plan and a brand kit. Build exactly this scope, no more.`,
    "",
    "## The product",
    cut(ctx.summary || ctx.description, 800),
    "",
    `**Target user:** ${cut(ctx.targetUser, 300) || "see the product summary"}`,
    `**Problem:** ${cut(ctx.problem, 400) || "see the product summary"}`,
    "",
    "## Screens (designs in `design/`)",
    "Each HTML file is an approved high-fidelity design. Match the layout, hierarchy, colours and copy closely, but rebuild it as real, accessible components. Don't paste the HTML in as-is.",
    ...screens.map((s, i) => `${i + 1}. **${s.name}**: \`design/${s.file}\``),
    "",
    "## Must-have features",
    ...(ctx.features.length
      ? ctx.features.flatMap((f, i) => [`### ${i + 1}. ${f.feature}`, cut(f.why, 300), ...(f.acceptanceCriteria?.length ? ["Done when:", ...f.acceptanceCriteria.map((c) => `- [ ] ${c}`)] : []), ""])
      : ["- Build the screens above with working navigation and real data storage.", ""]),
    ...(ctx.journeys.length ? ["## User journeys", ...ctx.journeys.flatMap((j) => [`**${j.name}:** ${j.steps.join(" → ")}`]), ""] : []),
    ...(ctx.dataModel.length ? ["## Data model", ...ctx.dataModel.map((d) => `- **${d.entity}**: ${d.fields.join(", ")}`), ""] : []),
    "## Tech stack",
    ...list(stack),
    "",
    ...(ctx.brand
      ? ["## Brand", `- Colours: primary ${ctx.brand.palette.primary}, secondary ${ctx.brand.palette.secondary}, accent ${ctx.brand.palette.accent}, background ${ctx.brand.palette.background}, text ${ctx.brand.palette.text}`, `- Fonts: ${ctx.brand.fonts.heading} (headings), ${ctx.brand.fonts.body} (body), both free on Google Fonts`, `- Tagline: ${ctx.brand.tagline}`, `- Tone: ${ctx.brand.voice.join(", ")}`, "- Full details: `docs/brand.md`", ""]
      : []),
    ...(ctx.customerWords.length ? ["## Customers' own words (use them in copy)", ...ctx.customerWords.slice(0, 6).map((q) => `> ${cut(q, 200)}`), ""] : []),
    "## How to work",
    "1. Read this file, `docs/mvp-spec.md` (if present) and every design in `design/` before writing code.",
    "2. Propose a short plan (folders, data model, screens) and wait for approval.",
    "3. Build one screen at a time, starting with sign-up and the main screen. Keep it running after each step.",
    "4. Add basic tests for the must-have features, and a README with how to run it.",
    "5. Don't add features that aren't listed here. Put ideas in a `LATER.md` file instead.",
  ];
  return lines.join("\n");
}
