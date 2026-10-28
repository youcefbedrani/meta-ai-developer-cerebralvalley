/**
 * Quick check that the configured AI provider works with Startum's two call shapes (structured JSON and plain
 * text), with real tokens and cost from the usage log. Spends a few cents.
 *   pnpm ai:smoke
 */
import { z } from "zod";
import { callStructured, callText } from "@/server/ai/run";
import { estimateCostUsd } from "@/server/ai/pricing";

const model = process.env.AI_MODEL_SMART ?? "";
let total = 0;

async function step<T>(name: string, fn: () => Promise<T>, summary: (r: T) => string) {
  const started = Date.now();
  try {
    const r = await fn();
    console.log(`PASS  ${name}  (${((Date.now() - started) / 1000).toFixed(1)}s)  ${summary(r)}`);
    return r;
  } catch (err) {
    console.log(`FAIL  ${name}  (${((Date.now() - started) / 1000).toFixed(1)}s)  ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
    return null;
  }
}

const verdict = z.object({
  verdict: z.enum(["build", "pivot", "drop"]),
  score: z.number().min(0).max(100),
  summary: z.string().min(20),
  risks: z.array(z.object({ title: z.string(), severity: z.enum(["low", "medium", "high"]), mitigation: z.string() })).min(2),
  pricing: z.object({ monthlyUsd: z.number(), rationale: z.string() }),
});

async function main() {
  await step(
    "text (fast tier)",
    () =>
      callText({
        userId: null,
        operation: "smoke_text",
        tier: "fast",
        system: "You are concise.",
        messages: [{ role: "user", content: "In one sentence: why should founders validate an idea before building?" }],
        maxOutputTokens: 300,
        mock: () => "mock",
      }),
    (r) => {
      const cost = estimateCostUsd(model, r.tokensIn, r.tokensOut, r.cachedIn) ?? 0;
      total += cost;
      return `${r.tokensIn} in / ${r.tokensOut} out, $${cost.toFixed(5)} | "${r.text.trim().slice(0, 120)}"`;
    },
  );

  await step(
    "structured JSON (smart tier)",
    () =>
      callStructured({
        userId: null,
        operation: "smoke_structured",
        tier: "smart",
        schema: verdict,
        system: "You are a startup analyst. Judge SaaS ideas honestly.",
        prompt: "Idea: a tool that turns customer support tickets into a prioritised product roadmap for small SaaS teams.",
        mock: () => ({ verdict: "build" as const, score: 70, summary: "mock summary text that is long enough", risks: [], pricing: { monthlyUsd: 29, rationale: "" } }),
        maxOutputTokens: 2_000,
      }),
    (r) => `verdict=${r.verdict} score=${r.score} risks=${r.risks.length} price=$${r.pricing.monthlyUsd}/mo`,
  );

  console.log(`\nText-call cost: $${total.toFixed(5)}. Structured-call tokens and cost are in ai_usage_logs (operation smoke_structured).`);
}

main().then(() => process.exit(0));
