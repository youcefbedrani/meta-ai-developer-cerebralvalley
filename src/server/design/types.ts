import type { DesignContext } from "@/lib/design-prompt";

export type GeneratedScreen = { screenId: string | null; html: string; imageUrl: string | null };
/** What the built-in and Muse Spark designers need (Stitch works from the prompt alone). */
export type DesignMeta = {
  ctx: DesignContext;
  name: string;
  purpose: string;
  /** Every screen of the prototype, so the Muse designer can link between them. */
  screens?: string[];
  /** For usage logging and the fair-use budget (Muse designer). */
  userId?: string;
  projectId?: string;
};

/** Generates UI screens. Implemented by Meta's Muse Spark, Google Stitch, the built-in designer, and a mock for tests. */
export interface DesignProvider {
  readonly name: string;
  /** Creates a container for a project's screens; returns its id (null when the provider has none). */
  createProject(title: string): Promise<string | null>;
  generate(projectId: string | null, prompt: string, device: "MOBILE" | "DESKTOP", meta?: DesignMeta): Promise<GeneratedScreen>;
  edit(projectId: string | null, screenId: string | null, previousHtml: string, instruction: string, device: "MOBILE" | "DESKTOP", meta?: DesignMeta): Promise<GeneratedScreen>;
}
