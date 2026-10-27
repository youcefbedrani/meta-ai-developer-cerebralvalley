import "server-only";
import { ConfigError, getIntegrationEnv, isMockProvider, requireIntegration } from "@/lib/env";
import { MockReader, MockSearch } from "./mock";
import { FetchReader } from "./reader";
import { TavilySearch } from "./tavily";
import type { PageReader, SearchProvider } from "./types";

let override: { search: SearchProvider; reader: PageReader } | null = null;

/** Tests only: inject search/reader implementations. */
export function __setSearchOverride(value: typeof override) {
  override = value;
}

export function getSearchProvider(): SearchProvider {
  if (override) return override.search;
  if (isMockProvider("search")) return new MockSearch();
  requireIntegration("search");
  const env = getIntegrationEnv();
  if (env.SEARCH_PROVIDER === "tavily") return new TavilySearch(env.SEARCH_API_KEY!);
  // Exa / Brave can be added here behind the same interface.
  throw new ConfigError("search", [`SEARCH_PROVIDER (unsupported value "${env.SEARCH_PROVIDER}"; use tavily or mock)`]);
}

export function getPageReader(): PageReader {
  if (override) return override.reader;
  if (isMockProvider("search")) return new MockReader();
  return new FetchReader();
}

export type { PageReader, SearchProvider, SearchResult } from "./types";
