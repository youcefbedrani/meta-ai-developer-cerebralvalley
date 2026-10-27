/** A public discussion thread, reduced to what we need for quote extraction. */
export type Discussion = {
  url: string;
  platform: string;
  community: string | null;
  title: string | null;
  postedAt: Date | null;
  /** Comments (or upvotes) reported by the source; null if unknown. */
  engagement: number | null;
  /** Readable text: post + comments. Never stored in full. */
  text: string;
};

/**
 * Reads one kind of discussion source. Each source is behind this interface so
 * it can be swapped or disabled (DISCUSSION_SOURCES) to respect source terms.
 */
export interface DiscussionReader {
  readonly name: string;
  canRead(url: URL): boolean;
  read(url: string): Promise<Discussion | null>;
}
