export type KeywordData = {
  keyword: string;
  /** Average monthly searches, or null when the provider has no data. */
  volume: number | null;
  /** Monthly series oldest → newest. Empty when unavailable. */
  trend: { month: string; value: number }[];
};

export interface KeywordDataProvider {
  readonly name: string;
  getKeywordData(keywords: string[]): Promise<KeywordData[]>;
}
