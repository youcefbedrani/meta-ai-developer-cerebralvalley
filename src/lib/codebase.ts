import type { Entity, SeedRow } from "@/lib/validation/codebase";

/*
 * The generated MVP codebase: a runnable Next.js (App Router) + Tailwind v4 app. Everything here is
 * deterministic; only the screen pages and the data model come from Muse Spark. Data lives in a JSON file
 * (src/lib/store.ts) so the app runs with `npm install && npm run dev`, locally or in StackBlitz, with no
 * database to set up. PROMPT.md tells an AI coding tool how to take it to production.
 */

export type BrandTokens = { primary: string; secondary: string; accent: string; surface: string; ink: string; heading: string; body: string };
export type GeneratedPage = { name: string; route: string; code: string };

export const pagePath = (route: string) => (route === "/" ? "src/app/page.tsx" : `src/app${route}/page.tsx`);

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "app";
const fontsHref = (t: BrandTokens) => `https://fonts.googleapis.com/css2?${[...new Set([t.heading, t.body])].map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&")}&display=swap`;

export function buildCodebaseFiles(input: {
  name: string;
  tokens: BrandTokens;
  pages: GeneratedPage[];
  entities: Entity[];
  seed: Record<string, SeedRow[]>;
  prompt: string;
  docs: Record<string, string>;
  designs: Record<string, string>;
}): Record<string, string> {
  const { name, tokens: t, pages, entities, seed } = input;
  const files: Record<string, string> = {};

  files["package.json"] = json({
    name: slug(name),
    version: "0.1.0",
    private: true,
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: { next: "^15.5.0", react: "^19.1.0", "react-dom": "^19.1.0" },
    devDependencies: { "@tailwindcss/postcss": "^4.1.0", tailwindcss: "^4.1.0", typescript: "^5.9.0", "@types/node": "^22.0.0", "@types/react": "^19.1.0", "@types/react-dom": "^19.1.0" },
  });
  files["tsconfig.json"] = json({
    compilerOptions: {
      target: "ES2022",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  });
  files["next-env.d.ts"] = `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n`;
  files["next.config.mjs"] = `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\n\nexport default nextConfig;\n`;
  files["postcss.config.mjs"] = `export default { plugins: { "@tailwindcss/postcss": {} } };\n`;
  files[".gitignore"] = ["node_modules", ".next", ".data", "*.log", ".env*.local", ""].join("\n");
  files[".stackblitzrc"] = json({ installDependencies: true, startCommand: "npm run dev" });

  // The same tokens the designs use (bg-primary, text-ink, font-heading …), as Tailwind v4 theme variables.
  files["src/app/globals.css"] = `@import "tailwindcss";

@theme {
  --color-primary: ${t.primary};
  --color-secondary: ${t.secondary};
  --color-accent: ${t.accent};
  --color-surface: ${t.surface};
  --color-ink: ${t.ink};
  --font-heading: "${t.heading}", ui-sans-serif, system-ui, sans-serif;
  --font-body: "${t.body}", ui-sans-serif, system-ui, sans-serif;
}

body {
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: var(--font-body);
}
`;
  files["src/app/layout.tsx"] = `import type { Metadata } from "next";
import "./globals.css";

// Pages read the JSON store, so render them on every request (always fresh data).
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: ${JSON.stringify(name)}, description: ${JSON.stringify(`${name}: MVP generated with Startum`)} };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href=${JSON.stringify(fontsHref(t))} />
      </head>
      <body className="min-h-screen bg-surface font-body text-ink antialiased">{children}</body>
    </html>
  );
}
`;

  files["src/data/seed.json"] = json(seed);
  files["src/lib/schema.ts"] = `/** The app's data model (generated from the MVP plan). The store accepts these entity keys. */
export const ENTITIES = ${JSON.stringify(entities, null, 2)} as const;

export type EntityKey = (typeof ENTITIES)[number]["key"];
`;
  files["src/lib/store.ts"] = `import { promises as fs } from "node:fs";
import path from "node:path";
import seed from "@/data/seed.json";

/*
 * A tiny JSON-file data store so the MVP runs with no database. Rows live in .data/db.json (created from
 * src/data/seed.json on first write). Swap it for Postgres when you go to production: see PROMPT.md.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any> & { id: string; createdAt: string };
type Db = Record<string, Row[]>;

const FILE = path.join(process.cwd(), ".data", "db.json");

async function load(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Db;
  } catch {
    return structuredClone(seed as unknown as Db);
  }
}

async function save(db: Db) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

/** All rows of an entity, newest first. */
export async function list(entity: string): Promise<Row[]> {
  const db = await load();
  return [...(db[entity] ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function get(entity: string, id: string): Promise<Row | null> {
  return (await list(entity)).find((r) => r.id === id) ?? null;
}

export async function count(entity: string): Promise<number> {
  return (await list(entity)).length;
}

export async function create(entity: string, data: Record<string, unknown>): Promise<Row> {
  const db = await load();
  const row: Row = { ...data, id: \`\${entity}_\${Date.now().toString(36)}\`, createdAt: new Date().toISOString() };
  db[entity] = [...(db[entity] ?? []), row];
  await save(db);
  return row;
}

export async function update(entity: string, id: string, data: Record<string, unknown>): Promise<void> {
  const db = await load();
  db[entity] = (db[entity] ?? []).map((r) => (r.id === id ? { ...r, ...data, id: r.id, createdAt: r.createdAt } : r));
  await save(db);
}

export async function remove(entity: string, id: string): Promise<void> {
  const db = await load();
  db[entity] = (db[entity] ?? []).filter((r) => r.id !== id);
  await save(db);
}
`;
  files["src/app/actions.ts"] = `"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { create, remove } from "@/lib/store";

/*
 * Form actions used by the pages: <form action={createRecord}> with a hidden "_entity" input, optional
 * "_redirect" (a path), and one input per field (name = field key).
 */

function done(formData: FormData) {
  revalidatePath("/", "layout");
  const to = formData.get("_redirect");
  if (typeof to === "string" && to.startsWith("/")) redirect(to);
}

export async function createRecord(formData: FormData) {
  const entity = String(formData.get("_entity") ?? "");
  if (!entity) throw new Error("The form needs a hidden _entity input");
  const data: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (!key.startsWith("_") && typeof value === "string") data[key] = value;
  });
  await create(entity, data);
  done(formData);
}

export async function deleteRecord(formData: FormData) {
  const entity = String(formData.get("_entity") ?? "");
  const id = String(formData.get("_id") ?? "");
  if (entity && id) await remove(entity, id);
  done(formData);
}
`;

  for (const p of pages) files[pagePath(p.route)] = p.code;
  if (!pages.some((p) => p.route === "/") && pages[0]) {
    files["src/app/page.tsx"] = `import { redirect } from "next/navigation";\n\nexport default function Home() {\n  redirect(${JSON.stringify(pages[0].route)});\n}\n`;
  }

  files["PROMPT.md"] = input.prompt;
  files["CLAUDE.md"] = `# ${name}\n\nThis is a generated MVP starter (Next.js App Router, Tailwind v4, JSON-file store). Read README.md and PROMPT.md first. Keep the screens in src/app matching the designs in design/.\n`;
  files["AGENTS.md"] = files["CLAUDE.md"];
  for (const [path, content] of Object.entries(input.docs)) files[`docs/${path}`] = content;
  for (const [path, content] of Object.entries(input.designs)) files[`design/${path}`] = content;
  files["README.md"] = [
    `# ${name}`,
    "",
    "MVP starter generated by [Startum](https://startum.website) with Meta's Muse Spark: the screens were designed as a clickable prototype, approved, then turned into this code.",
    "",
    "## Run it",
    "```bash",
    "npm install",
    "npm run dev",
    "```",
    "Open http://localhost:3000. Requires Node 20 or newer.",
    "",
    "## Screens",
    ...pages.map((p) => `- **${p.name}**: \`${p.route}\` (\`${pagePath(p.route)}\`)`),
    "",
    "## Data",
    entities.length ? `Entities: ${entities.map((e) => `\`${e.key}\``).join(", ")} (see \`src/lib/schema.ts\`). Sample rows are in \`src/data/seed.json\`; changes are saved to \`.data/db.json\`.` : "No entities yet.",
    "",
    "## Take it to production",
    "Open this folder in Claude Code (`claude`), Cursor or another AI coding tool and ask it to follow **PROMPT.md**: it has the full product brief (features, users, journeys, brand). Typical next steps:",
    "1. Replace `src/lib/store.ts` with a real database (e.g. Postgres + Drizzle) keeping the same functions.",
    "2. Add authentication to the sign-up / sign-in screens.",
    "3. Make each must-have feature in PROMPT.md work end to end, with tests.",
    "",
    "## What's inside",
    "- `src/app`: one page per approved screen",
    "- `src/lib/store.ts`, `src/app/actions.ts`: data store and form actions",
    "- `design/`: the approved prototype screens (HTML)",
    "- `docs/`: MVP spec, brand and customers' words",
    "",
  ].join("\n");
  return files;
}

/** Files to show first in the code viewer. */
export function codebaseFileOrder(paths: string[]): string[] {
  const rank = (p: string) => (p === "README.md" ? 0 : p.startsWith("src/app/") && p.endsWith("page.tsx") ? 1 : p.startsWith("src/") ? 2 : p.startsWith("design/") || p.startsWith("docs/") ? 4 : 3);
  return [...paths].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
