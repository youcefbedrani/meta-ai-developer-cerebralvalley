import "server-only";
import type { PageReader } from "@/server/search";
import type { Discussion, DiscussionReader } from "./types";

export function platformFor(host: string): string {
  const h = host.replace(/^www\./, "");
  if (h.endsWith("reddit.com")) return "Reddit";
  if (h === "news.ycombinator.com") return "Hacker News";
  if (h.endsWith("stackexchange.com") || h === "stackoverflow.com") return "Stack Exchange";
  if (h.endsWith("indiehackers.com")) return "Indie Hackers";
  if (h.endsWith("quora.com")) return "Quora";
  return h;
}

export function communityFor(url: URL): string | null {
  const m = url.pathname.match(/^\/r\/([^/]+)/i);
  if (m) return `r/${m[1]}`;
  if (url.hostname.endsWith("stackexchange.com")) return url.hostname.split(".")[0];
  return null;
}

/** Generic reader: uses the SSRF-safe page reader. Engagement and dates are usually unknown. */
export class WebDiscussionReader implements DiscussionReader {
  readonly name = "web";
  constructor(private readonly reader: PageReader) {}
  canRead() {
    return true;
  }
  async read(raw: string): Promise<Discussion | null> {
    const page = await this.reader.read(raw);
    if (!page?.text) return null;
    const url = new URL(raw);
    return { url: raw, platform: platformFor(url.hostname), community: communityFor(url), title: page.title, postedAt: null, engagement: null, text: page.text };
  }
}
