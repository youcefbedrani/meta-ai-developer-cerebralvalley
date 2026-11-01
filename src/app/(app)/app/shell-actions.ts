"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { isLocale, THEME_COOKIE, type Theme } from "@/lib/i18n";
import { toActionError, type ActionResult } from "@/server/action-result";
import { requireUser } from "@/server/auth/current-user";
import { getDb, schema } from "@/server/db/client";
import { markNotificationsSeen, searchEverything, type SearchHit } from "@/server/services/shell";

/** Language is saved on the account (AI results use it too); the theme is a per-device cookie. */
export async function setLocaleAction(locale: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isLocale(locale)) return { ok: false, error: "Unknown language.", code: "validation" };
  await getDb().update(schema.users).set({ locale }).where(eq(schema.users.id, user.id));
  return { ok: true, data: undefined };
}

export async function setThemeAction(theme: Theme): Promise<ActionResult> {
  await requireUser();
  (await cookies()).set(THEME_COOKIE, theme === "dark" ? "dark" : "light", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return { ok: true, data: undefined };
}

export async function markNotificationsSeenAction(): Promise<ActionResult> {
  const user = await requireUser();
  await markNotificationsSeen(user.id);
  return { ok: true, data: undefined };
}

export async function searchAction(query: string): Promise<ActionResult<SearchHit[]>> {
  const user = await requireUser();
  try {
    return { ok: true, data: await searchEverything(user.id, query) };
  } catch (err) {
    return toActionError(err);
  }
}
