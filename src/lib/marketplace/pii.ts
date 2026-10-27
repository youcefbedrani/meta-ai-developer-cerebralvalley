/*
 * Readiness check for public teasers: they must not contain personal data
 * (emails, phone numbers, the seller's own name/email) or private links.
 */

export type PiiIssue = { kind: "email" | "phone" | "url" | "personal_name" | "handle"; match: string };

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?\d[\s().-]?){8,}\d/g;
const URL = /\b(?:https?:\/\/|www\.)\S+/gi;
const HANDLE = /(?:^|\s)@[A-Za-z0-9_]{3,}/g;

export function findPersonalData(text: string, opts: { names?: string[]; emails?: string[] } = {}): PiiIssue[] {
  const issues: PiiIssue[] = [];
  for (const m of text.match(EMAIL) ?? []) issues.push({ kind: "email", match: m });
  for (const m of text.match(PHONE) ?? []) if (m.replace(/\D/g, "").length >= 9) issues.push({ kind: "phone", match: m.trim() });
  for (const m of text.match(URL) ?? []) issues.push({ kind: "url", match: m });
  for (const m of text.match(HANDLE) ?? []) issues.push({ kind: "handle", match: m.trim() });
  const lower = text.toLowerCase();
  for (const n of opts.names ?? []) {
    const name = n.trim();
    // Only full names (two+ words) or long single names, to avoid flagging common words.
    if ((name.includes(" ") || name.length >= 6) && lower.includes(name.toLowerCase())) issues.push({ kind: "personal_name", match: name });
  }
  for (const e of opts.emails ?? []) if (e && lower.includes(e.toLowerCase()) && !issues.some((i) => i.match.toLowerCase() === e.toLowerCase())) issues.push({ kind: "email", match: e });
  return issues;
}
