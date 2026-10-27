import "server-only";
import { ConfigError } from "@/lib/env";
import { InsufficientCreditsError } from "@/server/billing/credits";
import { AIInvalidOutputError, AIProviderError } from "@/server/ai/errors";
import { NotFoundError, UserFacingError } from "@/server/data/errors";
import { RateLimitError } from "@/server/rate-limit";
import { ResearchInProgressError } from "@/server/services/research";
import { MiningInProgressError, NeedsMoreDataError } from "@/server/services/gold-mine";
import { DecisionNotAllowedError } from "@/server/data/experiments";
import { SlugTakenError } from "@/server/data/landing-pages";
import { ZodError, z } from "zod";

/** Shape returned by server actions to client forms. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: "config" | "credits" | "rate_limit" | "not_found" | "ai" | "validation" | "needs_more_data"; missing?: string[]; fieldErrors?: Record<string, string[] | undefined> };

/** Maps known, user-safe errors to an ActionResult; rethrows anything unexpected. */
export function toActionError(err: unknown): Extract<ActionResult, { ok: false }> {
  if (err instanceof ConfigError) return { ok: false, error: err.message, code: "config", missing: err.missing };
  if (err instanceof InsufficientCreditsError) return { ok: false, error: err.message, code: "credits" };
  if (err instanceof RateLimitError) return { ok: false, error: err.message, code: "rate_limit" };
  if (err instanceof DecisionNotAllowedError || err instanceof SlugTakenError || err instanceof UserFacingError) return { ok: false, error: err.message, code: "validation" };
  if (err instanceof ZodError) return { ok: false, error: "Please fix the highlighted fields.", code: "validation", fieldErrors: z.flattenError(err).fieldErrors as Record<string, string[] | undefined> };
  if (err instanceof NeedsMoreDataError) return { ok: false, error: err.message, code: "needs_more_data" };
  if (err instanceof MiningInProgressError) return { ok: false, error: err.message, code: "validation" };
  if (err instanceof ResearchInProgressError) return { ok: false, error: err.message, code: "validation" };
  if (err instanceof NotFoundError) return { ok: false, error: err.message, code: "not_found" };
  if (err instanceof AIInvalidOutputError || err instanceof AIProviderError) return { ok: false, error: err.message, code: "ai" };
  throw err;
}
