/**
 * End-to-end run of every AI feature on the configured provider, as the local demo admin: one idea from the
 * Idea Finder all the way to a marketplace teaser. Needs Postgres, Redis and the worker (`pnpm worker`) for the
 * research and pain-mining jobs. Prints PASS/FAIL per step and the real token cost from ai_usage_logs.
 *   pnpm e2e:ai                 everything
 *   pnpm e2e:ai -- --skip=gold  skip steps whose name starts with "gold" (comma-separated prefixes)
 *   pnpm e2e:ai -- --only=gold  only the Gold Mine flow
 * Local data only: refuses to run unless DATABASE_URL points at localhost.
 */
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { getDb, schema } from "@/server/db/client";
import { unsafeToUserId, type UserId } from "@/server/data/user-id";
import { generateIdeas } from "@/server/services/ideas";
import { convertIdeaToProject } from "@/server/data/ideas";
import { startFullValidation } from "@/server/services/research";
import { generateBusinessModel, generateMvpPlan } from "@/server/services/planning";
import { generateBrandKit } from "@/server/services/brand";
import { analyzeInterviewNotes, generateInterviewScript, generateLandingCopy } from "@/server/services/validation";
import { createExperiment } from "@/server/data/experiments";
import { generateMarketingPlan } from "@/server/services/marketing";
import { createChannel, listChannels } from "@/server/data/marketing-studio";
import { addChannelResult } from "@/server/data/marketing";
import { generateAsset, recommendNextStep } from "@/server/services/marketing-studio";
import { sendCopilotMessage } from "@/server/services/copilot";
import { askHelp } from "@/server/services/help";
import { continueToPains, createGoldLandingDraft, expandMarketNode, generateGoldIdeas, runDemandCheck, startFromIdea, startPainMining } from "@/server/services/gold-mine";
import { getMarketMap, listSessionIdeas, requireSession } from "@/server/data/gold-mine";
import { createListingDraft } from "@/server/data/marketplace";
import { draftTeaser } from "@/server/marketplace/listings";
import { ASSET_TYPE_KEYS } from "@/lib/validation/marketing-assets";

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to run: DATABASE_URL must point at a local database.");
  process.exit(1);
}

const skip = (process.argv.find((a) => a.startsWith("--skip="))?.slice(7) ?? "").split(",").filter(Boolean);
const results: { name: string; ok: boolean; secs: number; note: string }[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function step<T>(name: string, fn: () => Promise<T>, note: (r: T) => string = () => ""): Promise<T | null> {
  if (skip.some((p) => name.startsWith(p))) return null;
  const started = Date.now();
  process.stdout.write(`…     ${name}\r`);
  try {
    const r = await fn();
    const secs = (Date.now() - started) / 1000;
    results.push({ name, ok: true, secs, note: note(r) });
    console.log(`PASS  ${name.padEnd(28)} ${secs.toFixed(1).padStart(6)}s  ${note(r)}`);
    return r;
  } catch (err) {
    const secs = (Date.now() - started) / 1000;
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    results.push({ name, ok: false, secs, note: msg });
    console.log(`FAIL  ${name.padEnd(28)} ${secs.toFixed(1).padStart(6)}s  ${msg.slice(0, 300)}`);
    return null;
  }
}

/** Waits for research jobs to finish (the worker runs them); throws with the failed stage if one fails. */
async function waitJobs(ids: string[], minutes: number) {
  const db = getDb();
  const until = Date.now() + minutes * 60_000;
  let last = "";
  while (Date.now() < until) {
    const rows = await db.select({ id: schema.researchJobs.id, status: schema.researchJobs.status, stage: schema.researchJobs.currentStage, error: schema.researchJobs.error }).from(schema.researchJobs).where(inArray(schema.researchJobs.id, ids));
    const line = rows.map((r) => `${r.status}:${r.stage}`).join(" | ");
    if (line !== last) console.log(`      jobs: ${line}`);
    last = line;
    const failed = rows.find((r) => r.status === "failed" || r.status === "cancelled");
    if (failed) throw new Error(`job ${failed.status} at "${failed.stage}": ${failed.error ?? ""}`);
    if (rows.every((r) => r.status === "succeeded")) return rows.length;
    await sleep(5_000);
  }
  throw new Error(`jobs still running after ${minutes} min (is the worker running? pnpm worker)`);
}

async function main() {
  const db = getDb();
  const runStart = new Date();
  const email = (JSON.parse(readFileSync("seed/demo-account.json", "utf8")) as { email: string }).email;
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user) throw new Error(`No local user ${email}: sign in once with the demo account first.`);
  // A test script, like the fixtures unsafeToUserId exists for: the id comes from our own lookup above.
  const userId: UserId = unsafeToUserId(user.id);

  // Test credits for the demo admin (local database only), so credit checks don't stop the run.
  await db.insert(schema.creditLedger).values({ userId, delta: 400, reason: "purchase", note: "local e2e AI test top-up" });

  if (process.argv.includes("--only=gold")) {
    await goldMine(userId);
    await report(runStart, null);
    return;
  }

  const ideas = await step("ideas", () => generateIdeas(userId, { niche: "tools for independent physiotherapy clinics", customer: "clinic owners with 1-5 therapists", geography: "United States", skills: "full-stack web development", businessModel: "B2B SaaS subscription", count: 3 }), (r) => r.map((i) => i.title).join(" | ").slice(0, 160));
  if (!ideas?.length) return;
  const project = await step("project from idea", () => convertIdeaToProject(userId, ideas[0].id), (r) => r.projectId);
  if (!project) return;
  const projectId = project.projectId;

  const run = await step("research: queue full validation", () => startFullValidation(userId, projectId), (r) => `${r.jobIds.length} jobs`);
  if (run) await step("research: run (worker)", () => waitJobs(run.jobIds, 25), (n) => `${n} jobs succeeded`);

  await step("business model", () => generateBusinessModel(userId, projectId), () => "saved");
  await step("mvp plan", () => generateMvpPlan(userId, projectId), () => "saved");
  await step("brand kit", () => generateBrandKit(userId, projectId), (r) => JSON.stringify(r).slice(0, 120));
  await step("landing copy", () => generateLandingCopy(userId, projectId), (r) => JSON.stringify(r).slice(0, 120));

  const exp = await step("experiment (no AI)", () => createExperiment(userId, projectId, { type: "interview", title: "Problem interviews with clinic owners", hypothesis: "Clinic owners lose hours each week to scheduling and no-shows.", successCriteria: "6 of 10 confirm the problem costs them money" }), (r) => r.id);
  if (exp) {
    await step("interview script", () => generateInterviewScript(userId, exp.id), (r) => `${r.length} chars`);
    await step("interview analysis", () => analyzeInterviewNotes(userId, exp.id, "Talked to Dana, owner of a 3-therapist clinic in Austin. She says no-shows cost her about $2,000 a month. She uses paper reminders and a spreadsheet. Would pay $50/month if it cut no-shows in half. Mark (solo clinic) says his EHR already sends reminders and he doesn't see a need."), (r) => JSON.stringify(r).slice(0, 140));
  }

  await step("marketing plan", () => generateMarketingPlan(userId, projectId, { monthlyBudget: 300, hoursPerWeek: 8, goal: "first_10_customers", geography: "United States", audienceType: "b2b", skills: ["writing", "cold outreach"] }), () => "saved");
  // The marketing plan creates its channels; use the first one (or make one if it made none).
  const channel = await step("channel (no AI)", async () => (await listChannels(userId, projectId))[0] ?? createChannel(userId, projectId, { name: "LinkedIn", type: "organic", role: "primary" }), (r) => r.name);
  if (channel) {
    for (const type of ASSET_TYPE_KEYS) await step(`asset: ${type}`, () => generateAsset(userId, { channelId: channel.id, type }), () => "saved");
    // One week of results, so the next-step recommendation has real numbers to work from.
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 86_400_000);
    await step("channel result (no AI)", () => addChannelResult(userId, projectId, { channel: channel.name, channelType: channel.type, channelId: channel.id, periodStart: start, periodEnd: end, spend: 40, impressions: 3200, clicks: 85, visits: 70, signups: 9, customers: 1 }), () => "logged");
  }
  await step("marketing next step", () => recommendNextStep(userId, projectId), (r) => JSON.stringify(r).slice(0, 140));

  await step("copilot: chat", () => sendCopilotMessage(userId, { tool: "chat", projectId, message: "What should I do this week to get my first 3 paying clinics?" }), (r) => JSON.stringify(r).slice(0, 140));
  await step("copilot: landing tool", () => sendCopilotMessage(userId, { tool: "headlines", projectId, message: "Give me headlines for my homepage" }), (r) => JSON.stringify(r).slice(0, 140));
  await step("help", () => askHelp(userId, { question: "How do I run a full validation on my project?", pathname: `/app/projects/${projectId}` }), (r) => JSON.stringify(r).slice(0, 140));

  const listing = await step("listing (no AI)", () => createListingDraft(userId, { kind: "project", projectId, licenseType: "exclusive_transfer", priceType: "fixed", price: 150000, niche: "Scheduling for physio clinics", earningMin: 500, earningMax: 3000, earningBasis: "20 to 60 small clinics at $50 a month, based on the interviews and competitor prices.", assets: ["research_reports", "mvp_plan", "marketing", "landing_page"] }), (r) => r.id);
  if (listing) await step("marketplace teaser", () => draftTeaser(userId, listing.id), (r) => JSON.stringify(r).slice(0, 140));

  await goldMine(userId);

  await report(runStart, projectId);
}

async function goldMine(userId: UserId) {
  // Gold Mine: market map → demand → pains (worker) → ideas → landing draft.
  const map = await step("gold: market map (no AI)", () => getMarketMap(userId), (m) => `${Object.keys(m).length} keys`);
  const root = map ? (JSON.stringify(map).match(/"id":"([^"]+)"/)?.[1] ?? null) : null;
  if (root) await step("gold: expand market", () => expandMarketNode(userId, root), () => "expanded");
  const session = await step("gold: session (no AI)", () => startFromIdea(userId, { niche: "physiotherapy clinic scheduling", ideaDescription: "Cut no-shows for small physio clinics" }), (s) => s.id);
  if (session) {
    await step("gold: demand check", () => runDemandCheck(userId, session.id), (r) => JSON.stringify(r).slice(0, 140));
    await step("gold: continue (no AI)", () => continueToPains(userId, session.id, true));
    const mined = await step("gold: pain mining (worker)", async () => {
      await startPainMining(userId, session.id);
      const until = Date.now() + 15 * 60_000;
      while (Date.now() < until) {
        const s = await requireSession(userId, session.id);
        if (s.miningStatus === "succeeded") return "succeeded";
        if (s.miningStatus === "failed" || s.miningStatus === "cancelled") throw new Error(`mining ${s.miningStatus}`);
        await sleep(5_000);
      }
      throw new Error("mining still running after 15 min");
    });
    if (mined) {
      await step("gold: ideas", () => generateGoldIdeas(userId, session.id), (r) => JSON.stringify(r).slice(0, 140));
      const gold = await listSessionIdeas(userId, session.id);
      if (gold[0]) await step("gold: landing draft", () => createGoldLandingDraft(userId, session.id, gold[0].id), (r) => r.pageId);
    }
  }

}

async function report(runStart: Date, projectId: string | null) {
  const db = getDb();
  // Cost of this run, from the usage log.
  const usage = await db
    .select({ operation: schema.aiUsageLogs.operation, status: schema.aiUsageLogs.status, n: sql<number>`count(*)::int`, tin: sql<number>`sum(${schema.aiUsageLogs.tokensIn})::int`, tout: sql<number>`sum(${schema.aiUsageLogs.tokensOut})::int`, usd: sql<number>`coalesce(sum(${schema.aiUsageLogs.estimatedCostUsd}),0)::float` })
    .from(schema.aiUsageLogs)
    .where(and(gte(schema.aiUsageLogs.createdAt, runStart)))
    .groupBy(schema.aiUsageLogs.operation, schema.aiUsageLogs.status)
    .orderBy(desc(sql`4`));
  console.log("\nAI calls in this run:");
  console.table(usage.map((u) => ({ ...u, usd: Number(u.usd.toFixed(4)) })));
  const total = usage.reduce((a, u) => a + u.usd, 0);
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} steps passed, AI cost $${total.toFixed(3)}, project ${projectId ?? "-"}`);
}

main()
  .catch((err) => console.error("e2e crashed:", err))
  .then(() => process.exit(0));
