import type { PageReader, SearchProvider, SearchResult } from "./types";

/**
 * Canned search results for SEARCH_PROVIDER=mock (development/tests only).
 * URLs point at example.com and every title is prefixed with [Mock].
 */
export class MockSearch implements SearchProvider {
  readonly name = "mock";
  async search(query: string, opts: { maxResults?: number; includeDomains?: string[] } = {}): Promise<SearchResult[]> {
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    // Restricted searches return URLs on that platform, so platform attribution can be tested.
    const host = opts.includeDomains?.[0] ?? "example.com";
    return Array.from({ length: Math.min(opts.maxResults ?? 3, 3) }, (_, i) => ({
      url: `https://${host}/mock/${slug}/${i + 1}`,
      title: `[Mock] Result ${i + 1} for "${query}"`,
      snippet: `Mock snippet ${i + 1}. People describe doing this task manually every week.`,
      publishedAt: null,
    }));
  }
}

export const MOCK_PAGE_TEXT =
  "This is a mock page used for testing. A user wrote: \"We do this task manually every week and it takes hours.\" Another said: \"Existing tools are too expensive for a small team.\" Mock Competitor offers a plan at $29 per month.";

export class MockReader implements PageReader {
  async read(url: string) {
    return { title: `[Mock] ${url}`, text: MOCK_PAGE_TEXT };
  }
}
