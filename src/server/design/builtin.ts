import "server-only";
import { parseEditInstruction, readBuiltinOptions, renderBuiltinScreen } from "@/lib/design-templates";
import type { DesignMeta, DesignProvider, GeneratedScreen } from "./types";

/** Built-in designer: real, styled screens from the project's data, instantly and without an API key. */
export class BuiltinDesign implements DesignProvider {
  readonly name = "builtin";

  async createProject(): Promise<string | null> {
    return null;
  }

  async generate(_projectId: string | null, _prompt: string, device: "MOBILE" | "DESKTOP", meta?: DesignMeta): Promise<GeneratedScreen> {
    if (!meta) throw new Error("The built-in designer needs the project's design context");
    return { screenId: null, html: renderBuiltinScreen(meta.ctx, { name: meta.name, purpose: meta.purpose }, device), imageUrl: null };
  }

  async edit(_p: string | null, _s: string | null, previousHtml: string, instruction: string, device: "MOBILE" | "DESKTOP", meta?: DesignMeta): Promise<GeneratedScreen> {
    if (!meta) throw new Error("The built-in designer needs the project's design context");
    const options = parseEditInstruction(instruction, readBuiltinOptions(previousHtml));
    return { screenId: null, html: renderBuiltinScreen(meta.ctx, { name: meta.name, purpose: meta.purpose }, device, options), imageUrl: null };
  }
}
