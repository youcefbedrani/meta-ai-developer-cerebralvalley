import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { buildCodebaseFiles, type BrandTokens, type GeneratedPage } from "@/lib/codebase";
import { buildCodingPrompt, screenFileName, type DesignContext } from "@/lib/design-prompt";
import { screenRoutes, screenSlug } from "@/lib/prototype";
import { codebaseDataSchema, normalizeDataModel, type Entity } from "@/lib/validation/codebase";
import { buildCodebaseDataPrompt, buildCodebasePagePrompt, CODEBASE_DATA_SYSTEM, CODEBASE_PAGE_SYSTEM, extractPageCode, mockCodebaseData, mockCodebasePage, screenBody, screenText } from "@/server/ai/prompts/codebase";
import { callStructured, callText } from "@/server/ai/run";
import { refundCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { unsafeToUserId, type UserId } from "@/server/data/user-id";
import { CODEBASE_SCHEMA_VERSION, codebaseCreditRef, type CodebaseContent } from "@/server/services/codebase";
import { designDocs, getDesignContext } from "@/server/services/design";

type Job = typeof schema.researchJobs.$inferSelect;
type Screen = { id: string; name: string; html: string; device: "MOBILE" | "DESKTOP" };

const PAGE_CONCURRENCY = 3;

function tokens(ctx: DesignContext): BrandTokens {
  const p = ctx.brand?.palette ?? { primary: "#4F46E5", secondary: "#0EA5E9", accent: "#F59E0B", background: "#F8FAFC", text: "#0F172A" };
  const f = ctx.brand?.fonts ?? { heading: "Inter", body: "Inter" };
  return { primary: p.primary, secondary: p.secondary, accent: p.accent, surface: p.background, ink: p.text, heading: f.heading, body: f.body };
}

/** A page that shows the approved design as is, for a screen whose conversion failed twice. */
function fallbackPage(file: string): string {
  return `/* The automatic conversion of this screen failed, so it shows the approved design for now.
   Ask your AI coding tool: "Rebuild this page from design/${file} as real components." */
export default function Page() {
  return <iframe title="Design" src="/designs/${file}" className="h-screen w-full border-0" />;
}
`;
}

async function writePage(userId: UserId, projectId: string, screen: Screen, route: string, routes: Record<string, string>, entities: Entity[]): Promise<string> {
  const prompt = buildCodebasePagePrompt({ screen: screen.name, route, routes, entities, body: screenBody(screen.html) });
  for (let attempt = 0; ; attempt++) {
    const { text } = await callText({
      userId,
      projectId,
      operation: "codebase_page",
      tier: "smart",
      system: CODEBASE_PAGE_SYSTEM,
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 16_000,
      timeoutMs: 300_000,
      mock: () => mockCodebasePage(screen.name, routes),
    });
    try {
      return extractPageCode(text);
    } catch (err) {
      if (attempt >= 1) throw err;
    }
  }
}

/** Runs `fn` over `items`, at most `limit` at a time, in order. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

/**
 * The approved prototype → a runnable Next.js codebase: one Muse Spark call for the data model (with seed
 * rows), then one call per screen to convert its design into a page, three at a time. A screen whose
 * conversion fails twice falls back to embedding its design, so one bad page never sinks the whole build.
 */
export async function runCodebaseJob(job: Job): Promise<void> {
  const db = getDb();
  const userId = unsafeToUserId(job.userId);
  const stage = (currentStage: string) => db.update(schema.researchJobs).set({ currentStage }).where(eq(schema.researchJobs.id, job.id));
  await db.update(schema.researchJobs).set({ status: "running", startedAt: new Date(), currentStage: "Reading the approved screens", error: null }).where(eq(schema.researchJobs.id, job.id));
  try {
    const ids = Array.isArray(job.input?.screenIds) ? (job.input.screenIds as string[]) : [];
    const rows = ids.length
      ? await db
          .select({ id: schema.designScreens.id, name: schema.designScreens.name, html: schema.designScreens.html, device: schema.designScreens.device, position: schema.designScreens.position })
          .from(schema.designScreens)
          .where(and(eq(schema.designScreens.projectId, job.projectId), eq(schema.designScreens.userId, job.userId), inArray(schema.designScreens.id, ids)))
      : [];
    const screens: Screen[] = rows
      .filter((r) => r.html)
      .sort((a, b) => a.position - b.position)
      .map((r) => ({ id: r.id, name: r.name, html: r.html!, device: r.device }));
    if (!screens.length) throw new Error("The approved screens are gone.");
    const [project] = await db.select({ decision: schema.projects.decision }).from(schema.projects).where(eq(schema.projects.id, job.projectId));
    const { ctx } = await getDesignContext(userId, job.projectId);

    await stage("Designing the data model");
    const data = await callStructured({
      userId,
      projectId: job.projectId,
      operation: "codebase_data",
      tier: "smart",
      schema: codebaseDataSchema,
      system: CODEBASE_DATA_SYSTEM,
      prompt: buildCodebaseDataPrompt(ctx, screens.map((s) => ({ name: s.name, text: screenText(s.html) }))),
      mock: mockCodebaseData,
      maxOutputTokens: 6_000,
    });
    const { entities, seed } = normalizeDataModel(data);

    const routes = screenRoutes(screens.map((s) => s.name));
    const files = screens.map((s, i) => screenFileName(i, s.name));
    let finished = 0;
    const failedScreens: string[] = [];
    await stage(`Writing the pages (0 of ${screens.length})`);
    const pages: GeneratedPage[] = await pool(screens, PAGE_CONCURRENCY, async (screen, i) => {
      const route = routes[screenSlug(screen.name)];
      let code: string;
      try {
        code = await writePage(userId, job.projectId, screen, route, routes, entities);
      } catch (err) {
        console.error(`[codebase] page "${screen.name}" failed:`, err instanceof Error ? err.message : err);
        failedScreens.push(screen.name);
        code = fallbackPage(files[i]);
      }
      finished++;
      await stage(`Writing the pages (${finished} of ${screens.length})`);
      return { name: screen.name, route, code };
    });
    if (failedScreens.length === screens.length) throw new Error("No page could be generated.");

    await stage("Packaging the project");
    const designs = Object.fromEntries(screens.map((s, i) => [files[i], s.html]));
    const platform = screens.every((s) => s.device === "MOBILE") ? "mobile" : "web";
    const generated = buildCodebaseFiles({
      name: ctx.name,
      tokens: tokens(ctx),
      pages,
      entities,
      seed,
      prompt: buildCodingPrompt(ctx, screens.map((s, i) => ({ name: s.name, file: files[i] })), platform),
      docs: await designDocs(userId, job.projectId, ctx, project?.decision ?? null),
      designs,
    });
    // Fallback pages embed their design from public/.
    for (const [i, s] of screens.entries()) if (failedScreens.includes(s.name)) generated[`public/designs/${files[i]}`] = s.html;

    const content: CodebaseContent = { name: ctx.name, files: generated, screens: pages.map((p) => ({ name: p.name, route: p.route })), entities: entities.map((e) => e.key), failedScreens };
    await db.transaction(async (tx) => {
      await tx.insert(schema.reports).values({
        projectId: job.projectId,
        researchJobId: job.id,
        type: "codebase",
        schemaVersion: CODEBASE_SCHEMA_VERSION,
        content: content as unknown as Record<string, unknown>,
        summary: `${pages.length} pages, ${entities.length} entities, ${Object.keys(generated).length} files`,
      });
      await tx.update(schema.researchJobs).set({ status: "succeeded", currentStage: null, finishedAt: new Date() }).where(eq(schema.researchJobs.id, job.id));
    });
  } catch (err) {
    console.error(`[codebase] job ${job.id} failed:`, err instanceof Error ? err.message : err);
    await db
      .update(schema.researchJobs)
      .set({ status: "failed", currentStage: null, error: "The code couldn't be generated. Your credits were refunded; please try again.", finishedAt: new Date() })
      .where(eq(schema.researchJobs.id, job.id));
    await refundCredits(userId, codebaseCreditRef(job.id), "codebase failed");
  }
}
