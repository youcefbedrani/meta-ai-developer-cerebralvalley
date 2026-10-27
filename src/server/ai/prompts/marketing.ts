import { AD_PLATFORMS, type MarketingPlan } from "@/lib/validation/marketing";

type Organic = MarketingPlan["organic"]["channels"][number];
type Paid = MarketingPlan["paid"]["platforms"][number];
const fit = (fitScore: number, role: Organic["role"], costRange: string) => ({ fitScore, fitReasons: ["[Mock] Based on your project data."], costRange, risks: ["[Mock] Takes consistent effort."], role });
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const MARKETING_PROMPT_VERSION = "marketing.v3";

export const MARKETING_SYSTEM = `You create detailed, practical go-to-market plans that help solo founders get their first customers for a new SaaS.
Rules:
- Base positioning on the research and especially the customers' own words provided. Reuse their phrasing in messages, angles, ads and drafts.
- Audience: 1–3 segments. For each, who they are, the trigger moment when they feel the pain, where they spend time online, and the phrases they would type into a search box.
- Angles: 3–6 distinct messaging angles (e.g. pain, time saved, cost of the status quo, identity, comparison with the current workaround). For each set "basis":
  - "customer_quote" ONLY if "evidence" is copied verbatim from the provided customer_language quotes;
  - "research" if it rests on a fact in the project research;
  - otherwise "hypothesis", with evidence explaining what still needs testing. Never invent quotes.
- Organic: rank 2–6 channels by fit for THIS audience (where they actually are, how they decide to buy) and the founder's time. For each channel give a concrete strategy, tactics, content ideas, a realistic cadence, things to avoid (community rules, spammy behaviour) and the KPI to watch. Write 2–10 ready-to-edit content drafts across the top channels that provide value first and disclose that the author is building something.
- Paid: assess EVERY one of these platforms: ${AD_PLATFORMS.join(", ")}. Set fit to "recommended" (test first), "test_later" or "skip", and explain why for this audience and a small budget. Platforms that are a poor fit must still be listed, with "skip" and the reason.
  - For recommended and test_later platforms: targeting options available on that platform, formats, and 2–4 ad variants. Each variant names its angle, the headline, the primary text, the description, the CTA, and a creative idea (image or video concept).
  - For search platforms, add keywords (problem-intent and solution-intent) and negative keywords.
  - For skipped platforms, leave ads, keywords and targeting empty.
  - Respect each platform's style and approximate length limits.
- Budget and test plan: a small test budget framed as a suggestion, plus step-by-step instructions for running the test. NEVER state benchmark numbers (CPC, CPM, CTR, conversion rates, ROAS, audience sizes) as facts. Decision rules tell the founder to set thresholds before spending.
- "whereToFind" / "whereTheyHangOut": you may name specific communities ONLY if they appear in the provided known_communities list; otherwise describe places generically (e.g. "subreddits for freelance designers").
- Go-to-market setup: respect the founder's monthly budget, hours per week, goal, skills, geography and B2B/B2C. If the monthly budget is 0, paid channels must have role "later" and suggestedMonthlyBudget 0.
- Organic channels to consider: SEO/content, communities (Reddit, forums, Facebook/Discord/Slack groups), social content (X, LinkedIn, TikTok, YouTube, Instagram), cold outreach (email, LinkedIn DM), launch platforms (Product Hunt, directories, newsletters), partnerships/affiliates, building in public. Include the 2–8 that fit best.
- For EVERY organic channel and paid platform give:
  - fitScore (1–10), with fitReasons that cite the provided project data (ICP, pains, competitors, pricing, setup);
  - costRange, phrased as a rough assumption to test (e.g. "Assumption: roughly $X–$Y per month; test it");
  - timeToResults;
  - risks;
  - role.
- Focus over spreading: role "primary" for at most 2 channels, "test" for at most 1, everything else "later". Small budgets and few hours mean fewer channels.
- suggestedMonthlyBudget for paid platforms: their total must not exceed the monthly budget. 0 for "later" and skipped platforms.
- The playbook covers weeks 1–8 (setup tasks for week 0 are added automatically, so don't include landing-page or UTM setup). Each step needs:
  - concrete instructions (description);
  - expectedOutput (what exists when it's done);
  - a success metric.
  Focus on the primary and test channels, and point traffic to the project's landing page/waitlist.
- Never invent statistics, follower counts, success stories or guarantees. No fake testimonials in drafts or ads.
- ${UNTRUSTED_DATA_RULE}`;

export function buildMarketingPrompt(input: { project: unknown; customerLanguage: unknown; knownCommunities: string[]; landingUrl: string | null; founder: unknown; setup: unknown }) {
  return `Create the go-to-market plan.

${asData("go_to_market_setup", input.setup)}

${asData("project", input.project)}

${asData("customer_language", input.customerLanguage)}

${asData("known_communities", input.knownCommunities)}

${asData("landing_page", input.landingUrl ?? "Not published yet — first step should be to publish the waitlist page.")}

${asData("founder_profile", input.founder ?? {})}`;
}

const SKIP_REASONS: Partial<Record<(typeof AD_PLATFORMS)[number], string>> = {
  Pinterest: "[Mock] Visual inspiration platform; your buyers don't look for business tools here.",
  TikTok: "[Mock] Needs frequent video creative; test only after you have a message that works.",
  "Podcast ads": "[Mock] Minimum spends are usually too high for a first test.",
  Quora: "[Mock] Low intent for this problem; answer questions organically instead.",
  "X (Twitter)": "[Mock] Harder to target small-team owners precisely; build an organic presence first.",
  "Microsoft Bing": "[Mock] Same keywords as Google; add later by importing the Google campaign.",
};

export function mockMarketingPlan(knownCommunities: string[]): MarketingPlan {
  const community = knownCommunities[0] ?? "relevant online communities";
  const adsFor = (style: "search" | "social") =>
    style === "search"
      ? [
          { angle: "Pain", headline: "[Mock] Stop Copying Data By Hand", primaryText: "[Mock] Automate the weekly copy-paste job in minutes. Built for small teams.", description: "[Mock] Join the waitlist for early access.", cta: "Join waitlist", creative: "[Mock] Text-only search ad; add sitelinks for 'How it works' and 'Pricing'." },
          { angle: "Time saved", headline: "[Mock] Get Your Friday Back", primaryText: "[Mock] The weekly report that builds itself. No spreadsheets, no setup headaches.", description: "[Mock] Early access for small teams.", cta: "Get early access", creative: "[Mock] Text-only search ad; callout extensions: 'No credit card', 'Set up in minutes'." },
        ]
      : [
          { angle: "Pain", headline: "[Mock] Still copying data every week?", primaryText: "[Mock] “I have to copy this data by hand every single week.” Sound familiar? We're building a simple fix for small teams. Join the waitlist.", description: "[Mock] Early access, free while in beta.", cta: "Sign up", creative: "[Mock] Screenshot of a messy spreadsheet with the caption 'Every. Single. Week.'" },
          { angle: "Identity", headline: "[Mock] Built for small teams, not enterprises", primaryText: "[Mock] No 3-week onboarding, no sales calls. Set it up in minutes.", description: "[Mock] Join the waitlist.", cta: "Learn more", creative: "[Mock] 15-second screen recording: before (manual copy) vs after (automatic)." },
        ];

  return {
    positioning: {
      oneLiner: "[Mock] The simple way for small teams to stop doing this by hand.",
      idealCustomer: "[Mock] Owners of small teams who do this task manually every week.",
      problemInTheirWords: "[Mock] “I have to copy this data by hand every single week.”",
      keyMessage: "[Mock] Set up in minutes, not hours.",
      uniqueAngle: "[Mock] Built only for small teams; no enterprise complexity.",
    },
    audience: {
      segments: [
        { name: "[Mock] Agency owners", who: "[Mock] Run a 3–15 person agency and do client reporting themselves.", trigger: "[Mock] End of the week, when the client report is due.", whereTheyHangOut: [community, "[Mock] Agency-owner Slack groups", "[Mock] LinkedIn"], howTheySearch: ["[Mock] automate weekly report", "[Mock] stop copying data between tools"] },
        { name: "[Mock] Operations leads", who: "[Mock] Handle admin for a small company and own the spreadsheets.", trigger: "[Mock] Month-end, when numbers have to be reconciled.", whereTheyHangOut: ["[Mock] Operations and no-code communities", "[Mock] YouTube tutorials"], howTheySearch: ["[Mock] sync spreadsheet automatically"] },
      ],
    },
    angles: [
      { name: "Pain", hook: "[Mock] Still copying data by hand every week?", whyItResonates: "[Mock] Mirrors the exact frustration customers describe.", basis: "hypothesis", evidence: "[Mock] Mock mode: no real customer quotes were used." },
      { name: "Time saved", hook: "[Mock] Get your Friday afternoon back.", whyItResonates: "[Mock] The task happens on a fixed weekly deadline.", basis: "hypothesis", evidence: "[Mock] Test whether time or accuracy matters more." },
      { name: "Identity", hook: "[Mock] Finally, a tool made for small teams.", whyItResonates: "[Mock] Existing tools feel built for enterprises.", basis: "hypothesis", evidence: "[Mock] Validate with competitor reviews." },
    ],
    organic: {
      summary: "[Mock] Your customers already discuss this problem in communities, so start there and with direct outreach; both are free and give fast feedback. Content/SEO compounds slowly, so start it in parallel at a low cadence.",
      channels: [
        { name: "Online communities", priority: 1, audienceFit: "high", why: "[Mock] Your quotes came from these discussions.", whereToFind: [community], effort: "medium", timeToResults: "days", strategy: "[Mock] Become a helpful regular first, then share what you're building with a value-first post.", tactics: ["[Mock] Reply helpfully to 5 threads a week about this problem", "[Mock] Share a 'how I solved it manually' post with a template", "[Mock] DM people who described the pain and ask for a 15-minute chat"], contentIdeas: ["[Mock] The checklist I use to do this in 10 minutes", "[Mock] I asked 20 agency owners how they handle weekly reports"], cadence: "[Mock] Daily replies, 1 post a week", avoid: ["[Mock] Dropping links without context", "[Mock] Breaking self-promotion rules"], kpi: "Waitlist signups from community links", ...fit(9, "primary", "Free (your time)") },
        { name: "Cold email", priority: 2, audienceFit: "medium", why: "[Mock] Reach decision-makers directly.", whereToFind: ["[Mock] Company websites of small agencies"], effort: "medium", timeToResults: "days", strategy: "[Mock] Short, personal emails asking for feedback, not a sale.", tactics: ["[Mock] Build a list of 50 small agencies", "[Mock] Personalise the first line from their website", "[Mock] Follow up once after 4 days"], contentIdeas: ["[Mock] Feedback request", "[Mock] Share a free template"], cadence: "[Mock] 10 emails a day", avoid: ["[Mock] Bulk sending from a new domain"], kpi: "Reply rate and calls booked", ...fit(7, "primary", "Free (your time)") },
        { name: "LinkedIn content", priority: 3, audienceFit: "medium", why: "[Mock] Agency owners read LinkedIn daily.", whereToFind: ["[Mock] LinkedIn feed and agency-owner groups"], effort: "medium", timeToResults: "weeks", strategy: "[Mock] Build in public: share the problem, what you learn, and progress.", tactics: ["[Mock] Post 3 times a week", "[Mock] Comment on 5 posts by agency owners every day"], contentIdeas: ["[Mock] What I learned from 20 customer interviews", "[Mock] Before/after of the manual process"], cadence: "[Mock] 3 posts a week", avoid: ["[Mock] Engagement-bait polls"], kpi: "Profile visits → waitlist signups", ...fit(5, "later", "Free (your time)") },
        { name: "SEO content", priority: 4, audienceFit: "medium", why: "[Mock] People search for how to automate this.", whereToFind: ["[Mock] Search results for problem keywords"], effort: "high", timeToResults: "months", strategy: "[Mock] Write guides answering the exact searches your audience makes.", tactics: ["[Mock] One in-depth guide every 2 weeks", "[Mock] Add a free template as a lead magnet"], contentIdeas: ["[Mock] How to automate your weekly client report", "[Mock] Free weekly report template"], cadence: "[Mock] 2 articles a month", avoid: ["[Mock] Thin AI-generated articles"], kpi: "Organic visits and signups", ...fit(4, "later", "Free (your time)") },
      ],
      content: [
        { channel: "Online communities", format: "post", title: "[Mock] How I'm trying to fix the weekly manual-copy problem", body: "[Mock] Value-first post draft that discloses you're building a tool." },
        { channel: "Cold email", format: "email", title: "[Mock] Quick question about your weekly reports", body: "[Mock] Short, personal email draft asking for a 15-minute chat." },
        { channel: "LinkedIn content", format: "post", title: "[Mock] I spent 3 hours every Friday copying data", body: "[Mock] Build-in-public post draft about the problem and what you're building." },
      ],
    },
    paid: {
      summary: "[Mock] Start with Google Search, which captures people already looking for a fix. Test Meta and LinkedIn later, once you know which angle converts.",
      platforms: [
        { platform: "Google Search", fit: "recommended", why: "[Mock] Captures people already searching for a solution.", targeting: ["[Mock] Exact and phrase match on problem keywords", "[Mock] Countries where your customers are"], keywords: ["[Mock] automate weekly report", "[Mock] stop manual data entry", "[Mock] spreadsheet automation small business"], negativeKeywords: ["[Mock] jobs", "[Mock] free course", "[Mock] salary"], formats: ["Responsive search ad"], ads: adsFor("search"), ...fit(7, "test", "[Mock] Assumption to test"), suggestedMonthlyBudget: 0 },
        { platform: "Meta (Facebook & Instagram)", fit: "test_later", why: "[Mock] Cheap reach; good for testing which angle resonates.", targeting: ["[Mock] Interests: small business owners, agencies", "[Mock] Job titles: owner, founder"], keywords: [], negativeKeywords: [], formats: ["Single image", "Short video"], ads: adsFor("social"), ...fit(4, "later", "[Mock] Assumption to test"), suggestedMonthlyBudget: 0 },
        { platform: "LinkedIn", fit: "test_later", why: "[Mock] Precise targeting by job title and company size, but expensive per click.", targeting: ["[Mock] Job title: Agency owner", "[Mock] Company size: 2–50"], keywords: [], negativeKeywords: [], formats: ["Single image", "Document ad"], ads: adsFor("social"), ...fit(4, "later", "[Mock] Assumption to test"), suggestedMonthlyBudget: 0 },
        { platform: "Reddit", fit: "test_later", why: "[Mock] Target the communities where the pain is discussed.", targeting: [`[Mock] Community targeting: ${community}`], keywords: [], negativeKeywords: [], formats: ["Promoted post"], ads: adsFor("social").slice(0, 1), ...fit(4, "later", "[Mock] Assumption to test"), suggestedMonthlyBudget: 0 },
        { platform: "YouTube", fit: "test_later", why: "[Mock] Show a demo to people watching productivity tutorials.", targeting: ["[Mock] Custom segment: people searching for spreadsheet automation"], keywords: [], negativeKeywords: [], formats: ["Skippable in-stream video"], ads: adsFor("social").slice(1), ...fit(4, "later", "[Mock] Assumption to test"), suggestedMonthlyBudget: 0 },
        { platform: "Newsletter sponsorships", fit: "test_later", why: "[Mock] Niche newsletters for agency owners reach a focused audience.", targeting: ["[Mock] Newsletters for agency owners and operators"], keywords: [], negativeKeywords: [], formats: ["Sponsored blurb"], ads: adsFor("search").slice(0, 1), ...fit(4, "later", "[Mock] Assumption to test"), suggestedMonthlyBudget: 0 },
        ...(Object.entries(SKIP_REASONS) as [(typeof AD_PLATFORMS)[number], string][]).map(([platform, why]): Paid => ({ platform, fit: "skip", why, targeting: [], keywords: [], negativeKeywords: [], formats: [], ads: [], ...fit(1, "later", "Not recommended"), suggestedMonthlyBudget: 0 })),
      ],
      testBudget: { amountPerDay: 10, currency: "USD", durationDays: 7, note: "[Mock] A small test to learn, not to scale. Adjust to what you can afford to lose." },
      testPlan: ["[Mock] Set a maximum cost per signup before you start.", "[Mock] Run the two Google ad variants side by side on the same keywords.", "[Mock] Send all clicks to the waitlist page with the Google tracking link.", "[Mock] After 7 days, compare cost per signup and keep the winning angle."],
      decisionRules: ["[Mock] Decide your maximum cost per signup before you start.", "[Mock] Pause an ad that exceeds it after 100 clicks."],
    },
    playbook: [
      { week: 1, channel: "Online communities", type: "organic", title: "[Mock] Join and read the communities", description: "[Mock] Learn the rules; reply helpfully to 5 threads.", expectedOutput: "[Mock] 5 helpful replies posted", successMetric: "5 helpful replies" },
      { week: 2, channel: "Online communities", type: "organic", title: "[Mock] Share a value post", description: "[Mock] Post the draft below, disclose you're building a tool.", expectedOutput: "[Mock] One value-first post live", successMetric: "10 signups" },
      { week: 2, channel: "Cold email", type: "organic", title: "[Mock] Email 30 prospects", description: "[Mock] Use the email draft; personalise the first line.", expectedOutput: "[Mock] 30 personalised emails sent", successMetric: "3 replies" },
      { week: 3, channel: "Google Search", type: "paid", title: "[Mock] Run a small search ad test", description: "[Mock] Two ad variants on problem keywords.", expectedOutput: "[Mock] Ad test running with tracking links", successMetric: "Cost per signup under your threshold" },
      { week: 4, channel: "Cold email", type: "organic", title: "[Mock] Follow up and book calls", description: "[Mock] Follow up once; book calls with everyone who replied.", expectedOutput: "[Mock] Calls booked", successMetric: "3 calls" },
      { week: 6, channel: "All", type: "organic", title: "[Mock] Review results and double down", description: "[Mock] Keep the best channel, drop the worst.", expectedOutput: "[Mock] Decision written down", successMetric: "Decision recorded" },
    ],
    primaryMetric: "Waitlist signups per channel",
  };
}
