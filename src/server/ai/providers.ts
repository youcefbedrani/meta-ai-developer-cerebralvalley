import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createHash } from "node:crypto";
import type { LanguageModel } from "ai";
import { ConfigError, getIntegrationEnv, isMockProvider, requireIntegration } from "@/lib/env";

/**
 * Provider abstraction. Two tiers, both configured via env:
 *   AI_MODEL_FAST  — planning, extraction, short generations
 *   AI_MODEL_SMART — final synthesis (reports, plans)
 * Supported AI_PROVIDER values: "anthropic", "openai", "openai-compatible" (any gateway that speaks the OpenAI
 * Chat Completions format; needs AI_BASE_URL) and "mock" (dev/test only).
 * AI_BASE_URL (optional) points "anthropic"/"openai" at a gateway instead of the provider's own API.
 */
export type ModelTier = "fast" | "smart";

export type ResolvedModel =
  | {
      model: LanguageModel;
      provider: string;
      modelId: string;
      /** True when calls go through AI_BASE_URL rather than the provider's own API. */
      viaGateway?: boolean;
      /** openai-compatible: the gateway enforces a JSON Schema (response_format json_schema) instead of a schema in the prompt. */
      jsonSchema?: boolean;
      /** openai-compatible reasoning models (Muse Spark Open): reasoning_effort sent with every call. */
      reasoningEffort?: "low" | "medium";
      /** The host follows a JSON Schema only in strict mode (Baseten): strict when the schema allows it, otherwise the schema goes in the prompt. */
      strictJsonSchema?: boolean;
    }
  | { mock: true; provider: "mock"; modelId: string };

let testFactory: ((tier: ModelTier) => ResolvedModel) | null = null;

/** Tests only: replace the model factory (e.g. with MockLanguageModelV4). Pass null to reset. */
export function __setTestModelFactory(factory: ((tier: ModelTier) => ResolvedModel) | null) {
  testFactory = factory;
}

export function resolveModel(tier: ModelTier, operation?: string): ResolvedModel {
  if (testFactory) return testFactory(tier);
  if (isMockProvider("ai")) return { mock: true, provider: "mock", modelId: `mock-${tier}` };

  requireIntegration("ai");
  const open = operation ? openWeightsRoute(operation) : null;
  if (open) return open;
  const env = getIntegrationEnv();
  const modelId = (tier === "smart" ? env.AI_MODEL_SMART : env.AI_MODEL_FAST)!;
  const baseURL = env.AI_BASE_URL?.replace(/\/+$/, "");
  if (baseURL && !/^https:\/\//.test(baseURL)) throw new ConfigError("ai", ["AI_BASE_URL (must start with https://)"]);
  const viaGateway = Boolean(baseURL);
  switch (env.AI_PROVIDER) {
    case "anthropic":
      return { model: createAnthropic({ apiKey: env.AI_API_KEY, baseURL })(modelId), provider: "anthropic", modelId, viaGateway };
    case "openai":
      return { model: createOpenAI({ apiKey: env.AI_API_KEY, baseURL })(modelId), provider: "openai", modelId, viaGateway };
    case "openai-compatible":
      // Gateways usually implement only Chat Completions (not OpenAI's newer Responses API).
      if (!baseURL) throw new ConfigError("ai", ["AI_BASE_URL (required for openai-compatible)"]);
      return { model: createOpenAI({ apiKey: env.AI_API_KEY, baseURL }).chat(modelId), provider: "openai-compatible", modelId, viaGateway, jsonSchema: structuredMode(env.AI_STRUCTURED_OUTPUT, baseURL) === "json_schema" };
    default:
      throw new ConfigError("ai", [`AI_PROVIDER (unsupported value "${env.AI_PROVIDER}"; use anthropic, openai, openai-compatible or mock)`]);
  }
}

/**
 * Optional open-weights route: the operations listed in OPEN_MODEL_OPERATIONS (e.g. "pain_extract,voice_extract")
 * run on Meta's open-weights Muse Spark Open, served by an OpenAI-compatible host (Baseten, Modal, Fireworks or
 * your own vLLM), while everything else stays on the Meta Model API. Off unless OPEN_MODEL_BASE_URL is set.
 */
const DEFAULT_OPEN_MODEL = "meta-models/muse-spark-open-1026";
function openWeightsRoute(operation: string): ResolvedModel | null {
  const env = getIntegrationEnv();
  const baseURL = env.OPEN_MODEL_BASE_URL?.replace(/\/+$/, "");
  if (!baseURL) return null;
  const ops = (env.OPEN_MODEL_OPERATIONS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  if (!ops.includes(operation) && !ops.includes("*")) return null;
  if (!/^https:\/\//.test(baseURL) && !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(baseURL)) throw new ConfigError("ai", ["OPEN_MODEL_BASE_URL (must start with https://)"]);
  if (!env.OPEN_MODEL_API_KEY) throw new ConfigError("ai", ["OPEN_MODEL_API_KEY (open-weights host key)"]);
  const modelId = env.OPEN_MODEL || DEFAULT_OPEN_MODEL;
  return {
    model: createOpenAI({ apiKey: env.OPEN_MODEL_API_KEY, baseURL }).chat(modelId),
    provider: "openai-compatible",
    modelId,
    viaGateway: true,
    jsonSchema: structuredMode(env.OPEN_MODEL_STRUCTURED_OUTPUT, baseURL) === "json_schema",
    // Muse Spark Open always reasons; low effort halves its reasoning tokens on extraction work.
    reasoningEffort: openReasoningEffort(env.OPEN_MODEL_REASONING),
    // Measured on Baseten: non-strict json_schema isn't enforced (keys get renamed); strict is.
    strictJsonSchema: true,
  };
}

/** Gateways known to enforce JSON Schema natively (constrained decoding). Others get the schema in the prompt. */
const NATIVE_JSON_SCHEMA_HOSTS = ["api.meta.ai", "inference.baseten.co"];

function openReasoningEffort(setting: string | undefined): "low" | "medium" {
  if (!setting) return "low";
  if (setting === "low" || setting === "medium") return setting;
  throw new ConfigError("ai", [`OPEN_MODEL_REASONING (unsupported value "${setting}"; use low or medium)`]);
}

function structuredMode(setting: string | undefined, baseURL: string): "json_schema" | "prompt" {
  if (setting === "json_schema" || setting === "prompt") return setting;
  if (setting) throw new ConfigError("ai", [`AI_STRUCTURED_OUTPUT (unsupported value "${setting}"; use json_schema or prompt)`]);
  return NATIVE_JSON_SCHEMA_HOSTS.includes(new URL(baseURL).hostname) ? "json_schema" : "prompt";
}

/* ------------------------------------------------------------- cost control */

const REASONING_MODEL = /^(gpt-5|o\d)/;
/** Claude models that accept `effort` (thinking depth); older ones (Haiku 4.5, Sonnet 4.5…) reject it. */
const CLAUDE_EFFORT_MODEL = /^claude-(fable-5|opus-5|sonnet-5|haiku-5|opus-4-[5-8]|sonnet-4-6)/;
/** Claude models with server-side refusal fallback (`fallbacks: "default"`) on the Claude API. */
const CLAUDE_FALLBACK_MODEL = /^claude-(fable-5-1|opus-5|sonnet-5-5)/;

/** Same hashed id for both providers: lets them spot abuse per client without any personal data. */
const clientHash = (userId: string) => createHash("sha256").update(`startum:${userId}`).digest("hex").slice(0, 32);

/**
 * Per-provider request options that keep token use (and cost) down.
 *
 * OpenAI (GPT-5):
 * - reasoningEffort "minimal"/"low": GPT-5 reasoning tokens are billed as output, so most tasks use the minimum;
 * - textVerbosity: shorter answers where length doesn't add value (chat replies);
 * - promptCacheKey: requests for the same feature share a cache key, so the long, identical system prompt
 *   at the start is served from OpenAI's prompt cache at a 90% discount;
 * - store: false (nothing kept on OpenAI's side) and a hashed safetyIdentifier per client (no personal data).
 *
 * Anthropic (Claude):
 * - effort "low" for fast-tier calls and chat, "medium" for smart-tier synthesis: thinking is always on for
 *   current Claude models and effort is the control for how many (output-billed) thinking tokens they spend;
 * - cacheControl: caches the request prefix (the long, identical system prompt), read back at a 90% discount;
 * - metadata.userId: the same hashed per-client id as OpenAI's safetyIdentifier;
 * - fallbacks "default": if a safety classifier declines a request, the API retries it on a fallback model
 *   instead of returning an empty refusal (Anthropic's own API only: gateways may reject the beta parameter).
 *
 * "openai-compatible" gateways get no extra options: they may reject parameters they don't know.
 */
type AnthropicOptions = { cacheControl: { type: "ephemeral" }; effort?: "low" | "medium"; fallbacks?: "default"; metadata?: { userId: string } };
type OpenAIOptions = { store: false; promptCacheKey: string; safetyIdentifier?: string; reasoningEffort?: "minimal" | "low" | "medium"; reasoningSummary?: null; textVerbosity?: "low" | "medium" | "high" };

export function providerOptionsFor(
  resolved: ResolvedModel,
  opts: { tier: ModelTier; operation: string; userId: string | null; verbosity?: "low" | "medium" | "high"; reasoning?: "minimal" | "low" | "medium" },
): { anthropic: AnthropicOptions } | { openai: OpenAIOptions } | { openai: { reasoningEffort: "low" | "medium" } } | undefined {
  if ("mock" in resolved) return undefined;
  if (resolved.provider === "anthropic") {
    const effort: AnthropicOptions["effort"] = opts.reasoning === "medium" || (!opts.reasoning && opts.tier === "smart") ? "medium" : "low";
    return {
      anthropic: {
        cacheControl: { type: "ephemeral" },
        ...(CLAUDE_EFFORT_MODEL.test(resolved.modelId) ? { effort } : {}),
        ...(!resolved.viaGateway && CLAUDE_FALLBACK_MODEL.test(resolved.modelId) ? { fallbacks: "default" } : {}),
        ...(opts.userId ? { metadata: { userId: clientHash(opts.userId) } } : {}),
      },
    };
  }
  if (resolved.provider === "openai-compatible" && resolved.reasoningEffort) return { openai: { reasoningEffort: resolved.reasoningEffort } };
  if (resolved.provider !== "openai") return undefined;
  const reasoning = REASONING_MODEL.test(resolved.modelId);
  return {
    openai: {
      store: false,
      promptCacheKey: `startum:${opts.operation}`,
      ...(opts.userId ? { safetyIdentifier: clientHash(opts.userId) } : {}),
      ...(reasoning ? { reasoningEffort: opts.reasoning ?? (opts.tier === "smart" ? "low" : "minimal"), reasoningSummary: null } : {}),
      ...(opts.verbosity && resolved.modelId.startsWith("gpt-5") ? { textVerbosity: opts.verbosity } : {}),
    },
  };
}
