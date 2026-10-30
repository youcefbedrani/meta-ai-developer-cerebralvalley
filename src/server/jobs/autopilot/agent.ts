import "server-only";
import { tool } from "ai";
import { randomBytes } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { autopilotVerdictSchema, type AutopilotEvent, type AutopilotVerdict } from "@/lib/validation/autopilot";
import { asData, callAgent, UNTRUSTED_DATA_RULE } from "@/server/ai/run";
import { refundCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { createExperiment } from "@/server/data/experiments";
import { listCustomerLanguage } from "@/server/data/gold-mine";
import { createLandingPage, listLandingPages } from "@/server/data/landing-pages";
import { getLatestBusinessModel, getLatestMvpPlan } from "@/server/data/planning";
import { getLatestValidationReport, listCompetitors } from "@/server/data/research";
import { unsafeToUserId, type UserId } from "@/server/data/user-id";
import { getLatestValidationRun, getVerdictData } from "@/server/data/verdict";
import { getSearchProvider } from "@/server/search";
import { getProjectContext } from "@/server/services/project-context";
import { generateBusinessModel, generateMvpPlan } from "@/server/services/planning";
import { generateLaunchPlaybook } from "@/server/services/launch-playbook";
import { startFullValidation } from "@/server/services/research";
import { generateLandingCopy } from "@/server/services/validation";
import { generateBrandKit, getBrandKit } from "@/server/services/brand";
import { generateBrandVisuals, listBrandAssets } from "@/server/services/brand-visuals";
import { isImageConfigured } from "@/server/ai/image";

export const autopilotCreditRef = (runId: string) => `autopilot:${runId}`;

const MAX_STEPS = 20;
const MAX_SEARCHES = 4;
const VALIDATION_WAIT_MS = 15 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const SYSTEM = `You are Startum's Validation Autopilot, an autonomous analyst that decides whether a micro-SaaS idea is worth building.
You work by calling tools. Typical order: read_project → run_market_validation (only if there is no research yet) → read_evidence → web_search for the 1-3 most important open questions → generate_business_model and generate_mvp_plan if the idea looks viable → design_brand (name, palette, logo, hero image, ads) → create_landing_page to set up a waitlist test → create_launch_playbook (stages, sales, metrics and build plan) → submit_verdict. For a weak idea, skip the plans, brand and page.
Rules:
- Base the verdict only on what tools returned. Every reason must cite URLs that appeared in tool results; never invent a URL.
- Be honest: "drop" or "pivot" are good outcomes when the evidence is weak. Don't build plans for an idea you will drop.
- Before each tool call, say in one short sentence what you are doing and why (the founder watches this live).
- Call submit_verdict exactly once, at the end. If it is rejected, fix the problem and call it again.
${UNTRUSTED_DATA_RULE}`;

/** Appends events to the run's trace; each append is written straight away so the page can show it live. */
function traceFor(runId: string) {
  const events: AutopilotEvent[] = [];
  const db = getDb();
  const save = () => db.update(schema.autopilotRuns).set({ trace: events }).where(eq(schema.autopilotRuns.id, runId));
  // Where the current model step's events start: its text arrives only when the step ends, after its tools ran.
  let stepStart = 0;
  return {
    events,
    async add(e: Omit<AutopilotEvent, "at">) {
      events.push({ at: new Date().toISOString(), ...e });
      await save();
    },
    /** Sets the live detail line of the latest call to `tool` (e.g. research progress) instead of adding events. */
    async setDetail(tool: string, detail: string) {
      const call = events.findLast((e) => e.kind === "tool_call" && e.tool === tool);
      if (!call) return;
      call.detail = detail;
      await save();
    },
    /** Ends a model step, placing its text before the tool calls it introduced. */
    async endStep(text: string) {
      if (text) events.splice(stepStart, 0, { at: events[stepStart]?.at ?? new Date().toISOString(), kind: "thought", title: clip(text, 400) });
      stepStart = events.length;
      await save();
    },
  };
}

/** Wraps a tool body: trace the call and its result, and turn failures into a result the agent can react to. */
function traced<I, O>(trace: ReturnType<typeof traceFor>, name: string, title: (input: I) => string, summary: (out: O) => string, fn: (input: I) => Promise<O>) {
  return async (input: I): Promise<O | { error: string }> => {
    const started = Date.now();
    await trace.add({ kind: "tool_call", tool: name, title: title(input) });
    try {
      const out = await fn(input);
      await trace.add({ kind: "tool_result", tool: name, title: summary(out), durationMs: Date.now() - started });
      return out;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await trace.add({ kind: "error", tool: name, title: clip(message, 300), durationMs: Date.now() - started });
      return { error: message };
    }
  };
}

const normalizeUrl = (u: string) => u.trim().replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();

/** Keeps only reasons whose citations the run actually saw; returns how many reasons were dropped. */
export function verifyCitations(verdict: z.output<typeof autopilotVerdictSchema>, seen: Set<string>): AutopilotVerdict {
  const reasons = verdict.reasons
    .map((r) => ({ ...r, sourceUrls: r.sourceUrls.filter((u) => seen.has(normalizeUrl(u))) }))
    .filter((r) => r.sourceUrls.length > 0);
  return { ...verdict, reasons, droppedReasons: verdict.reasons.length - reasons.length };
}

async function waitForValidation(userId: UserId, projectId: string, onProgress: (label: string) => Promise<void>) {
  const deadline = Date.now() + VALIDATION_WAIT_MS;
  let last = "";
  while (Date.now() < deadline) {
    const run = await getLatestValidationRun(userId, projectId);
    if (!run) throw new Error("The validation run disappeared.");
    const label = run.jobs.map((j, i) => `${["Research", "Competitors", "Market voices"][i] ?? "Step"}: ${j.status === "running" && j.currentStage ? j.currentStage : j.status}`).join(" · ");
    if (label !== last) {
      last = label;
      await onProgress(label);
    }
    if (!run.active) return run.jobs;
    await sleep(5_000);
  }
  throw new Error("Market validation is taking longer than 15 minutes; it keeps running in the background.");
}

export async function runAutopilot(runId: string): Promise<void> {
  const db = getDb();
  const [run] = await db.select().from(schema.autopilotRuns).where(eq(schema.autopilotRuns.id, runId)).limit(1);
  if (!run || run.status !== "queued") return;
  await db.update(schema.autopilotRuns).set({ status: "running", startedAt: new Date() }).where(eq(schema.autopilotRuns.id, runId));

  const userId = unsafeToUserId(run.userId);
  const projectId = run.projectId;
  const trace = traceFor(runId);
  const seen = new Set<string>();
  const see = (url: string | null | undefined) => url && seen.add(normalizeUrl(url));
  let searches = 0;
  // The model sometimes repeats a query (even in parallel): answer repeats from the first call, free.
  const searchCache = new Map<string, Promise<{ title: string; url: string; snippet: string }[]>>();
  let verdict: AutopilotVerdict | null = null;

  const tools = {
    read_project: tool({
      description: "Read the project: idea, description, whether research exists, competitors found, experiments, and which plans already exist.",
      inputSchema: z.object({}),
      execute: traced(
        trace,
        "read_project",
        () => "Reading the project",
        (o: { hasResearch: boolean }) => (o.hasResearch ? "Project has research already" : "No research yet"),
        async () => {
          const { hasResearch, context } = await getProjectContext(userId, projectId);
          const [business, mvp, pages] = await Promise.all([getLatestBusinessModel(userId, projectId), getLatestMvpPlan(userId, projectId), listLandingPages(userId, projectId)]);
          return {
            name: context.name,
            description: context.description,
            idea: context.idea,
            hasResearch,
            competitors: context.competitors.length,
            experiments: context.experiments,
            hasBusinessModel: !!business,
            hasMvpPlan: !!mvp,
            landingPages: pages.length,
          };
        },
      ),
    }),

    run_market_validation: tool({
      description:
        "Run Startum's full market validation (web research with a cited report, competitor scan, market voices from forums). Takes 3-6 minutes. Only use when the project has no research yet.",
      inputSchema: z.object({}),
      execute: traced(
        trace,
        "run_market_validation",
        () => "Starting market research, competitor scan and market voices",
        (o: { succeeded: number; failed: string[] }) => `${o.succeeded} of 3 research steps finished${o.failed.length ? `, ${o.failed.length} failed` : ""}`,
        async () => {
          const active = await getLatestValidationRun(userId, projectId);
          if (!active?.active) await startFullValidation(userId, projectId);
          const jobs = await waitForValidation(userId, projectId, (label) => trace.setDetail("run_market_validation", label));
          return { succeeded: jobs.filter((j) => j.status === "succeeded").length, failed: jobs.filter((j) => j.status === "failed").map((j) => j.error ?? "unknown error") };
        },
      ),
    }),

    read_evidence: tool({
      description:
        "Read the research evidence: report summary and ratings, statements with their source URLs, competitors with verified pricing, real customer quotes from forums, and Startum's rule-based scorecard.",
      inputSchema: z.object({}),
      execute: traced(
        trace,
        "read_evidence",
        () => "Reading the evidence",
        (o: { sources: number; quotes: number; competitors: number }) => `${o.sources} sources, ${o.competitors} competitors, ${o.quotes} customer quotes`,
        async () => {
          const [report, competitors, quotes, scorecard] = await Promise.all([
            getLatestValidationReport(userId, projectId),
            listCompetitors(userId, projectId),
            listCustomerLanguage(userId, projectId),
            getVerdictData(userId, projectId),
          ]);
          if (!report) throw new Error("No research report yet. Run run_market_validation first.");
          const urlOf = (key: string) => report.sources.get(key)?.url ?? null;
          for (const s of report.sources.values()) see(s.url);
          const statements = Object.entries(report.report.sections).flatMap(([section, items]) =>
            items.slice(0, 4).map((s) => ({ section, kind: s.kind, text: clip(s.text, 300), urls: s.sources.map(urlOf).filter(Boolean) })),
          );
          const comp = competitors.slice(0, 10).map((c) => {
            see(c.website);
            see(c.pricingSource?.url);
            c.sources.forEach((s) => see(s.url));
            return { name: c.name, type: c.type, website: c.website, verifiedPricing: c.pricingSource ? clip(JSON.stringify(c.pricing), 200) : null, pricingUrl: c.pricingSource?.url ?? null };
          });
          const voices = quotes.slice(0, 15).map((q) => {
            see(q.url);
            return { theme: q.clusterTitle, quote: clip(q.quote, 280), platform: q.platform, url: q.url };
          });
          return {
            evidence: asData(
              "evidence",
              JSON.stringify({ summary: report.report.summary, ratings: report.report.ratings, openQuestions: report.report.openQuestions, statements, competitors: comp, customerQuotes: voices }),
            ),
            scorecard: scorecard ? { decision: scorecard.verdict.decision, score: scorecard.verdict.score, headline: scorecard.verdict.headline } : null,
            sources: report.sources.size,
            competitors: comp.length,
            quotes: voices.length,
          };
        },
      ),
    }),

    web_search: tool({
      description: `Search the web to check one specific open question (demand, pricing, a competitor). At most ${MAX_SEARCHES} searches per run.`,
      inputSchema: z.object({ query: z.string().min(3).max(200), why: z.string().max(200) }),
      execute: traced(
        trace,
        "web_search",
        (i) => `Searching: “${i.query}”`,
        (o: { results: unknown[] }) => `${o.results.length} results`,
        async ({ query }) => {
          const key = query.trim().toLowerCase();
          let pending = searchCache.get(key);
          if (!pending) {
            if (++searches > MAX_SEARCHES) throw new Error(`Search limit reached (${MAX_SEARCHES}). Decide with the evidence you have.`);
            pending = getSearchProvider()
              .search(query, { maxResults: 5 })
              .then((results) =>
                results.map((r) => {
                  see(r.url);
                  return { title: r.title, url: r.url, snippet: asData("snippet", clip(r.snippet, 400)) };
                }),
              );
            searchCache.set(key, pending);
          }
          return { results: await pending };
        },
      ),
    }),

    generate_business_model: tool({
      description: "Generate pricing tiers and a revenue model anchored on verified competitor prices. Needs research first.",
      inputSchema: z.object({}),
      execute: traced(
        trace,
        "generate_business_model",
        () => "Designing the business model",
        () => "Business model saved",
        async () => clip(JSON.stringify(await generateBusinessModel(userId, projectId)), 2_500),
      ),
    }),

    generate_mvp_plan: tool({
      description: "Generate a lean MVP plan (must-haves, later items, milestones). Use after the business model, only for ideas worth building.",
      inputSchema: z.object({}),
      execute: traced(
        trace,
        "generate_mvp_plan",
        () => "Planning the MVP",
        () => "MVP plan saved",
        async () => clip(JSON.stringify(await generateMvpPlan(userId, projectId)), 2_500),
      ),
    }),

    design_brand: tool({
      description:
        "Create the brand: a Brand Kit (names, tagline, palette, fonts) if there is none, then brand visuals with Meta Muse Image (logo mark cut out with SAM 3.1, landing hero, ads per channel). Only for ideas worth testing.",
      inputSchema: z.object({}),
      execute: traced(
        trace,
        "design_brand",
        () => "Designing the brand and its visuals",
        (o: { name: string; visuals: number }) => `Brand “${o.name}” with ${o.visuals} visuals (logo, hero, ads)`,
        async () => {
          const kit = (await getBrandKit(userId, projectId)) ?? (await generateBrandKit(userId, projectId));
          const visuals = isImageConfigured() ? await generateBrandVisuals(userId, projectId) : [];
          return { name: kit.names[kit.chosen]?.name ?? kit.names[0].name, tagline: kit.tagline, visuals: visuals.length };
        },
      ),
    }),

    create_launch_playbook: tool({
      description:
        "Write the launch playbook: six stages from validation to growth with exit gates, a founder-led sales playbook, SaaS metrics and revenue maths, retention and a week-by-week build plan. Use last, after the plans, brand and landing page, only for ideas worth building.",
      inputSchema: z.object({}),
      execute: traced(
        trace,
        "create_launch_playbook",
        () => "Writing the launch playbook",
        (o: { northStar: string; customersFor10k: number }) => `Playbook saved: ${o.northStar} (${o.customersFor10k} customers for $10k MRR)`,
        async () => {
          const { playbook, math } = await generateLaunchPlaybook(userId, projectId);
          return { northStar: playbook.northStar.goal, motion: playbook.sales.motion, customersFor10k: math.milestones[math.milestones.length - 1].customers, gates: playbook.stages.map((st) => `${st.stage}: ${st.exitCriteria[0]}`) };
        },
      ),
    }),

    create_landing_page: tool({
      description: "Write landing page copy from the research and save it as an unpublished waitlist page with a tracked experiment, so the founder can test demand.",
      inputSchema: z.object({
        hypothesis: z.string().min(10).max(500).describe("What the waitlist test should prove"),
        successCriteria: z.string().min(5).max(300).describe("A measurable bar, e.g. '≥ 8% of visitors join the waitlist'"),
      }),
      execute: traced(
        trace,
        "create_landing_page",
        () => "Writing the landing page and setting up a waitlist test",
        (o: { headline: string }) => `Landing page draft saved: “${clip(o.headline, 120)}”`,
        async ({ hypothesis, successCriteria }) => {
          const [copy, brand, assets] = await Promise.all([generateLandingCopy(userId, projectId), getBrandKit(userId, projectId), listBrandAssets(userId, projectId)]);
          const hero = assets.find((a) => a.kind === "hero");
          // Same defaults as the editor: the Brand Kit theme and logo when there is one, plus the newest hero image.
          const content = { ...copy, style: brand ? { theme: "brand", logo: { show: true, source: "brand" as const, shape: "rounded" as const }, ...(hero ? { heroImageId: hero.id } : {}) } : undefined };
          const exp = await createExperiment(userId, projectId, { type: "waitlist", title: "Waitlist landing page (Autopilot)", hypothesis, successCriteria });
          const base = (content.headline || "startum").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) || "page";
          const page = await createLandingPage(userId, projectId, { content, slug: `${base}-${randomBytes(3).toString("hex")}`, experimentId: exp.id });
          return { pageId: page.id, headline: content.headline };
        },
      ),
    }),

    submit_verdict: tool({
      description: "Finish the run with a Build / Pivot / Drop verdict. Each reason must cite source URLs returned by earlier tools.",
      inputSchema: autopilotVerdictSchema,
      execute: async (input) => {
        const checked = verifyCitations(input, seen);
        if (checked.reasons.length < 2) {
          await trace.add({ kind: "error", tool: "submit_verdict", title: "Verdict rejected: reasons must cite URLs from the evidence" });
          return { accepted: false, problem: "Fewer than 2 reasons cite URLs that appeared in tool results. Cite real URLs from read_evidence or web_search." };
        }
        verdict = checked;
        await trace.add({ kind: "verdict", tool: "submit_verdict", title: `${checked.decision.toUpperCase()} · ${checked.confidence}% confidence`, detail: checked.headline });
        return { accepted: true };
      },
    }),
  };

  try {
    const goal = run.goal ? `\nThe founder's goal for this run: ${asData("goal", run.goal)}` : "";
    await callAgent({
      userId,
      projectId,
      operation: "autopilot",
      tier: "smart",
      system: SYSTEM,
      prompt: `Validate this project end to end and decide Build, Pivot or Drop.${goal}`,
      tools,
      maxSteps: MAX_STEPS,
      stopWhen: () => verdict !== null,
      maxOutputTokens: 4_000,
      onStep: (step) => trace.endStep(step.text.trim()),
      mock: async () => {
        await trace.add({ kind: "thought", title: "Mock run: no AI provider configured." });
        verdict = { decision: "pivot", confidence: 40, headline: "Mock verdict (AI_PROVIDER=mock)", reasons: [], risks: [], nextSteps: ["Configure a real AI provider"], pivotIdea: null };
      },
    });
    if (!verdict) throw new Error("The agent stopped before giving a verdict.");
    await db.update(schema.autopilotRuns).set({ status: "succeeded", verdict, finishedAt: new Date() }).where(eq(schema.autopilotRuns.id, runId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Autopilot failed.";
    await trace.add({ kind: "error", title: clip(message, 300) }).catch(() => {});
    await db.update(schema.autopilotRuns).set({ status: "failed", error: clip(message, 500), finishedAt: new Date() }).where(eq(schema.autopilotRuns.id, runId));
    await refundCredits(userId, autopilotCreditRef(runId), "autopilot failed");
  }
}

/** Marks runs orphaned by a worker crash as failed and refunds them. */
export async function recoverStaleAutopilotRuns(olderThanMinutes = 40): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const stale = await getDb()
    .update(schema.autopilotRuns)
    .set({ status: "failed", error: "The run stopped unexpectedly. Your credits were refunded.", finishedAt: new Date() })
    .where(and(inArray(schema.autopilotRuns.status, ["queued", "running"]), lt(schema.autopilotRuns.updatedAt, cutoff)))
    .returning({ id: schema.autopilotRuns.id, userId: schema.autopilotRuns.userId });
  for (const run of stale) await refundCredits(unsafeToUserId(run.userId), autopilotCreditRef(run.id), "autopilot timed out");
  return stale.length;
}
