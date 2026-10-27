import type { Discussion, DiscussionReader } from "./types";

/** Canned discussion threads for SEARCH_PROVIDER=mock (development/tests only). */
export const MOCK_DISCUSSION_LINES = [
  "I'm so frustrated that I have to copy this data by hand every single week.",
  "I wish there was a simple tool that just did this without a 3 hour setup.",
  "Every tool I tried is either too expensive or way too complicated for a small team.",
  "Honestly I hate how much time I waste fixing mistakes from doing this manually.",
  "The biggest struggle is that nothing integrates with the tools we already use.",
  "Our clients keep asking for reports and building them takes me a full day.",
];

export class MockDiscussionReader implements DiscussionReader {
  readonly name = "mock";
  canRead() {
    return true;
  }
  async read(url: string): Promise<Discussion> {
    const n = Number(url.match(/(\d+)$/)?.[1] ?? 1);
    return {
      url,
      platform: "Reddit",
      community: "r/mocksub",
      title: `[Mock] Thread ${n}`,
      postedAt: new Date(Date.UTC(2026, 0, n)),
      engagement: 10 + n * 7,
      text: `[Mock thread for testing]\n\n${MOCK_DISCUSSION_LINES.join("\n\n")}`,
    };
  }
}
