import { z } from "zod";

/** Box on the screenshot in 0–1000 normalized coordinates: [x1, y1, x2, y2]. */
const box = z.array(z.number().min(0).max(1000)).length(4).nullable();

export const ownPageReviewSchema = z.object({
  fiveSecondTest: z.string().min(10).max(400),
  clarity: z.number().int().min(0).max(10),
  score: z.number().int().min(0).max(100),
  strengths: z.array(z.string().min(3).max(240)).max(5),
  issues: z
    .array(
      z.object({
        title: z.string().min(3).max(100),
        detail: z.string().min(5).max(400),
        severity: z.enum(["high", "medium", "low"]),
        fix: z.string().min(5).max(300),
        box,
        /** A customer quote from the research the issue is judged against, when there is one. */
        customerQuote: z.string().max(300).nullable(),
      }),
    )
    .min(1)
    .max(8),
  rewrite: z.object({ headline: z.string().min(5).max(90), subheadline: z.string().min(5).max(240), cta: z.string().min(2).max(30) }),
});
export type OwnPageReview = z.output<typeof ownPageReviewSchema>;

export const competitorPageReviewSchema = z.object({
  company: z.string().max(80).nullable(),
  positioning: z.string().min(10).max(400),
  plans: z
    .array(z.object({ name: z.string().max(60), price: z.string().max(60), period: z.string().max(30).nullable(), highlights: z.array(z.string().max(120)).max(5) }))
    .max(6),
  weaknesses: z
    .array(z.object({ title: z.string().min(3).max(100), detail: z.string().min(5).max(400), box }))
    .min(1)
    .max(6),
  opportunities: z.array(z.string().min(5).max(300)).min(1).max(5),
});
export type CompetitorPageReview = z.output<typeof competitorPageReviewSchema>;

export type PageReviewMode = "own" | "competitor";
export const PAGE_REVIEW_MAX_MB = 8;
