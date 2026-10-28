export type SearchResult = {
  url: string;
  title: string;
  snippet: string;
  publishedAt: Date | null;
  /** The page's text as the search provider read it (only when asked for with `rawContent`). */
  rawContent?: string;
};

export interface SearchProvider {
  readonly name: string;
  /**
   * `includeDomains` restricts results to those sites (used to search one platform at a time). `rawContent` also
   * returns each page's text, for sites that block direct fetching (Reddit).
   */
  search(query: string, opts?: { maxResults?: number; includeDomains?: string[]; rawContent?: boolean }): Promise<SearchResult[]>;
}

export interface PageReader {
  /** Returns readable text for a URL, or null if it can't be fetched safely. */
  read(url: string): Promise<{ title: string | null; text: string } | null>;
}
