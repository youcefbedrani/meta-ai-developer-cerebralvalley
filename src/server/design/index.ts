import "server-only";
import { ConfigError, getIntegrationEnv, isMockProvider, requireIntegration } from "@/lib/env";
import { BuiltinDesign } from "./builtin";
import { MockDesign } from "./mock";
import { MuseDesign } from "./muse";
import { StitchDesign } from "./stitch";
import type { DesignProvider } from "./types";

let override: DesignProvider | null = null;

/** Tests only. */
export function __setDesignOverride(value: DesignProvider | null) {
  override = value;
}

export function getDesignProvider(): DesignProvider {
  if (override) return override;
  if (isMockProvider("design")) return new MockDesign();
  if (process.env.DESIGN_PROVIDER === "builtin") return new BuiltinDesign();
  // Meta's Muse Spark designs through the AI provider, so it needs no key of its own.
  if (process.env.DESIGN_PROVIDER === "muse") {
    requireIntegration("ai");
    return new MuseDesign();
  }
  requireIntegration("design");
  const env = getIntegrationEnv();
  if (env.DESIGN_PROVIDER === "stitch") return new StitchDesign(env.STITCH_API_KEY!);
  throw new ConfigError("design", [`DESIGN_PROVIDER (unsupported value "${env.DESIGN_PROVIDER}"; use muse, stitch, builtin or mock)`]);
}

export type { DesignMeta, DesignProvider, GeneratedScreen } from "./types";
