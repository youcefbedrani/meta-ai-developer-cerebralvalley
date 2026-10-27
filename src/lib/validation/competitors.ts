import { z } from "zod";

/* Competitor scan: AI output schemas, and the manual "add a competitor" form. */

export const competitorQueriesSchema = z.object({
  queries: z.array(z.string().min(3).max(160)).min(1).max(6),
});

const sourced = z.object({ text: z.string().min(2).max(300), source: z.string().max(10) });

export const competitorScanSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        website: z.string().max(300).nullable(),
        type: z.enum(["direct", "indirect", "alternative"]),
        description: z.string().max(400).nullable(),
        targetCustomer: z.string().max(300).nullable(),
        features: z.array(z.string().max(120)).max(12),
        strengths: z.array(sourced).max(6),
        weaknesses: z.array(sourced).max(6),
        pricing: z
          .object({
            summary: z.string().max(300),
            source: z.string().max(10),
            /** Verbatim excerpt containing the price(s). */
            quote: z.string().max(400),
            plans: z.array(z.object({ name: z.string().max(60), priceMonthly: z.number().min(0).max(100_000).nullable(), currency: z.string().max(5) })).max(6),
          })
          .nullable(),
        sources: z.array(z.string().max(10)).min(1).max(8),
      }),
    )
    .max(15),
});
export type CompetitorScan = z.output<typeof competitorScanSchema>;
export type ScannedCompetitor = CompetitorScan["competitors"][number];

export const manualCompetitorSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  website: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .pipe(z.union([z.literal(""), z.url({ protocol: /^https?$/ })]))
    .transform((v) => v || null),
  type: z.enum(["direct", "indirect", "alternative"]),
  notes: z.string().trim().max(1000).transform((v) => v || null),
});
export type ManualCompetitorInput = z.input<typeof manualCompetitorSchema>;

/** "$29", "29.00", "€1,299" → 29 / 29 / 1299, for checking a plan price really appears in its quote. */
export function priceAppearsIn(price: number, text: string): boolean {
  const numbers = (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, "")));
  return numbers.some((n) => Math.abs(n - price) < 0.005);
}

/* Market voices scan (src/server/jobs/research/market-voices.ts) */

export const voiceQueriesSchema = z.object({ queries: z.array(z.string().min(3).max(120)).min(1).max(3) });

export const voicesSchema = z.object({
  quotes: z
    .array(
      z.object({
        source: z.string().max(10),
        /** Verbatim excerpt from that source; discarded if not found word for word. */
        quote: z.string().min(8).max(300),
        theme: z.enum(["pain", "desire", "alternative", "price", "question", "praise"]),
      }),
    )
    .max(120),
});
export type Voices = z.output<typeof voicesSchema>;
