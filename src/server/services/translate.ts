import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { LOCALE_INFO, type Locale } from "@/lib/i18n";
import { callStructured } from "@/server/ai/run";
import { getRedis } from "@/server/redis";

/*
 * Interface text translated by Muse Spark (fast tier) and kept in Redis forever, shared by every user: each string is
 * translated once per language. Only short interface strings come here (the client skips long text and user content
 * is marked data-no-translate); AI results are already written in the user's language.
 */

export const MAX_STRINGS = 60;
export const MAX_LENGTH = 400;

const cacheKey = (locale: Locale) => `i18n:v1:${locale}`;
const field = (text: string) => createHash("sha1").update(text).digest("base64url");

const SYSTEM = `You translate the interface of Startum, a web app that helps founders find, validate, build and launch SaaS ideas. You get a JSON list of interface strings in English; return their translations in the same order, one for one.
Rules:
- Natural, concise interface wording a native speaker would expect in a modern SaaS app. Keep the tone (friendly, direct).
- Keep unchanged: product and brand names (Startum, Muse Spark, Muse Image, Muse Voice, SAM, Meta, Llama, Stripe, StackBlitz, LinkedIn, Facebook, Instagram, TikTok, Reddit, YouTube, Figma, Next.js…), URLs, emails, code, numbers, currency amounts, placeholders like {name} or %s, emoji and symbols like → · •.
- Keep leading/trailing spaces and punctuation style. Do not add quotes or explanations.
- If a string is already in the target language, is a person's or company's name, or has no translatable words, return it unchanged.`;

const outputSchema = z.object({ translations: z.array(z.string()) });

export async function translateStrings(userId: string, locale: Locale, strings: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(strings.map((s) => s.slice(0, MAX_LENGTH)).filter((s) => s.trim().length > 1))].slice(0, MAX_STRINGS);
  if (locale === "en" || !unique.length) return {};
  const redis = getRedis();
  const cached = await redis.hmget(cacheKey(locale), ...unique.map(field));
  const out: Record<string, string> = {};
  const missing: string[] = [];
  unique.forEach((s, i) => (cached[i] != null ? (out[s] = cached[i]!) : missing.push(s)));
  if (!missing.length) return out;

  const result = await callStructured({
    // Billed to the platform, not the client: translation isn't a feature they chose to run.
    userId: null,
    operation: "ui_translation",
    tier: "fast",
    schema: outputSchema,
    system: SYSTEM,
    prompt: `Target language: ${LOCALE_INFO[locale].english}.\n${JSON.stringify(missing)}`,
    mock: () => ({ translations: missing.map((s) => `[${locale}] ${s}`) }),
    maxOutputTokens: 6_000,
  });
  if (result.translations.length !== missing.length) {
    console.warn(`[i18n] ${userId}: got ${result.translations.length} translations for ${missing.length} strings`);
    return out;
  }
  const toStore: Record<string, string> = {};
  missing.forEach((s, i) => {
    const t = result.translations[i].slice(0, MAX_LENGTH * 2);
    out[s] = t;
    toStore[field(s)] = t;
  });
  await redis.hset(cacheKey(locale), toStore);
  return out;
}
