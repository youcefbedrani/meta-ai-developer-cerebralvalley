import "server-only";
import { ConfigError, getIntegrationEnv, isMockProvider, requireIntegration } from "@/lib/env";
import { BuiltinDesign } from "./builtin";
import { MockDesign } from "./mock";
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
  requireIntegration("design");
  const env = getIntegrationEnv();
  if (env.DESIGN_PROVIDER === "stitch") return new StitchDesign(env.STITCH_API_KEY!);
  throw new ConfigError("design", [`DESIGN_PROVIDER (unsupported value "${env.DESIGN_PROVIDER}"; use stitch, builtin or mock)`]);
}

export type { DesignMeta, DesignProvider, GeneratedScreen } from "./types";
