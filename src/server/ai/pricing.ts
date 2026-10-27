/**
 * USD per million tokens for cost estimates in ai_usage_logs and the platform's daily spend cap.
 * `cachedInput` is the discounted price for prompt tokens served from the provider's prompt cache.
 * List prices at the time of writing; set AI_PRICE_INPUT / AI_PRICE_CACHED_INPUT / AI_PRICE_OUTPUT
 * (USD per million tokens) to override them for the configured models without a code change.
 */
type Price = { input: number; cachedInput: number; output: number };

const PRICES: Record<string, Price> = {
  "gpt-5-mini": { input: 0.25, cachedInput: 0.025, output: 2 },
  "gpt-5-nano": { input: 0.05, cachedInput: 0.005, output: 0.4 },
  "gpt-5": { input: 1.25, cachedInput: 0.125, output: 10 },
  "claude-opus-5-5": { input: 4, cachedInput: 0.2, output: 20 },
  "claude-opus-5": { input: 5, cachedInput: 0.5, output: 25 },
  "claude-sonnet-5-5": { input: 2, cachedInput: 0.2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, cachedInput: 0.01, output: 0.5 },
  // Meta Model API, Standard mode (prompts are not used for training).
  "muse-wonder-1-0": { input: 4, cachedInput: 0.2, output: 20 },
  "muse-spark-1-3": { input: 1.25, cachedInput: 0.15, output: 4.25 },
};

function priceFor(model: string, env: NodeJS.ProcessEnv): Price | null {
  const override = [env.AI_PRICE_INPUT, env.AI_PRICE_CACHED_INPUT, env.AI_PRICE_OUTPUT].map((v) => (v?.trim() ? Number(v) : NaN));
  // Gateways may spell versions with dots ("claude-opus-5.5"); dated snapshots ("gpt-5-mini-2025-08-07") use their family's price.
  const id = model.replace(/\./g, "-");
  const base = PRICES[id] ?? Object.entries(PRICES).find(([k]) => id.startsWith(`${k}-`))?.[1] ?? null;
  if (override.every((n) => Number.isFinite(n) && n >= 0)) return { input: override[0], cachedInput: override[1], output: override[2] };
  return base;
}

export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number, cachedIn = 0, env: NodeJS.ProcessEnv = process.env): number | null {
  const price = priceFor(model, env);
  if (!price) return null;
  const cached = Math.min(Math.max(0, cachedIn), tokensIn);
  return ((tokensIn - cached) * price.input + cached * price.cachedInput + tokensOut * price.output) / 1_000_000;
}
