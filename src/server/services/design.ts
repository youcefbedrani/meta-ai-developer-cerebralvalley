import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { zipSync, strToU8 } from "fflate";
import { cssVariables, parseStoredBrand } from "@/lib/brand-kit";
import { featureMatrix } from "@/lib/competitors";
import { buildCodingPrompt, buildScreenPrompt, designEditSchema, designRequestSchema, DEVICE, screenFileName, suggestScreens, type DesignContext, type Platform } from "@/lib/design-prompt";
import { ConfigError, getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { refundCredits, reserveCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { getValidationSummary } from "@/server/data/experiments";
import { NotFoundError, UserFacingError } from "@/server/data/errors";
import { listCustomerLanguage } from "@/server/data/gold-mine";
import { getLatestBusinessModel, getLatestMvpPlan } from "@/server/data/planning";
import { requireProject } from "@/server/data/projects";
import { listCompetitors } from "@/server/data/research";
import type { UserId } from "@/server/data/user-id";
import { getDesignProvider } from "@/server/design";
import { enqueueResearch } from "@/server/jobs/queue";
import { enforceAiLimits } from "@/server/rate-limit";
import { buildSpecMarkdown } from "./build-kit";
import { getProjectContext } from "./project-context";

/*
 * MVP design with Google Stitch: screens are generated in the background (research queue, input.kind = "design"),
 * one credit reservation per screen so a failed screen refunds only itself.
 */

export const designCreditRef = (screenId: string) => `design_screen:${screenId}`;

export class DesignInProgressError extends UserFacingError {
  constructor() {
    super("Screens are already being designed for this project. Wait for them to finish.");
  }
}

/** Everything we know about the founder's product, shaped for design prompts. */
export async function getDesignContext(userId: UserId, projectId: string): Promise<{ ctx: DesignContext; sources: { research: boolean; mvpPlan: boolean; brand: boolean; quotes: number; competitors: number } }> {
  const { project, context } = await getProjectContext(userId, projectId);
  const [plan, quotes, competitors] = await Promise.all([getLatestMvpPlan(userId, project.id), listCustomerLanguage(userId, project.id), listCompetitors(userId, project.id)]);
  const brand = parseStoredBrand(project.brand);
  const r = context.research;
  const first = (list: { text: string }[] | undefined) => list?.[0]?.text ?? null;
  // Short quotes about the problem read best in UI copy.
  const words = quotes
    .filter((q) => q.clusterTitle !== "Praise for an existing tool")
    .map((q) => q.quote)
    .filter((q) => q.length <= 160)
    .slice(0, 6);
  const matrix = featureMatrix(competitors.map((c) => ({ ...c, sources: c.sources })));
  const ctx: DesignContext = {
    name: brand ? (brand.names[brand.chosen]?.name ?? brand.names[0].name) : project.name,
    description: project.description,
    summary: plan?.plan.productSummary ?? r?.summary ?? null,
    targetUser: plan?.plan.targetUser ?? first(r?.targetCustomer),
    problem: plan?.plan.problemStatement ?? first(r?.problem),
    differentiation: (r?.differentiation ?? []).map((d) => d.text).slice(0, 3),
    features: (plan?.plan.mustHave ?? []).map((f) => ({ feature: f.feature, why: f.why, acceptanceCriteria: f.acceptanceCriteria })),
    journeys: plan?.plan.userJourneys ?? [],
    customerWords: words,
    tableStakes: matrix.tableStakes,
    brand: brand ? { tagline: brand.tagline, voice: brand.voice, palette: brand.palette, fonts: brand.fonts, logo: brand.logo } : null,
    stack: plan?.plan.techNeeds.suggestedStack ?? [],
    dataModel: plan?.plan.techNeeds.dataModel ?? [],
  };
  return { ctx, sources: { research: !!r, mvpPlan: !!plan, brand: !!brand, quotes: quotes.length, competitors: competitors.length } };
}

export { suggestScreens };

export async function listDesignScreens(userId: UserId, projectId: string) {
  return getDb()
    .select()
    .from(schema.designScreens)
    .where(and(eq(schema.designScreens.projectId, projectId), eq(schema.designScreens.userId, userId), eq(schema.designScreens.archived, false)))
    .orderBy(asc(schema.designScreens.position), desc(schema.designScreens.createdAt));
}

export async function getDesignScreen(userId: UserId, screenId: string) {
  if (!/^[0-9a-f-]{36}$/.test(screenId)) return null;
  const [row] = await getDb().select().from(schema.designScreens).where(and(eq(schema.designScreens.id, screenId), eq(schema.designScreens.userId, userId))).limit(1);
  return row ?? null;
}

async function preflight(userId: UserId, projectId: string) {
  const project = await requireProject(userId, projectId);
  getDesignProvider(); // throws a ConfigError when Stitch isn't configured
  const redis = getIntegrationStatus("redis");
  if (!redis.configured) throw new ConfigError("redis", redis.missing);
  await enforceAiLimits(userId);
  const active = await getDb()
    .select({ id: schema.researchJobs.id })
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.projectId, project.id), inArray(schema.researchJobs.status, ["queued", "running"]), sql`${schema.researchJobs.input}->>'kind' = 'design'`))
    .limit(1);
  if (active.length) throw new DesignInProgressError();
  return project;
}

/** Creates the job and one row per screen, reserves credits per screen, then queues the job. */
async function queueScreens(userId: UserId, projectId: string, input: Record<string, unknown>, rows: Omit<typeof schema.designScreens.$inferInsert, "userId" | "projectId" | "jobId" | "provider">[]) {
  const db = getDb();
  const provider = getDesignProvider().name;
  const [job] = await db
    .insert(schema.researchJobs)
    .values({ userId, projectId, status: "queued", currentStage: "queued", creditsReserved: CREDIT_COSTS.design_screen * rows.length, input: { kind: "design", ...input } })
    .returning({ id: schema.researchJobs.id });
  const screens = await db
    .insert(schema.designScreens)
    .values(rows.map((r) => ({ ...r, userId, projectId, jobId: job.id, provider })))
    .returning({ id: schema.designScreens.id });
  const reserved: string[] = [];
  try {
    for (const s of screens) {
      await reserveCredits(userId, CREDIT_COSTS.design_screen, designCreditRef(s.id), "design_screen");
      reserved.push(s.id);
    }
  } catch (err) {
    for (const id of reserved) await refundCredits(userId, designCreditRef(id), "design could not start");
    await db.delete(schema.designScreens).where(eq(schema.designScreens.jobId, job.id));
    await db.delete(schema.researchJobs).where(eq(schema.researchJobs.id, job.id));
    throw err;
  }
  try {
    await enqueueResearch(job.id);
  } catch {
    for (const id of reserved) await refundCredits(userId, designCreditRef(id), "design could not be queued");
    await db.update(schema.designScreens).set({ status: "failed", error: "Could not queue the job." }).where(eq(schema.designScreens.jobId, job.id));
    await db.update(schema.researchJobs).set({ status: "failed", error: "Could not queue the design job. Your credits were refunded.", finishedAt: new Date() }).where(eq(schema.researchJobs.id, job.id));
    throw new ConfigError("redis", ["REDIS_URL (queue unavailable — is Redis running?)"]);
  }
  return { jobId: job.id, screenIds: screens.map((s) => s.id) };
}

/** Designs the chosen screens for web or mobile from the project's data. */
export async function startDesign(userId: UserId, projectId: string, raw: unknown) {
  const input = designRequestSchema.parse(raw);
  const project = await preflight(userId, projectId);
  const { ctx } = await getDesignContext(userId, project.id);
  const existing = await listDesignScreens(userId, project.id);
  const offset = existing.reduce((n, s) => Math.max(n, s.position + 1), 0);
  return queueScreens(
    userId,
    project.id,
    { platform: input.platform },
    input.screens.map((screen, i) => ({ name: screen.name, position: offset + i, device: DEVICE[input.platform], prompt: buildScreenPrompt(ctx, screen, input.platform) })),
  );
}

/** Changes one screen with a plain-language instruction. The result replaces it; the old version is archived. */
export async function startDesignEdit(userId: UserId, projectId: string, screenId: string, raw: unknown) {
  const { instruction } = designEditSchema.parse(raw);
  const project = await preflight(userId, projectId);
  const screen = await getDesignScreen(userId, screenId);
  if (!screen || screen.projectId !== project.id || screen.archived) throw new NotFoundError("Screen");
  if (screen.status !== "succeeded" || !screen.html) throw new UserFacingError("Only finished screens can be edited.");
  return queueScreens(userId, project.id, { mode: "edit" }, [{ name: screen.name, position: screen.position, device: screen.device, prompt: instruction, replacesId: screen.id }]);
}

/** The latest design job for the project (for progress polling). */
export async function getLatestDesignJob(userId: UserId, projectId: string) {
  const [row] = await getDb()
    .select({ id: schema.researchJobs.id, status: schema.researchJobs.status, error: schema.researchJobs.error })
    .from(schema.researchJobs)
    .where(and(eq(schema.researchJobs.projectId, projectId), eq(schema.researchJobs.userId, userId), sql`${schema.researchJobs.input}->>'kind' = 'design'`))
    .orderBy(desc(schema.researchJobs.createdAt))
    .limit(1);
  return row ?? null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project";

/** The project kit: designs + hand-off prompt + spec + brand + customer words, as one zip for any AI coding tool. */
export async function buildDesignExport(userId: UserId, projectId: string): Promise<{ filename: string; zip: Uint8Array; prompt: string }> {
  const project = await requireProject(userId, projectId);
  const screens = (await listDesignScreens(userId, project.id)).filter((s) => s.status === "succeeded" && s.html);
  const { ctx } = await getDesignContext(userId, project.id);
  const platform: Platform = screens.some((s) => s.device === "MOBILE") && !screens.some((s) => s.device === "DESKTOP") ? "mobile" : "web";
  const files = screens.map((s, i) => ({ name: s.name, file: screenFileName(i, s.name), html: s.html! }));
  const prompt = buildCodingPrompt(ctx, files, platform);
  const out: Record<string, Uint8Array> = {
    "PROMPT.md": strToU8(prompt),
    "CLAUDE.md": strToU8(`# ${ctx.name}\n\nThe full brief is in PROMPT.md. Read it, then docs/ and design/, before writing code. Build only the MVP scope it describes.\n`),
    "AGENTS.md": strToU8(`# ${ctx.name}\n\nThe full brief is in PROMPT.md. Read it, then docs/ and design/, before writing code. Build only the MVP scope it describes.\n`),
    "README.md": strToU8(
      [`# ${ctx.name}: project kit`, "", "Made with Startum.", "", "## Build it with an AI coding tool", "- **Claude Code:** open this folder in a terminal, run `claude`, then type: *Read PROMPT.md and build it.*", "- **Cursor / Windsurf:** open the folder and ask the agent to follow PROMPT.md.", "- **Lovable, Bolt, v0:** paste PROMPT.md and attach the files in design/.", "", "## What's inside", "- `PROMPT.md`: the brief for the coding agent", "- `design/`: one HTML file per screen (open them in a browser)", "- `docs/`: MVP spec, brand and customers' words", ""].join("\n"),
    ),
  };
  for (const f of files) out[`design/${f.file}`] = strToU8(f.html);
  for (const [path, content] of Object.entries(await designDocs(userId, project.id, ctx, project.decision))) out[`docs/${path}`] = strToU8(content);
  return { filename: `${slug(ctx.name)}-project-kit.zip`, zip: zipSync(out, { level: 6 }), prompt };
}

/** The docs that go with a design hand-off: MVP spec, brand and customers' words (paths relative to docs/). */
export async function designDocs(userId: UserId, projectId: string, ctx: DesignContext, decision: string | null): Promise<Record<string, string>> {
  const docs: Record<string, string> = {};
  const [project, plan, business, validation] = await Promise.all([requireProject(userId, projectId), getLatestMvpPlan(userId, projectId), getLatestBusinessModel(userId, projectId), getValidationSummary(userId, projectId)]);
  if (plan) docs["mvp-spec.md"] = buildSpecMarkdown({ projectName: ctx.name, plan: plan.plan, business: business?.model ?? null, validation, decision, generatedAt: plan.createdAt });
  const brand = parseStoredBrand(project.brand);
  if (brand) {
    docs["brand.md"] = [`# ${ctx.name} brand`, "", `Tagline: ${brand.tagline}`, `Tone: ${brand.voice.join(", ")}`, "", "## Colours", ...Object.entries(brand.palette).map(([k, v]) => `- ${k}: ${v}`), "", "## Fonts (Google Fonts)", `- Headings: ${brand.fonts.heading}`, `- Body: ${brand.fonts.body}`, "", "## CSS variables", "```css", cssVariables(brand), "```", ""].join("\n");
  }
  if (ctx.customerWords.length) docs["customer-language.md"] = ["# What customers say", "", "Verbatim quotes collected from public posts. Use their words in headlines and copy.", "", ...ctx.customerWords.map((q) => `> ${q}\n`)].join("\n");
  return docs;
}
