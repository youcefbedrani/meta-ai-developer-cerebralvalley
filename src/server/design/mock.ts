import "server-only";
import type { DesignProvider, GeneratedScreen } from "./types";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const pick = (prompt: string, re: RegExp, fallback: string) => prompt.match(re)?.[1] ?? fallback;

/** Development and tests: a plain, clearly labelled placeholder screen built from the prompt. No network. */
export class MockDesign implements DesignProvider {
  readonly name = "mock";

  async createProject(): Promise<string | null> {
    return null;
  }

  async generate(_projectId: string | null, prompt: string, device: "MOBILE" | "DESKTOP"): Promise<GeneratedScreen> {
    return { screenId: null, html: this.render(prompt, device, null), imageUrl: null };
  }

  async edit(_p: string | null, _s: string | null, previousHtml: string, instruction: string, device: "MOBILE" | "DESKTOP"): Promise<GeneratedScreen> {
    const prompt = previousHtml.match(/<!--prompt:([\s\S]*?)-->/)?.[1] ?? "";
    return { screenId: null, html: this.render(prompt, device, instruction), imageUrl: null };
  }

  private render(prompt: string, device: "MOBILE" | "DESKTOP", edit: string | null): string {
    const screen = pick(prompt, /Design the "([^"]+)" screen/, "Screen");
    const product = pick(prompt, /screen of (.+?), a /, "Your product");
    const primary = pick(prompt, /primary (#[0-9a-fA-F]{6})/, "#4f46e5");
    const bg = pick(prompt, /background (#[0-9a-fA-F]{6})/, "#ffffff");
    const text = pick(prompt, /text (#[0-9a-fA-F]{6})/, "#111827");
    const quote = pick(prompt, /^- "(.+)"$/m, "");
    const width = device === "MOBILE" ? "390px" : "100%";
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen)}</title><!--prompt:${prompt.replace(/-->/g, "")}--></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:${bg};color:${text}">
<div style="max-width:${width};margin:0 auto;min-height:100vh;display:flex;flex-direction:column">
<header style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #0001"><b>${esc(product)}</b><span style="font-size:12px;opacity:.6">[Mock design]</span></header>
<main style="padding:40px 24px;flex:1">
<p style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;opacity:.6">${esc(screen)}</p>
<h1 style="font-size:${device === "MOBILE" ? 28 : 44}px;line-height:1.1;margin:8px 0 16px">${esc(quote || `${product}, made simple`)}</h1>
<p style="opacity:.75;max-width:560px">Placeholder generated without Stitch (DESIGN_PROVIDER=mock). Add a Stitch API key to get real designs.${edit ? ` Last change requested: ${esc(edit)}` : ""}</p>
<a href="#" style="display:inline-block;margin-top:24px;background:${primary};color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Get started</a>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:40px">${[1, 2, 3].map((i) => `<div style="border:1px solid #0001;border-radius:12px;padding:16px;height:80px"><div style="width:40%;height:8px;background:${primary};opacity:.5;border-radius:4px"></div><div style="width:80%;height:8px;background:#0001;margin-top:12px;border-radius:4px"></div><div style="width:${40 + i * 10}%;height:8px;background:#0001;margin-top:8px;border-radius:4px"></div></div>`).join("")}</div>
</main></div></body></html>`;
  }
}
