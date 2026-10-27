import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db/client";
import { UserFacingError } from "@/server/data/errors";
import type { UserId } from "@/server/data/user-id";
import { isModuleOn, OPERATION_MODULE, parseSettings, platformSettingsSchema, MODULES, type ModuleKey, type PlatformSettings } from "@/lib/platform-settings";

/*
 * Runtime platform settings (no Next.js imports: the worker uses this too).
 * Cached for a few seconds per process so hot paths (credit reservations, every
 * page render) don't hit the database each time; a save clears this process's cache
 * and other processes (worker, other web instances) pick it up within the TTL.
 */

const KEY = "platform";
const TTL_MS = 5_000;
let cached: { at: number; value: PlatformSettings } | null = null;

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  let stored: unknown;
  try {
    const [row] = await getDb().select({ value: schema.platformSettings.value }).from(schema.platformSettings).where(eq(schema.platformSettings.key, KEY)).limit(1);
    stored = row?.value;
  } catch (err) {
    // Table not migrated yet (42P01): run on defaults instead of taking every page down.
    if (!isUndefinedTable(err)) throw err;
    console.warn("[settings] platform_settings table missing: run migrations. Using defaults.");
  }
  const value = parseSettings(stored);
  cached = { at: Date.now(), value };
  return value;
}

function isUndefinedTable(err: unknown): boolean {
  for (let e = err as { code?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) if (e.code === "42P01") return true;
  return false;
}

/** Validates and saves the full settings object. Returns the saved value. */
export async function savePlatformSettings(adminId: UserId, input: unknown): Promise<PlatformSettings> {
  const value = platformSettingsSchema.parse(input);
  await getDb()
    .insert(schema.platformSettings)
    .values({ key: KEY, value, updatedBy: adminId })
    .onConflictDoUpdate({ target: schema.platformSettings.key, set: { value, updatedBy: adminId, updatedAt: new Date() } });
  cached = null;
  return value;
}

/** Tests only. */
export function __clearSettingsCache() {
  cached = null;
}

export const moduleLabel = (key: ModuleKey) => MODULES.find((m) => m.key === key)?.label ?? key;

/**
 * Called before any paid AI operation: blocks it while AI is paused or its module is off.
 * Admins are exempt so they can test a module before turning it back on.
 */
export async function assertOperationAllowed(operation: string | undefined, opts: { isAdmin?: boolean } = {}): Promise<void> {
  if (opts.isAdmin) return;
  const settings = await getPlatformSettings();
  if (settings.aiPaused) throw new UserFacingError("AI features are paused by the Startum team for a moment. Nothing was charged. Please try again later.");
  const mod = operation ? OPERATION_MODULE[operation] : undefined;
  if (mod && !isModuleOn(settings, mod)) throw new UserFacingError(`${moduleLabel(mod)} is turned off right now. Nothing was charged.`);
}
