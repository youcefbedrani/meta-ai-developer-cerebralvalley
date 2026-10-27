export type SearchResult = {
  url: string;
  title: string;
  snippet: string;
  publishedAt: Date | null;
};

export interface SearchProvider {
  readonly name: string;
  /** `includeDomains` restricts results to those sites (used to search one platform at a time). */
  search(query: string, opts?: { maxResults?: number; includeDomains?: string[] }): Promise<SearchResult[]>;
}

export interface PageReader {
  /** Returns readable text for a URL, or null if it can't be fetched safely. */
  read(url: string): Promise<{ title: string | null; text: string } | null>;
}
