/*
 * Ad-policy pre-check. Flags wording that ad platforms commonly restrict or
 * reject, so the founder reviews it before publishing. It's a warning list,
 * not legal advice and not a guarantee of approval.
 */

const RULES: { category: string; pattern: RegExp; advice: string }[] = [
  { category: "Guarantee", pattern: /\b(guarantee[ds]?|100\s?%|risk[- ]free|never fails?|always works|instant results)\b/i, advice: "Avoid promising outcomes. Describe what the product does instead." },
  { category: "Financial claim", pattern: /\b(get rich|passive income|double your (money|income|revenue)|financial freedom|make money fast|earn \$\s?\d[\d,]*|\d+x (your )?(revenue|income|roi))\b/i, advice: "Income and financial claims are restricted on most ad platforms." },
  { category: "Health claim", pattern: /\b(cures?|cured|weight loss|lose \d+\s?(lbs|kg|pounds)|clinically proven|diagnos\w*|heals?|treats? (anxiety|depression|disease|pain))\b/i, advice: "Health claims need substantiation and are heavily restricted." },
  { category: "Personal attribute", pattern: /\b(are you|you're|you are|for) (overweight|fat|depressed|diabetic|in debt|broke|single|gay|lesbian|christian|muslim|jewish|disabled|pregnant|old|unemployed)\b/i, advice: "Don't imply you know the reader's personal characteristics (health, finances, religion, sexuality…)." },
  { category: "Before/after", pattern: /\bbefore (and|&) after\b/i, advice: "Before/after framing is restricted for many categories." },
  { category: "Unverifiable superlative", pattern: /(#1\b|\bnumber one\b|\bbest in the world\b|\bworld'?s best\b|\bthe best\b)/i, advice: "Superlatives need proof. Use specific, verifiable benefits." },
  { category: "Fake urgency", pattern: /\b(only \d+ (spots|seats) left|last chance|ends tonight|act now)\b/i, advice: "Only use real deadlines and limits." },
];

export type PolicyWarning = { category: string; match: string; advice: string };

export function policyCheck(text: string): PolicyWarning[] {
  const out: PolicyWarning[] = [];
  for (const r of RULES) {
    const m = text.match(r.pattern);
    if (m) out.push({ category: r.category, match: m[0], advice: r.advice });
  }
  return out;
}

/** All string leaves of a value (for checking structured assets). */
export function collectText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectText).join("\n");
  if (value && typeof value === "object") return Object.values(value).map(collectText).join("\n");
  return "";
}

export function policyWarningsFor(value: unknown): string[] {
  return policyCheck(collectText(value)).map((w) => `${w.category}: “${w.match}”. ${w.advice}`);
}
