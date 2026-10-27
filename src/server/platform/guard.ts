import "server-only";
import { isModuleOn, MODULES, type ModuleKey, type PlatformSettings } from "@/lib/platform-settings";
import { getCurrentUser } from "@/server/auth/current-user";
import type { AppUser } from "@/server/data/users";
import { isAdmin, isMarketplaceEnabled } from "@/server/marketplace/config";
import { getPlatformSettings } from "./settings";

/** Which modules a user can see: admins see everything; the marketplace also needs its deploy flag. */
export function moduleAccess(settings: PlatformSettings, user: Pick<AppUser, "email" | "role"> | null): Record<ModuleKey, boolean> {
  const admin = !!user && isAdmin(user);
  return Object.fromEntries(
    MODULES.map((m) => [m.key, (m.key !== "marketplace" || isMarketplaceEnabled()) && (admin || isModuleOn(settings, m.key))]),
  ) as Record<ModuleKey, boolean>;
}

/**
 * For module layouts. Returns null when the page may render, or the reason it may not.
 * `adminPreview` is true when the module is off for users but the viewer is an admin.
 */
export async function moduleStatus(key: ModuleKey): Promise<{ blocked: boolean; adminPreview: boolean; label: string }> {
  const [settings, user] = await Promise.all([getPlatformSettings(), getCurrentUser()]);
  const on = isModuleOn(settings, key);
  const admin = !!user && isAdmin(user);
  const label = MODULES.find((m) => m.key === key)!.label;
  return { blocked: !on && !admin, adminPreview: !on && admin, label };
}
