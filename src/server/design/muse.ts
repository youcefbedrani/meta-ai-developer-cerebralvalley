import "server-only";
import { buildDesignEditPrompt, buildDesignScreenPrompt, DESIGN_EDIT_SYSTEM, DESIGN_SCREEN_SYSTEM, extractHtmlDocument, mockDesignScreen } from "@/server/ai/prompts/design-screen";
import { callText } from "@/server/ai/run";
import { unsafeToUserId } from "@/server/data/user-id";
import type { DesignMeta, DesignProvider, GeneratedScreen } from "./types";

/**
 * Meta's Muse Spark as the designer: it writes each screen as a complete Tailwind HTML document from the
 * project's data (research, MVP plan, Brand Kit, customer quotes), with data-goto links between screens.
 */
export class MuseDesign implements DesignProvider {
  readonly name = "muse";

  async createProject(): Promise<string | null> {
    return null;
  }

  async generate(_projectId: string | null, _prompt: string, device: "MOBILE" | "DESKTOP", meta?: DesignMeta): Promise<GeneratedScreen> {
    if (!meta) throw new Error("The Muse designer needs the project's design context");
    const screens = meta.screens?.length ? meta.screens : [meta.name];
    const html = await this.write("design_screen", meta, DESIGN_SCREEN_SYSTEM, buildDesignScreenPrompt(meta.ctx, { name: meta.name, purpose: meta.purpose }, device, screens), () => mockDesignScreen(meta.ctx, meta.name, screens));
    return { screenId: null, html, imageUrl: null };
  }

  async edit(_p: string | null, _s: string | null, previousHtml: string, instruction: string, _device: "MOBILE" | "DESKTOP", meta?: DesignMeta): Promise<GeneratedScreen> {
    if (!meta) throw new Error("The Muse designer needs the project's design context");
    const html = await this.write("design_edit", meta, DESIGN_EDIT_SYSTEM, buildDesignEditPrompt(previousHtml, instruction), () => previousHtml);
    return { screenId: null, html, imageUrl: null };
  }

  private async write(operation: string, meta: DesignMeta, system: string, prompt: string, mock: () => string): Promise<string> {
    const call = () =>
      callText({
        userId: meta.userId ? unsafeToUserId(meta.userId) : null,
        projectId: meta.projectId ?? null,
        operation,
        tier: "smart",
        system,
        messages: [{ role: "user", content: prompt }],
        maxOutputTokens: 16_000,
        timeoutMs: 300_000,
        mock,
      });
    // One retry when the reply isn't a usable document (cut off, or chatter around it).
    for (let attempt = 0; ; attempt++) {
      const { text } = await call();
      try {
        return extractHtmlDocument(text);
      } catch (err) {
        if (attempt >= 1) throw err;
      }
    }
  }
}
