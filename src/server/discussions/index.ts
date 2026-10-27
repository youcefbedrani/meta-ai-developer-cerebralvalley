import "server-only";
import { getIntegrationEnv, isMockProvider } from "@/lib/env";
import { getPageReader } from "@/server/search";
import { MockDiscussionReader } from "./mock";
import { RedditJsonReader } from "./reddit";
import type { DiscussionReader } from "./types";
import { WebDiscussionReader } from "./web";

let override: DiscussionReader[] | null = null;
/** Tests only. */
export function __setDiscussionOverride(readers: DiscussionReader[] | null) {
  override = readers;
}

/**
 * Enabled discussion readers, in priority order. Configure with
 * DISCUSSION_SOURCES (comma-separated): "reddit", "web". Default: "web".
 */
export function getDiscussionReaders(): DiscussionReader[] {
  if (override) return override;
  if (isMockProvider("search")) return [new MockDiscussionReader()];
  const enabled = (getIntegrationEnv().DISCUSSION_SOURCES ?? "web").split(",").map((s) => s.trim().toLowerCase());
  const readers: DiscussionReader[] = [];
  if (enabled.includes("reddit")) readers.push(new RedditJsonReader());
  if (enabled.includes("web")) readers.push(new WebDiscussionReader(getPageReader()));
  return readers;
}

export function readerFor(url: string, readers: DiscussionReader[]): DiscussionReader | null {
  try {
    const u = new URL(url);
    return readers.find((r) => r.canRead(u)) ?? null;
  } catch {
    return null;
  }
}

export type { Discussion, DiscussionReader } from "./types";
