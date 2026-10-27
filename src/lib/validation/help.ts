import { z } from "zod";

export const helpQuestionSchema = z.object({
  question: z.string().trim().min(3, "Ask a question").max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(3000) }))
    .max(8)
    .default([]),
  pathname: z.string().max(300).default("/app"),
});

export const helpAnswerSchema = z.object({
  answer: z.string().max(3000),
  links: z.array(z.object({ label: z.string().max(60), href: z.string().max(200) })).max(3),
});
export type HelpAnswer = z.output<typeof helpAnswerSchema>;

const STATIC_PREFIXES = ["/app/guide", "/app/resources", "/app/gold-mine", "/app/ideas", "/app/projects", "/app/research", "/app/lab", "/app/marketing", "/app/settings"];
const PROJECT_LINK = /^\/app\/projects\/([0-9a-f-]{36})(\/[a-z-]+)?(#[a-z0-9-]+)?$/;

/**
 * Keeps only in-app links the assistant may suggest. A project link must
 * point at the project the user is currently viewing.
 */
export function safeHelpLinks(links: HelpAnswer["links"], projectId: string | null): HelpAnswer["links"] {
  return links.filter((l) => {
    if (!l.href.startsWith("/app") || l.href.includes("//") || l.href.includes("..")) return false;
    const m = l.href.match(PROJECT_LINK);
    if (m) return m[1] === projectId;
    return l.href === "/app" || STATIC_PREFIXES.some((p) => l.href === p || l.href.startsWith(`${p}/`) || l.href.startsWith(`${p}#`));
  });
}

/** Project id from a pathname like /app/projects/<uuid>/research. */
export function projectIdFromPath(pathname: string): string | null {
  return pathname.match(/^\/app\/projects\/([0-9a-f-]{36})/)?.[1] ?? null;
}
