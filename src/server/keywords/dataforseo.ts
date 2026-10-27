import "server-only";
import { z } from "zod";
import type { KeywordData, KeywordDataProvider } from "./types";

const responseSchema = z.object({
  status_code: z.number(),
  status_message: z.string().optional(),
  tasks: z
    .array(
      z.object({
        status_code: z.number(),
        status_message: z.string().optional(),
        result: z
          .array(
            z.object({
              keyword: z.string(),
              search_volume: z.number().nullable().optional(),
              monthly_searches: z.array(z.object({ year: z.number(), month: z.number(), search_volume: z.number().nullable() })).nullable().optional(),
            }),
          )
          .nullable()
          .optional(),
      }),
    )
    .default([]),
});

/**
 * DataForSEO Google Ads search volume (live endpoint).
 * Docs: https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/
 * The monthly history window is limited by Google Ads (about 4 years).
 */
export class DataForSeoKeywords implements KeywordDataProvider {
  readonly name = "dataforseo";
  constructor(
    private readonly login: string,
    private readonly password: string,
    private readonly locationCode = 2840,
    private readonly languageCode = "en",
  ) {}

  async getKeywordData(keywords: string[]): Promise<KeywordData[]> {
    const from = new Date();
    from.setUTCFullYear(from.getUTCFullYear() - 4);
    from.setUTCMonth(from.getUTCMonth() + 1, 1);
    const res = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${this.login}:${this.password}`).toString("base64")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([{ keywords: keywords.map((k) => k.toLowerCase().slice(0, 80)), location_code: this.locationCode, language_code: this.languageCode, date_from: from.toISOString().slice(0, 10) }]),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`DataForSEO HTTP ${res.status}`);
    const data = responseSchema.parse(await res.json());
    const task = data.tasks[0];
    if (data.status_code !== 20000 || !task || task.status_code !== 20000) {
      throw new Error(`DataForSEO error ${task?.status_code ?? data.status_code}: ${task?.status_message ?? data.status_message ?? "unknown"}`);
    }
    const byKeyword = new Map((task.result ?? []).map((r) => [r.keyword.toLowerCase(), r]));
    return keywords.map((keyword) => {
      const r = byKeyword.get(keyword.toLowerCase());
      const trend = (r?.monthly_searches ?? [])
        .filter((m) => m.search_volume !== null)
        .map((m) => ({ month: `${m.year}-${String(m.month).padStart(2, "0")}`, value: m.search_volume ?? 0 }))
        .sort((a, b) => a.month.localeCompare(b.month));
      return { keyword, volume: r?.search_volume ?? null, trend };
    });
  }
}
