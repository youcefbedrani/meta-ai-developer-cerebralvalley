/*
 * Platforms searched by the market-voices scan. Each search is restricted to the platform's domains,
 * so results are only what is publicly indexed there. Notes say honestly what we can and can't see.
 */

export const MARKET_PLATFORMS = [
  { key: "reddit", label: "Reddit", domains: ["reddit.com"], note: "Public threads and comments." },
  { key: "quora", label: "Quora", domains: ["quora.com"], note: "Public questions and answers." },
  { key: "youtube", label: "YouTube", domains: ["youtube.com"], note: "Video titles and descriptions, not comments or transcripts." },
  { key: "facebook", label: "Facebook", domains: ["facebook.com"], note: "Only public pages and posts. Private groups can't be searched." },
  { key: "x", label: "X (Twitter)", domains: ["x.com", "twitter.com"], note: "Only posts that search engines index; most of X isn't." },
  { key: "linkedin", label: "LinkedIn", domains: ["linkedin.com"], note: "Public posts and articles only." },
  { key: "tiktok", label: "TikTok", domains: ["tiktok.com"], note: "Video captions that search engines index." },
  { key: "hackernews", label: "Hacker News", domains: ["news.ycombinator.com"], note: "Public discussions." },
  { key: "indiehackers", label: "Indie Hackers", domains: ["indiehackers.com"], note: "Public posts." },
  { key: "producthunt", label: "Product Hunt", domains: ["producthunt.com"], note: "Launches and comments." },
  { key: "reviews", label: "Review sites", domains: ["g2.com", "capterra.com", "trustpilot.com"], note: "Public reviews of existing tools." },
  { key: "stackexchange", label: "Stack Exchange", domains: ["stackexchange.com", "stackoverflow.com"], note: "Public questions." },
] as const;

export type MarketPlatformKey = (typeof MARKET_PLATFORMS)[number]["key"];

export function platformForUrl(url: string): (typeof MARKET_PLATFORMS)[number] | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return MARKET_PLATFORMS.find((p) => p.domains.some((d) => host === d || host.endsWith(`.${d}`))) ?? null;
  } catch {
    return null;
  }
}

/** What a quote shows about the market. */
export const VOICE_THEMES = [
  { key: "pain", label: "Pain or frustration" },
  { key: "desire", label: "Wish or request" },
  { key: "alternative", label: "How they solve it today" },
  { key: "price", label: "Price and willingness to pay" },
  { key: "question", label: "Question asking for help" },
  { key: "praise", label: "Praise for an existing tool" },
] as const;
export type VoiceTheme = (typeof VOICE_THEMES)[number]["key"];
export const themeLabel = (k: string) => VOICE_THEMES.find((t) => t.key === k)?.label ?? k;
