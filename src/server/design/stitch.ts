import "server-only";
import type { Stitch } from "@google/stitch-sdk";
import type { DesignProvider, GeneratedScreen } from "./types";

// The SDK is ESM-only; load it on first use so the worker (which runs as CommonJS) can start without it.
let sdk: Promise<typeof import("@google/stitch-sdk")> | null = null;
const loadSdk = () => (sdk ??= import("@google/stitch-sdk"));

const MAX_HTML_BYTES = 2_000_000;

/** Google Stitch (stitch.withgoogle.com) through the official @google/stitch-sdk. */
export class StitchDesign implements DesignProvider {
  readonly name = "stitch";
  private client: Promise<Stitch> | null = null;

  constructor(private readonly apiKey: string) {}

  private stitch(): Promise<Stitch> {
    // Generating a screen can take a few minutes.
    return (this.client ??= loadSdk().then(({ Stitch, StitchToolClient }) => new Stitch(new StitchToolClient({ apiKey: this.apiKey, timeout: 300_000 }))));
  }

  async createProject(title: string): Promise<string> {
    const project = await (await this.stitch()).createProject(title.slice(0, 80));
    return project.id;
  }

  async generate(projectId: string | null, prompt: string, device: "MOBILE" | "DESKTOP"): Promise<GeneratedScreen> {
    if (!projectId) throw new Error("Stitch needs a project id");
    const screen = await (await this.stitch()).project(projectId).generate(prompt, device);
    return this.read(screen);
  }

  async edit(projectId: string | null, screenId: string | null, _previousHtml: string, instruction: string, device: "MOBILE" | "DESKTOP"): Promise<GeneratedScreen> {
    if (!projectId || !screenId) throw new Error("Stitch needs the project and screen ids to edit");
    const screen = await (await this.stitch()).project(projectId).screen(screenId).edit(instruction, device);
    return this.read(screen);
  }

  private async read(screen: { id: string; getHtml(): Promise<string>; getImage(): Promise<string> }): Promise<GeneratedScreen> {
    // The SDK returns download URLs; keep the HTML itself so exports don't depend on links that may expire.
    const [htmlUrl, imageUrl] = await Promise.all([screen.getHtml(), screen.getImage().catch(() => null)]);
    const res = await fetch(htmlUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`Could not download the screen HTML (${res.status})`);
    const html = await res.text();
    if (html.length > MAX_HTML_BYTES) throw new Error("The generated screen is too large to store");
    return { screenId: screen.id, html, imageUrl };
  }
}
