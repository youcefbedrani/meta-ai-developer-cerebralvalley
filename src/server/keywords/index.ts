import "server-only";
import { ConfigError, getIntegrationEnv, isMockProvider, requireIntegration } from "@/lib/env";
import { DataForSeoKeywords } from "./dataforseo";
import { MockKeywords } from "./mock";
import type { KeywordDataProvider } from "./types";

let override: KeywordDataProvider | null = null;
/** Tests only. */
export function __setKeywordOverride(p: KeywordDataProvider | null) {
  override = p;
}

/**
 * Returns the configured keyword-data provider.
 * Not configured → ConfigError (the UI shows exactly which variables to add).
 */
export function getKeywordProvider(): KeywordDataProvider {
  if (override) return override;
  if (isMockProvider("keywords")) return new MockKeywords();
  requireIntegration("keywords");
  const env = getIntegrationEnv();
  if (env.KEYWORD_PROVIDER === "dataforseo") {
    return new DataForSeoKeywords(env.DATAFORSEO_LOGIN!, env.DATAFORSEO_PASSWORD!, Number(env.KEYWORD_LOCATION_CODE ?? 2840), env.KEYWORD_LANGUAGE_CODE ?? "en");
  }
  throw new ConfigError("keywords", [`KEYWORD_PROVIDER (unsupported value "${env.KEYWORD_PROVIDER}"; use dataforseo or mock)`]);
}

export type { KeywordData, KeywordDataProvider } from "./types";
