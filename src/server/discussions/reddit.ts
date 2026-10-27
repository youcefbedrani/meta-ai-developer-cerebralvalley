import "server-only";
import { z } from "zod";
import type { Discussion, DiscussionReader } from "./types";

/*
 * Reddit thread reader using Reddit's public JSON representation of a thread.
 * Reddit's Data API terms require registration/approval for commercial use —
 * keep this source disabled (omit "reddit" from DISCUSSION_SOURCES) until you
 * have the appropriate access. Only short quotes and links are stored.
 */

const listing = z.array(
  z.object({
    data: z.object({
      children: z.array(z.object({ kind: z.string(), data: z.record(z.string(), z.unknown()) })),
    }),
  }),
);

export class RedditJsonReader implements DiscussionReader {
  readonly name = "reddit";
  canRead(url: URL) {
    return /(^|\.)reddit\.com$/.test(url.hostname) && /\/comments\//.test(url.pathname);
  }
  async read(raw: string): Promise<Discussion | null> {
    try {
      const url = new URL(raw);
      url.search = "";
      url.hash = "";
      const res = await fetch(`https://www.reddit.com${url.pathname.replace(/\/$/, "")}.json?limit=50&sort=top&raw_json=1`, {
        headers: { "user-agent": "StartumResearch/1.0 (contact: see app)" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
      const [post, comments] = listing.parse(await res.json());
      const p = post?.data.children[0]?.data ?? {};
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      const bodies = (comments?.data.children ?? []).filter((c) => c.kind === "t1").map((c) => str(c.data.body)).filter(Boolean);
      const text = [str(p.title), str(p.selftext), ...bodies].join("\n\n").slice(0, 12_000);
      if (!text.trim()) return null;
      return {
        url: raw,
        platform: "Reddit",
        community: str(p.subreddit_name_prefixed) || null,
        title: str(p.title) || null,
        postedAt: typeof p.created_utc === "number" ? new Date(p.created_utc * 1000) : null,
        engagement: typeof p.num_comments === "number" ? p.num_comments : null,
        text,
      };
    } catch {
      return null;
    }
  }
}
