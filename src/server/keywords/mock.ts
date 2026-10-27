import type { KeywordData, KeywordDataProvider } from "./types";

/** Deterministic fake keyword data for KEYWORD_PROVIDER=mock (development/tests only). */
export class MockKeywords implements KeywordDataProvider {
  readonly name = "mock";
  async getKeywordData(keywords: string[]): Promise<KeywordData[]> {
    return keywords.map((keyword, k) => {
      const seed = [...keyword].reduce((a, c) => a + c.charCodeAt(0), 0);
      const shape = k % 3; // 0 growing, 1 stable, 2 declining
      const trend = Array.from({ length: 48 }, (_, i) => {
        const d = new Date(Date.UTC(2022, i, 1));
        const base = 40 + (seed % 20);
        const value = shape === 0 ? base * (0.6 + i / 48) : shape === 1 ? base : base * (1.4 - i / 48);
        return { month: d.toISOString().slice(0, 7), value: Math.round(value) };
      });
      return { keyword, volume: 200 + (seed % 9) * 250, trend };
    });
  }
}
