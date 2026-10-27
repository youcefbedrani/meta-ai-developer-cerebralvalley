import type { z } from "zod";
import type { extractionSchema, Statement, ValidationReport } from "@/lib/validation/research";

type Extraction = z.output<typeof extractionSchema>;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** True if `quote` appears (whitespace/quote-style insensitive) in `text`. */
export function quoteAppearsIn(quote: string, text: string): boolean {
  const q = normalize(quote);
  return q.length >= 8 && normalize(text).includes(q);
}

/**
 * Keeps only evidence whose quote is found verbatim in the cited stored source,
 * and competitors/pricing that point at real sources.
 */
export function verifyExtraction(extraction: Extraction, sourceText: Map<string, string>) {
  const evidence = extraction.evidence.filter((e) => {
    const text = sourceText.get(e.sourceKey);
    return !!text && quoteAppearsIn(e.quote, text);
  });
  const competitors = extraction.competitors
    .map((c) => {
      const sourceKeys = c.sourceKeys.filter((k) => sourceText.has(k));
      const pricingOk =
        !!c.pricingQuote && !!c.pricingSourceKey && sourceText.has(c.pricingSourceKey) && quoteAppearsIn(c.pricingQuote, sourceText.get(c.pricingSourceKey)!);
      return {
        ...c,
        sourceKeys: pricingOk && !sourceKeys.includes(c.pricingSourceKey!) ? [...sourceKeys, c.pricingSourceKey!] : sourceKeys,
        pricingQuote: pricingOk ? c.pricingQuote : null,
        pricingSourceKey: pricingOk ? c.pricingSourceKey : null,
      };
    })
    .filter((c) => c.sourceKeys.length > 0);
  return {
    extraction: { evidence, competitors },
    stats: { droppedEvidence: extraction.evidence.length - evidence.length, droppedCompetitors: extraction.competitors.length - competitors.length },
  };
}

export const UNVERIFIED_NOTE = " (Unverified: no stored source supports this, so it is treated as an assumption.)";

/**
 * Enforces citation rules on the synthesized report:
 * - citations may only reference stored source keys;
 * - a FACT without at least one valid citation becomes an ASSUMPTION;
 * - competitors need a valid source; pricing needs a valid source, verified pricing, or it is removed.
 */
export function verifyReport(report: ValidationReport, validKeys: Set<string>, verifiedPricingKeys: Set<string>) {
  let downgraded = 0;
  let droppedCitations = 0;

  const fix = (st: Statement): Statement => {
    const sources = [...new Set(st.sources.filter((k) => validKeys.has(k)))];
    droppedCitations += st.sources.length - sources.length;
    if (st.kind === "FACT" && sources.length === 0) {
      downgraded++;
      return { text: st.text + UNVERIFIED_NOTE, kind: "ASSUMPTION", sources };
    }
    return { ...st, sources };
  };

  const sections = Object.fromEntries(
    Object.entries(report.sections).map(([key, list]) => [key, list.map(fix)]),
  ) as ValidationReport["sections"];

  const competitors = report.competitors
    .map((c) => {
      const sources = [...new Set(c.sources.filter((k) => validKeys.has(k)))];
      const pricing = c.pricing && validKeys.has(c.pricing.source) && verifiedPricingKeys.has(c.pricing.source) ? c.pricing : null;
      return { ...c, sources, pricing };
    })
    .filter((c) => c.sources.length > 0);

  return {
    report: { ...report, sections, competitors },
    stats: { downgraded, droppedCitations, droppedCompetitors: report.competitors.length - competitors.length },
  };
}
