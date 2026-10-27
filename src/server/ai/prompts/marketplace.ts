import type { Teaser } from "@/lib/validation/marketplace";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const TEASER_PROMPT_VERSION = "marketplace-teaser.v1";

export const TEASER_SYSTEM = `You write the PUBLIC teaser for a validated software project that its founder is selling on a marketplace.
Rules:
- The teaser is public, so it must not give the project away. Describe the problem, market, solution approach and highlights at a high level.
- NEVER include: personal data (names, emails, phone numbers, social handles), URLs, the landing page address, verbatim customer quotes, competitor names, exact pricing tests, or anything a reader could copy to rebuild the project without buying it.
- Never invent metrics, revenue, users or traction. Highlights may only describe what the provided project data and verified_metrics show, at a high level (e.g. "Research report with 14 cited sources").
- idealBuyer: who would benefit most from acquiring it (e.g. "A B2B SaaS operator already selling to agencies").
- Plain, factual tone. No hype.
- ${UNTRUSTED_DATA_RULE}`;

export function buildTeaserPrompt(input: { project: unknown; metrics: unknown; level: string; licenseType: string; assets: string[] }) {
  return `Write the public teaser.

${asData("validation_level", input.level)}

${asData("verified_metrics", input.metrics)}

${asData("license_type", input.licenseType)}

${asData("included_assets", input.assets)}

${asData("project", input.project)}`;
}

export function mockTeaser(title: string): Teaser {
  return {
    title: `[Mock] ${title}`.slice(0, 100),
    problem: "[Mock] A specific, recurring workflow problem for small teams, described at a high level.",
    market: "[Mock] Small businesses that handle this task manually each week.",
    solution: "[Mock] A focused tool that automates the core workflow.",
    highlights: ["[Mock] Research report with cited sources", "[Mock] Customer pain documented"],
    idealBuyer: "[Mock] An operator already selling software to small teams.",
  };
}
