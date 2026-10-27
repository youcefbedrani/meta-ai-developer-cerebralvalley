import "server-only";
import { z } from "zod";
import type { SearchProvider, SearchResult } from "./types";

const responseSchema = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      title: z.string().optional().default(""),
      content: z.string().optional().default(""),
      published_date: z.string().nullish(),
    }),
  ),
});

/** Tavily search API (https://docs.tavily.com). */
export class TavilySearch implements SearchProvider {
  readonly name = "tavily";
  constructor(private readonly apiKey: string) {}

  async search(query: string, opts: { maxResults?: number; includeDomains?: string[] } = {}): Promise<SearchResult[]> {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ query, max_results: opts.maxResults ?? 5, search_depth: "basic", include_answer: false, ...(opts.includeDomains?.length ? { include_domains: opts.includeDomains } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Tavily search failed with HTTP ${res.status}`);
    const data = responseSchema.parse(await res.json());
    return data.results.map((r) => {
      const published = r.published_date ? new Date(r.published_date) : null;
      return {
        url: r.url,
        title: r.title.slice(0, 300),
        snippet: r.content.slice(0, 1000),
        publishedAt: published && !Number.isNaN(published.getTime()) ? published : null,
      };
    });
  }
}
