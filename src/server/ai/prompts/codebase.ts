import type { DesignContext } from "@/lib/design-prompt";
import type { CodebaseData, Entity } from "@/lib/validation/codebase";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const CODEBASE_PROMPT_VERSION = "codebase.v1";

export const CODEBASE_DATA_SYSTEM = `You are a senior full-stack engineer. From the product brief and the approved screens, define the data model the MVP needs: the 1–6 entities the screens list, show or create (not users or auth, those come later).
- key: lowercase plural, snake_case (e.g. "deadlines", "staff_members"). label: human name.
- fields: 2–8 per entity, camelCase keys, the fields the screens actually show or a form collects. Types: text, longtext, number, money, date (YYYY-MM-DD), boolean, email, select (with 2–6 options).
- seed: 3–5 realistic sample rows per entity for this product and customer (real-sounding names, dates in the near future or past, plausible numbers). One value per field, all values as strings.
- ${UNTRUSTED_DATA_RULE}`;

export function buildCodebaseDataPrompt(ctx: DesignContext, screens: { name: string; text: string }[]): string {
  return `Define the data model.

${asData("product", { name: ctx.name, summary: ctx.summary ?? ctx.description, targetUser: ctx.targetUser, mustHaveFeatures: ctx.features.map((f) => f.feature), mvpDataModel: ctx.dataModel })}

${asData("approved_screens", screens.map((s) => ({ screen: s.name, visibleText: s.text.slice(0, 1500) })))}`;
}

export const CODEBASE_PAGE_SYSTEM = `You are a senior Next.js engineer. Convert one approved screen design (HTML + Tailwind classes) into a Next.js 15 App Router page in TypeScript. Reply with the file's code only: no markdown fences, no explanations.

The page must compile and run as is:
- A React Server Component: \`export default async function <Name>Page()\`. No "use client", no hooks, no event handlers (onClick, onChange…): interactivity is links and forms only.
- Keep the design pixel-faithful: same structure, same Tailwind classes, same copy. The brand tokens (bg-primary, text-ink, bg-surface, font-heading, font-body…) exist in the app's Tailwind theme, keep them.
- JSX conversion: class → className, for → htmlFor, inline style strings → style objects, self-close void tags (<img />, <input />, <br />), SVG attributes in camelCase (strokeWidth, strokeLinecap, strokeLinejoin, fillRule, clipRule, viewBox), HTML comments → {/* */}. Remove <script> tags and data-goto attributes.
- Navigation: every element with data-goto="<slug>" becomes \`<Link href="<route>">\` (import Link from "next/link") using the route table, keeping its classes. Other links: href="#".
- Real data where the screen shows records: \`import { list, count } from "@/lib/store";\` then \`const rows = await list("<entity key>");\` and render rows.map((row) => …) with key={row.id} and row.<field key> in place of the hard-coded items. Keep the static copy around it. Format money and dates simply (e.g. \`$\${row.amount}\`).
- Forms that create a record: \`import { createRecord } from "@/app/actions";\` then \`<form action={createRecord}>\` with \`<input type="hidden" name="_entity" value="<entity key>" />\`, optionally \`<input type="hidden" name="_redirect" value="<route>" />\`, and one input per field with name="<field key>". Sign-up / sign-in forms: no action, the submit is a Link to the next screen (auth comes later).
- Import only from: "next/link", "@/lib/store", "@/app/actions". Nothing else.
- ${UNTRUSTED_DATA_RULE}`;

export function buildCodebasePagePrompt(input: { screen: string; route: string; routes: Record<string, string>; entities: Entity[]; body: string }): string {
  return `Write src/app${input.route === "/" ? "" : input.route}/page.tsx for the "${input.screen}" screen.

Route table (data-goto slug → href):
${Object.entries(input.routes).map(([slug, route]) => `- ${slug} → ${route}`).join("\n")}

${asData("entities", input.entities.map((e) => ({ key: e.key, label: e.label, fields: e.fields.map((f) => `${f.key} (${f.type}${f.options.length ? `: ${f.options.join(" | ")}` : ""})`) })))}

${asData("screen_html_body", input.body)}`;
}

/** The design's <body> content without scripts, comments, or the prototype attributes the model doesn't need. */
export function screenBody(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/\n\s*\n/g, "\n").trim().slice(0, 40_000);
}

/** The text a screen shows (for the data-model call). */
export const screenText = (html: string) => screenBody(html).replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** The TSX file from a model reply. Throws when it isn't a page module. */
export function extractPageCode(text: string): string {
  const fenced = text.match(/```(?:tsx|typescript|ts|jsx)?\s*\n([\s\S]*?)```/i)?.[1];
  const code = (fenced ?? text).trim();
  if (!/export\s+default\s+(async\s+)?function/.test(code)) throw new Error("The model did not return a page component");
  if (/^\s*["']use client["']/m.test(code) || /\buse(State|Effect|Ref|Router)\s*\(/.test(code)) throw new Error("The page uses client-only APIs");
  return `${code}\n`;
}

const pascal = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join("") || "Screen";

export function mockCodebasePage(screen: string, routes: Record<string, string>): string {
  const links = Object.entries(routes).map(([slug, route]) => `        <Link className="rounded-lg bg-primary px-4 py-2 text-white" href="${route}">${slug}</Link>`).join("\n");
  return `import Link from "next/link";

export default async function ${pascal(screen)}Page() {
  return (
    <main className="p-10">
      <h1 className="font-heading text-3xl">[Mock] ${screen}</h1>
      <nav className="mt-6 flex gap-3">
${links}
      </nav>
    </main>
  );
}
`;
}

export function mockCodebaseData(): CodebaseData {
  return {
    entities: [
      {
        key: "items",
        label: "Items",
        fields: [{ key: "title", label: "Title", type: "text", options: [] }, { key: "status", label: "Status", type: "select", options: ["Open", "Done"] }],
        seed: [{ values: [{ field: "title", value: "[Mock] First item" }, { field: "status", value: "Open" }] }],
      },
    ],
  };
}
