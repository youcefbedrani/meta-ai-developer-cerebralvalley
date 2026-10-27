# Startum — AI SaaS Opportunity Platform

From idea to launch for founders: **Discover → Research → Validate → Plan**, with Brand, Launch and Grow designed for later.
Every idea is a **project**, and every module reads and writes the same project data. That way pricing, landing copy, interviews and plans build on the same research instead of contradicting it.

> The brand name lives in `src/lib/brand.ts`. Plans, prices, monthly credits and credit costs live in `src/lib/plans.ts`.

## Status

| Iteration | Scope | State |
|---|---|---|
| 1 | Foundation: auth, DB, app shell, onboarding, projects, data-access layer | ✅ |
| 2 | AI layer (providers, Zod-validated output, usage logs), credits ledger, rate limits, Idea Finder | ✅ |
| 3 | Research engine: BullMQ worker, search + reader, evidence extraction, cited validation report, competitors | ✅ |
| 4 | Validation Lab: experiments, results, interview script + notes analysis, landing pages with real waitlists, Build/Pivot/Drop | ✅ |
| 5 | Business model (verified price anchors only), MVP planner, build kit export | ✅ |
| 6 | Stripe billing + webhooks, pricing/terms/privacy pages, production Docker + Caddy, backups, health check, Sentry | ✅ |
| + | **Gold Mine**: evidence-first opportunity finder (Market → Demand → Pains → Ideas → Landing page) | ✅ |
| + | **Marketing Studio**: go-to-market setup → focused channel plan → channels with a budget per platform → 8-week playbook → versioned assets → small ad tests → tracked results and next-step advice | ✅ |
| + | **Help & Resources**: in-app Help assistant, original MVP Playbook, Start here guide | ✅ |
| + | **Idea Marketplace** (behind `MARKETPLACE_ENABLED`): sell/buy validated project packages with NDA, escrowed payments (Stripe Connect), transfer and disputes | ✅ in test mode (Stripe live flow needs keys) |
| + | **Project map, idea map & competitor intelligence**: visual done/started/missing map per project, idea chain (sourced vs hypothesis), competitor scan with landscape, coverage grid, pricing ladder and feature matrix | ✅ |
| + | **Admin console** (`/app/admin`): users, sign-up control, projects, jobs & AI cost, billing & credits, marketplace, platform settings, audit log | ✅ |

**Later (designed for, not built):** AI assistant with project memory (the `embeddings` table with pgvector already exists), personas, Brand Studio, Launch Planner, Growth Advisor, teams, PDF export. None of these appear in the UI.

## Trust rules, and where they're enforced

| Rule | Enforcement |
|---|---|
| Facts must cite stored sources | `src/server/jobs/research/verify.ts`. A FACT whose citations don't match a stored source is relabelled ASSUMPTION. |
| No fabricated quotes | Extracted quotes and interview-analysis quotes must appear verbatim in the stored text, or they're discarded. |
| Competitor pricing only when found | Pricing is kept only with a verified quote from a stored source. Business-model anchors may only name those competitors. |
| Validation only by real results | Only the user can mark an experiment passed. **Build** requires at least one passed experiment. AI verdicts are labelled "advisory". |
| No fake data in the UI | All counts come from the database. Mock providers exist for development and tests only, are refused in production, and show a banner. |
| Gold Mine quotes are real | Pain quotes must appear verbatim in the fetched thread. URL, platform, community, date and engagement come from the fetched thread, never from the AI. Only short quotes and links are stored, never full threads. |
| Gold Mine ideas need evidence | Every idea must link to at least one stored pain cluster; unlinked ideas are rejected (the whole batch is refunded if none link). Landing copy blocks keep the quote ids they're based on. |
| Missing data stays missing | No keyword volume → "needs more data". Fewer than 5 quotes → no clusters and a "needs more data" state. Trends are classified by fixed rules (`src/lib/gold-mine/trend.ts`), not the LLM. |
| No success prediction | Four separate ratings (demand evidence, competitive pressure, feasibility, monetization), each with a justification. |
| Web content is untrusted | Prompts wrap user/web text in data tags with an instruction to ignore embedded instructions. The page reader blocks private/internal addresses (SSRF) and re-checks redirects. |

## Gold Mine (evidence-first opportunity finder)

Sidebar → **Gold Mine**. There are two ways in:

- **A. I don't have an idea:** the **Market map** starts with Health / Wealth / Relationships. Each click expands one level (fast model, personalised with the onboarding profile, saved in `market_maps`). Choose a niche to start a session.
- **B. I already have an idea:** enter a niche (and optionally the idea). This skips the map.

Each session (`gold_mine_sessions`) then goes through these steps, with a stepper on every one:

1. **Demand:** the AI suggests 5–10 search phrases, and the keyword provider returns volume and monthly history (`demand_checks`). Each trend is classified growing / stable / fad / declining by a deterministic rule. Competitors found via web search count as a demand signal. Weak or unmeasured demand triggers a checkpoint: *continue anyway* or *change niche*.
2. **Pains:** a background job (`pain-mining` queue, stages finding_discussions → reading → extracting → clustering).
   - It runs `site:` queries with emotional keywords ("frustrated", "I wish", "hate"…).
   - It prefers recent, active threads and skips threads with fewer than 3 comments when the count is known.
   - It reads threads through a swappable `DiscussionReader` and extracts short verbatim quotes (`pain_quotes`, de-duplicated).
   - It clusters them into ranked pains (`pain_clusters`, `pain_cluster_quotes`). Frequency, recency and rank are computed in code; the AI judges intensity.
3. **Ideas:** 3–5 ideas from the clusters (smart model). Each must reference real clusters (`idea_pain_links`). They are stored as regular ideas, so Discover Ideas, Compare and "Turn into project" work, and the idea page shows its evidence.
4. **Landing page:** copy is written only from the idea's quotes, and each block stores its quote ids ("Based on N quotes"). It creates the project (copying quotes into the **Customer language** library), a waitlist experiment and an unpublished page in the existing builder. Visit and signup stats show real data only.

**Customer language:** a project tab listing quotes by pain cluster, with copy buttons and source links. Other modules can reuse it through `getProjectCustomerLanguage(userId, projectId)` in `src/server/services/gold-mine.ts`.

**Credits** (`src/lib/plans.ts`): market expansion 1, demand check 10, pain mining 30, ideas 8, landing copy 5. Credits are reserved first and refunded on failure. Pain mining is also rate-limited to 4 per user per hour.

### Data sources (each behind an interface)

| Purpose | Interface | Implementations | Env |
|---|---|---|---|
| Keyword volume + trend | `KeywordDataProvider` (`src/server/keywords`) | `dataforseo` (Google Ads search volume, live endpoint), `mock`. Not configured → a config message in the UI and no charge. | `KEYWORD_PROVIDER`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `KEYWORD_LOCATION_CODE` (default 2840 = US), `KEYWORD_LANGUAGE_CODE` (default `en`) |
| Finding discussions | `SearchProvider` (existing) | `tavily`, `mock` | `SEARCH_PROVIDER`, `SEARCH_API_KEY` |
| Reading threads | `DiscussionReader` (`src/server/discussions`) | `web` (SSRF-safe page reader; dates and engagement often unknown), `reddit` (Reddit's public thread JSON: date, community, comment count), `mock` | `DISCUSSION_SOURCES` (comma-separated, default `web`) |

**Notes and limits:**
- Google Ads (and therefore DataForSEO's search-volume endpoint) returns roughly the last **4 years** of monthly data, not 5. The classifier works on whatever history is returned (12+ months).
- Reddit's Data API terms require approval for commercial use. `reddit` is opt-in; enable it only when you have the right access. Many sites block generic readers, so the `web` source can return fewer quotes; the UI then says "needs more data".
- The DataForSEO and Reddit integrations follow their public docs but **have not been run against the live services here** (no credentials).

## Start here (first-time guide)

- **Where:** Sidebar → **Start here** (`/app/guide`). New users land here right after onboarding with a welcome message (`?welcome=1`).
- **The journey:** 9 steps in 4 phases, defined in `src/lib/journey.ts`:
  - **Discover:** find an idea, then create a project;
  - **Validate:** research, test with real people, then decide to build, pivot or drop;
  - **Build & launch:** plan the MVP and business model, then publish the waitlist page;
  - **Grow:** get customers, then measure and double down.
- **Each step explains:** why it matters, how to do it, what you get, when it counts as done, the credit cost, and links to the right page. Project-scoped links open in the user's most recent active project.
- **Progress:** computed from the user's own data in one scoped query (`getJourneyProgress` in `src/server/data/journey.ts`).
  - The next step is highlighted and opened.
  - The dashboard shows the same progress under "Your journey".

## Help & Resources

- **Help button** (bottom-right on every app page):
  - **Ask:** an AI assistant (fast model, 1 credit per question) grounded in the MVP Playbook, the founder journey, the user's progress and, on a project page, that project's research. It suggests in-app links, which are checked against an allowlist (`safeHelpLinks`); a project link only works for the project being viewed. Another user's project is never used as context.
  - **Guides:** quick links to Start here, the MVP Playbook and each strategy.
- **Resources → The MVP Playbook** (`src/lib/resources/mvp-playbook.ts`): an original guide written for this product, not copied from any source. It covers what an MVP is, the "minimum viable representation" mindset, the MVP ladder, risk as time, picking a format by your skills, 8 strategies (early-access page, squeeze page, letter, demo video, free tool, ad test, concierge / Wizard of Oz, pre-sale) and a landing-page checklist. Strategies that fit the user's own skills are highlighted.

## Marketing Studio

Sidebar → **Marketing Studio**, or the **Marketing** tab in any project. Tabs: Strategy · Organic · Paid ads · Channels & budget · Playbook · Assets · Ad tests · Results.

- **1. Go-to-market setup:** monthly budget (can be 0), hours/week, goal (first 10 customers, 100 signups, first $1k MRR or custom), skills, geography and B2B/B2C. Stored with the plan (`marketing_plans.inputs`).
- **2. Channel plan** (smart model, 10 credits, schema v3). It covers organic channels (SEO/content, communities, social, cold outreach, launch platforms, partnerships, building in public) and every ad platform. Each channel gets a **fit score** with reasons tied to project data, effort, a **cost range labelled as an assumption**, time to results, risks and a role.
  - **Focus is enforced in code** (`enforceFocus`): at most 2 primary channels and 1 test channel. With a budget of 0 there are no paid channels, and suggested paid budgets are capped at the monthly budget.
  - The plan also includes audience segments and messaging angles. An angle labelled *Customer quote* must match a collected quote (`verifyAngleEvidence`), and specific communities must appear in real quotes (`verifyCommunities`).
- **Channels & budget:** every channel the founder runs (seeded from the plan, or any platform added by hand).
  - Each has a monthly budget, a status (planned, active, paused or stopped), spend this month from logged results with a progress bar against the budget, tracked signups and a ready tracking link.
  - Regenerating the plan keeps budgets the user already set.
- **3. Playbook:** week 0 adds setup tasks automatically (landing page, UTM links, analytics check, waitlist/checkout, offer), followed by weeks 1–8. Each task has instructions, an expected output, a success metric, a due date and a status.
- **4. Asset generator** (3 credits per asset; smart model). Asset types: ad variants, social posts, community posts (helpful, rule-following, discloses the author is building something), 3-step cold email sequences, DM scripts, SEO keyword lists (keyword + intent only, **never search volumes**), article outlines, launch posts and newsletter sponsor pitches.
  - **Source quotes:** each asset stores the ids of the customer quotes it used (`asset_source_quotes`). The model sees short refs (Q1, Q2…), never real ids, and invented refs are dropped.
  - **Versions:** every edit saves a new version, and history is kept.
  - **Policy check:** a pre-check (`src/lib/marketing/policy.ts`) warns about guarantees, income or health claims, personal attributes, before/after framing, unverifiable superlatives and fake urgency.
- **5. Paid ad tests:** hypothesis, audience, budget, duration, 2–3 variants (typed in, or filled from generated ads or the plan) and a **stop/continue rule the founder sets before spending** (maximum cost per signup after N clicks).
  - Each variant gets its own UTM link (`utm_source=<platform>&utm_campaign=<test>&utm_content=<variant>`).
  - Results are logged per variant. The decision (keep running, continue or stop) and the winner are computed deterministically (`decideVariant`).
  - **Track in Validation Lab** creates a matching experiment.
  - There is no ad-platform API integration yet. `src/server/ads/provider.ts` defines the `AdsProvider` interface for Meta, Google and LinkedIn later.
- **6. Tracking & results:**
  - **Tracked:** visits and signups on our hosted landing pages are recorded as `page_events` with all UTM tags, shown as "tracked" (verified).
  - **Self-reported:** spend, impressions, clicks, customers and revenue are entered manually.
  - **Metrics:** CTR, cost per click, signup rate, cost per signup, cost per customer and ROAS are computed in code (`src/lib/marketing/metrics.ts`), never by the AI.
  - **UTM link builder:** custom links for a specific post or campaign.
- **Next best step** (fast model, 2 credits): per-channel advice (double down, iterate copy, change audience, stop, keep testing) based **only** on recorded results. It refuses to run with no data. Channels with too little data are forced to "need more data", and channels the model invents are dropped (`guardRecommendation`). The metrics snapshot it used is stored with it.
- **Tables:**
  - extended: `marketing_plans`, `marketing_tasks` (this is the playbook-tasks table), `channel_results`;
  - new: `marketing_channels`, `marketing_assets`, `asset_source_quotes`, `ad_experiments`, `ad_variants`, `utm_links`, `page_events`, `marketing_recommendations`.

## Idea Marketplace

Off by default. Turn it on with `MARKETPLACE_ENABLED=true`; while it's off, every page 404s, actions refuse, and the nav item is hidden.

A listing sells either a **single idea or sub-idea** (one of the seller's saved ideas) or a **full project package**.

**Before NDA + access, anyone sees only three things:**
- the **niche**;
- the **price**;
- the seller's **monthly earning estimate**, always labelled "seller's estimate, not verified".

They also see whether it's an idea or a project, and the license type. Title, write-up, research, metrics, assets and how the estimate was made unlock after the NDA plus seller-granted access or an offer.

**Idea sales:** an exclusive sale moves the idea to the buyer, detached from the seller's project and Gold Mine evidence. A non-exclusive sale adds a labelled copy to the buyer's ideas.

**Admin controls** (`/app/admin/marketplace` and the per-listing page `/app/admin/marketplace/listings/[id]`):
- see everything, including the hidden details;
- edit the niche, price or earning estimate (a reason is required);
- approve, reject, unpublish, put back live, or delete a listing (refused once payments exist);
- ban the seller;
- cancel a deal before payment or refund it after.

Every admin action goes to both audit logs.

- **Validation levels are computed, never declared** (`src/lib/marketplace/validation-level.ts`):
  - *Researched*: a research report with sources.
  - *Tested*: a completed experiment with results.
  - *Validated*: 50+ tracked waitlist signups, 10+ logged interviews or 3+ pre-sales. The thresholds are in `VALIDATION_THRESHOLDS`.
  - *Revenue*: needs Stripe-verified revenue (not available yet).
  - Metrics we tracked ourselves are shown as **verified by platform**; anything a user entered is labelled **self-reported** and never raises the level.
- **Selling:** a wizard (idea or project → assets (projects only) → license → niche, earning estimate and price). Project listings get an AI draft of the buyer details (3 credits) that the seller edits; idea listings reuse the idea's own write-up.
  - **Readiness checks:** no personal data in the niche, estimate note or details (emails, phones, links, handles, the seller's name), niche and estimate set, ownership confirmed, original work declared, and, for projects, at least *Researched*.
  - **Review:** the listing is submitted to an admin, who approves it.
  - **Licenses:**
    - *Exclusive transfer*: the whole project moves, the listing closes, the seller loses access, and a non-compete applies.
    - *Non-exclusive*: a copy of the included assets, which can be sold many times and is labelled as such.
- **Buying:**
  - **Public card:** niche, price and earning estimate only, also on public pages at `/marketplace`. Buyers can filter by idea or project and search by niche.
  - **Full details** need sign-in, a click-through **NDA** (stored with timestamp, IP and version), and either seller-granted access or an offer. Every access is logged (`listing_views`, IPs hashed).
  - **Deal room:** offers, counter-offers and messages.
- **Deals:** a state machine (`src/lib/marketplace/deal-machine.ts`): `DRAFT_OFFER → ACCEPTED → PAYMENT_HELD → TRANSFER_IN_PROGRESS → BUYER_CONFIRMED → PAID_OUT`, plus `CANCELLED`, `REFUNDED` and `DISPUTED`. Every change is written to `marketplace_audit_log`.
- **Agreement:** on acceptance, an **Asset Transfer Agreement** is generated from a template (parties, assets, license, price, non-compete scope and duration, date). Both parties accept the exact text, and the sha256 hash, time and IP are stored. **The template (and the NDA) must be reviewed by a lawyer before real use.**
- **Payments (Stripe Connect, separate charges and transfers):**
  - Sellers onboard with Connect Express.
  - The buyer pays through Checkout, and the platform holds the funds.
  - When the buyer confirms (or `MARKETPLACE_AUTO_CONFIRM_DAYS` pass with no dispute; the worker checks hourly), the in-platform package is delivered and the seller is paid the amount minus `MARKETPLACE_FEE_PERCENT`.
  - **Payouts are blocked until the seller's Connect account has payouts enabled.** They're released automatically on `account.updated`.
  - Cancelled or failed transfers are refunded. A dispute (from a user or a Stripe chargeback) freezes the payout until an admin refunds, releases or resumes.
  - Webhooks are idempotent (event-id dedup, a unique checkout session, state guards), and refunds and transfers use idempotency keys.
- **Transfer:**
  - *Exclusive*: moves the project and every child record to the buyer in one DB transaction (`moveProjectOwnership`). If anything fails, the confirmation rolls back.
  - *Non-exclusive*: clones only the included assets (`cloneProjectPackage`).
  - **External assets** (domain, repo, social/Stripe accounts) use a checklist: the seller marks each item done and the buyer marks it received.
- **Waitlist consent:** the waitlist form now has an optional, unchecked opt-in to pass the email to a future owner. At transfer, only consented emails move. Other signups are redacted (email removed), so only the count carries over.
- **Trust & safety:**
  - admin review queue;
  - listing reports;
  - unpublish and suspend seller;
  - **duplicate/plagiarism check:** a feature-hashed text embedding of the teaser and report, stored in pgvector and compared by cosine similarity. A near-duplicate (≥ 0.80) is flagged for the reviewer. This is lexical, not semantic; a semantic embedding provider can replace `textEmbedding` later;
  - seller ratings after completed deals.
- **Admins:** `users.role = 'admin'` or an email listed in `ADMIN_EMAILS`. The console is at **Admin** in the sidebar.
- **Tables:** `listings`, `listing_assets`, `listing_views`, `listing_access`, `nda_acceptances`, `offers`, `deals`, `deal_messages`, `deal_transfer_items`, `agreements`, `connect_accounts`, `marketplace_payments`, `payouts`, `disputes`, `reviews`, `listing_reports`, `marketplace_audit_log`; plus consent and redaction fields on `waitlist_signups`, and `users.role` / `users.marketplace_banned_at`.

**Stripe Connect setup:**
1. In the Stripe Dashboard (test mode first), enable **Connect** with **Express** accounts and set your platform profile.
2. Use the same `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Add these events to the webhook endpoint: `checkout.session.completed`, `account.updated` and `charge.dispute.created`. Connected-account events need **"Listen to events on Connected accounts"** enabled on the endpoint.
3. Set `MARKETPLACE_PAYMENTS=stripe`, `MARKETPLACE_FEE_PERCENT` (default 10) and `MARKETPLACE_AUTO_CONFIRM_DAYS` (default 7).

**What's verified and what isn't:** the whole flow runs in **mock payment mode** (`MARKETPLACE_PAYMENTS=mock`, dev and tests only, refused in production). The real Stripe calls (account creation, account links, Checkout, transfers, refunds) are written against the Stripe SDK but **have not been run against Stripe**, because no keys were available. Test them in Stripe test mode before going live. The brand kit isn't a sellable asset yet (no brand module exists). *Revenue* level verification is not implemented.

## Brand, maps and competitor intelligence

- **Logo:** a text wordmark, "Startum." in Bricolage Grotesque ExtraBold with the full stop in the brand gradient (`Wordmark`, `LogoMark` for the compact "S.", and `LogoLoader` in `src/components/brand/logo.tsx`; the font is loaded as `--font-logo` in the root layout). Files: `public/brand/startum-logo.png` (dark text) and `startum-logo-light.png` (white text); favicon `src/app/icon.png`, `src/app/apple-icon.png` and `src/app/favicon.ico`. Domain: startum.ai (`BRAND` in `src/lib/brand.ts`).
- **Project map** (project overview): Discover → Validate → Build → Grow. Each step is marked done / started / missing using real counts only (`src/lib/project-map.ts` and `src/server/data/project-map.ts`). It shows the first three gaps with a link to fix each, how much of the research is FACT, ANALYSIS or ASSUMPTION, and the report's four ratings.
- **Idea map** (idea page): problem → customer → alternatives → solution → edge → money. Each link is marked sourced (Gold Mine pains), hypothesis, or missing, together with the idea's open unknowns.
- **Competitors** (project → Competitors):
  - **Competitor scan** (15 credits): runs on the research queue as a `research_jobs` row with `input.kind = "competitor_scan"`, in `src/server/jobs/research/competitor-scan.ts`. It searches for alternatives and for the pricing pages of known competitors.
  - **What it keeps:** only competitors named in stored sources. Pricing is kept only when its quote and every plan price are found word for word in the source text.
  - **Merging:** results are merged into the existing list by name or domain. Nothing is deleted, and re-running research only replaces research-origin competitors.
  - **Adding by hand:** users can add competitors they know. These are labelled "Added by you · unverified".
  - **Views:** landscape rings (direct / indirect / alternative), a "what we know" grid with the gaps marked, a pricing ladder (sourced monthly prices only, with the quote on hover) and a feature matrix that marks likely table stakes and rare features (labelled ANALYSIS).
- **Known limits:**
  - The scan finds what search results contain, so "all competitors" really means "all found in this scan". Scanning again widens the list.
  - Feature cells mean "mentioned in a source", not "confirmed absent" when blank.

## My profile & Market voices

**My profile** (`/app/profile`, also on each user's admin page) shows a founder's data at a glance:
- **Profile:** onboarding answers as chips and 1–N scales (technical level, time, budget), plus goals and business models.
- **Takeaways:** what the answers mean, from fixed rules in `src/lib/founder-profile.ts` and labelled ANALYSIS, plus MVP strategies that match their skills.
- **Work so far:** ideas, projects by stage, reports, sourced facts, competitors, quotes, tests, signups and credits used.

**Market voices** (project → Market voices, 20 credits) runs one domain-restricted search per platform. Platforms are listed in `src/lib/market-platforms.ts`: Reddit, Quora, YouTube, Facebook, X, LinkedIn, TikTok, Hacker News, Indie Hackers, Product Hunt, review sites (G2, Capterra, Trustpilot) and Stack Exchange.
- **How quotes are kept:** each quote must appear word for word in the stored page or search snippet. Quotes go into the project's customer-language library, tagged by platform and theme (pain, wish, today's alternative, price, question, praise). Re-runs don't duplicate.
- **What the page shows:** where people talk about it, what they say, and a filterable quote list with a link to each post.
- **Implementation:** the job runs on the research queue (`research_jobs.input.kind = "market_voices"`). Search uses Tavily's `include_domains`.
- **Limits:**
  - only publicly indexed content can be found, so Facebook groups, most of X, LinkedIn and TikTok show little;
  - YouTube gives titles and descriptions, not comments or transcripts;
  - Reddit's commercial API terms apply if you switch to its API (`DISCUSSION_SOURCES`).

## Validate my idea, verdict, Brand Kit and billing

**Validate my idea** (project overview, 50 credits instead of 60 separately) runs research, a competitor scan and a market-voices scan in one go.
- `startFullValidation` (`src/server/services/research.ts`) creates the three `research_jobs` rows up front, each with its own credit reservation (25 / 10 / 15), so a failed step refunds only its share. Only the first job is queued; `runResearchJob` queues `input.next[0]` when a step ends, whatever its outcome. A step that can't be queued is failed and refunded by the stale-job sweep.
- **Verdict** (`src/lib/verdict.ts`, pure): a 0–100 evidence score from the report's four ratings, verified quotes, sourced competitor prices, signups and test results. ≥68 Go, ≥45 Pivot, otherwise Drop, with a confidence level, the weakest signal and next steps. It's a rule-based reading of the evidence (ANALYSIS), not a prediction, and makes no AI call.
- **Micro-SaaS fit:** solo-build rating (feasibility + skills + time), where customers talk (quotes per platform), a suggested price (a little under the median of sourced competitor entry prices), customers needed for $1k / $5k / $10k a month, and a budget note.
- **Share link:** the owner can create a read-only link (`/r/<token>`, 24-character random token in `projects.share_token`, not indexed). Turning it off or on again invalidates the old link.

**Brand Kit** (project → Brand, 8 credits): name ideas, tagline, voice, palette, fonts and a logo. The model only picks hex colours, fonts from an allowlist, a logo shape and a symbol from a fixed list (bolt, spark, leaf, wave, chart, chat, shield, layers, orbit, check, target, bloom) (`src/lib/brand-kit.ts`). Symbol marks get a primary → secondary gradient. The **logo studio** on the Brand page shows every symbol plus initials in every shape, in the kit's colours; picking one is free and updates the landing page and designs. The SVG is drawn by our code with escaped text, so model output is never rendered as markup. Text/background contrast is forced to at least 4.5:1. Downloads: logo mark and full logo as SVG, palette and fonts as CSS variables. Stored in `projects.brand`.

**Landing page themes and logo** (Validation Lab → landing page editor): founders pick a ready-made theme (Lavender, Minimal, Midnight, Sunset, Ocean, Forest, plus **My brand** once a Brand Kit exists). Each theme has its own palette, Google Fonts pair and layout (centered, split or bold). The logo is either drawn free from the product's initials in one of six shapes, using the theme's colours, or the Brand Kit logo. A "Generate my logo" button creates a Brand Kit (8 credits) straight from the editor. Settings are stored as `content.style` on the page and validated against fixed theme ids and shapes (`src/lib/landing-themes.ts`); pages saved before this feature render with the default theme. `src/components/public/landing-view.tsx` renders both `/p/[slug]` and the editor's live desktop/mobile preview. It uses container queries, so the preview shows the real layout at any size.

**Marketplace review mode** (Admin → Settings → Marketplace → New listings): "auto" (default) puts a listing live as soon as it passes every readiness check (complete details, no personal data, ownership and original-work declarations, a researched level for projects), unless it looks like a near-duplicate of another listing, which still goes to the admin queue. "manual" sends every listing to the queue. Admins can unpublish any listing at any time. The sell form says exactly what's missing when it can't continue, and links projects that aren't validated yet to their overview.

**AI: OpenAI GPT-5 mini, with fair-use limits** (`AI_PROVIDER=openai`, `AI_MODEL_FAST` / `AI_MODEL_SMART` = `gpt-5-mini`).
- **Per-client limits that can't be passed** (`src/server/ai/budget.ts`): tokens per UTC day and per UTC month by plan (defaults: Free 100k / 1M, Founder 400k / 6M, Studio 800k / 12M; Admin → Settings → AI limits). Before every AI call, every feature included, an estimate (prompt size plus the likely reply) is reserved atomically in Redis. A call that would pass the limit never starts, and its credit is refunded. Afterwards the reservation is corrected to the real token count. Missing counters (for example after a Redis restart) are rebuilt from `ai_usage_logs`, so limits can't be reset by accident. Admins and system calls aren't limited.
- **Platform spend cap:** AI spend per UTC day in USD (default $25, 0 = none). When it's reached, AI pauses for everyone until midnight UTC, so one client or a bug can't drain the OpenAI account. Admin → Jobs & AI shows today's spend and the top AI users this month against their limits.
- **Fewer tokens per call** (`providerOptionsFor` in `src/server/ai/providers.ts`): `reasoningEffort` "minimal" (fast tier) or "low" (smart), because GPT-5 reasoning tokens are billed as output; `textVerbosity` for chat replies; a `promptCacheKey` per feature, so the long identical system prompt is billed at the cached-input rate (90% off); `store: false`; a hashed `safetyIdentifier` per client. Cached tokens are logged and priced separately (`src/server/ai/pricing.ts`; override prices with `AI_PRICE_INPUT`, `AI_PRICE_CACHED_INPUT`, `AI_PRICE_OUTPUT`).

**AI Copilot** (`/app/copilot`, 1 credit per message): one assistant for copywriting (landing page, headlines, product descriptions, improve my copy), marketing (social posts, ads, SEO, launch plan), sales (cold emails, onboarding emails, objections), strategy (pricing, positioning) and product (interview script, user stories). Conversations are saved (`copilot_threads`, `copilot_messages`). Token discipline (`src/lib/copilot.ts`): a shared system prompt over 1,024 tokens that's identical for everyone (prompt-cache friendly), a project brief of at most 1,600 characters instead of the whole project, only the last 6 messages (shortened) plus a one-line recap of older requests, a reply cap per tool (and a platform maximum), and plain text instead of JSON. A repeated first question for the same tool and project is answered from a per-client cache: no AI call, no credit, no tokens. The usage meter shows today's tokens against the limit.

**Plans and credits** (`src/lib/plans.ts`): Free 75 credits, Founder $49 with 1,500, Studio $69 with 2,500. Every plan has every feature; plans differ in credits. The amounts charged come from your Stripe Prices, so set those to $49 and $69. Admins can still change monthly credits in Settings.
- **Credit packs:** 300 credits for $15 and 1,000 for $39, bought with a one-time Stripe Checkout (`createCreditPackCheckout`). The webhook adds them (`reason = "purchase"`, never expires) only when the session is paid and its amount matches our catalogue.
- **Running low:** below 25 credits the app shows a bar linking to upgrade / buy a pack, and the Validate button shows the same link when the balance is too low. Every "not enough credits" error says where to top up.

**MVP design** (project → Design, 4 credits per screen or edit). Two providers:
- `DESIGN_PROVIDER=builtin` (default, no key): the built-in designer (`src/lib/design-templates.ts`, pure) draws landing, sign-up, dashboard/home, onboarding, pricing, settings and feature screens, desktop or mobile, from the project's data: product copy, MVP features and acceptance criteria, Brand Kit colours, fonts and logo, and real customer quotes. All text is escaped; the HTML is self-contained apart from Google Fonts. Edits understand "dark/light", colour names or hex codes, "add/remove the sidebar" and "compact/spacious"; anything else gives a new variant.
- `DESIGN_PROVIDER=stitch`: AI designs with Google Stitch through the official [`@google/stitch-sdk`](https://github.com/google-labs-code/stitch-sdk). The details below apply to Stitch.
- **Prompts** (`src/lib/design-prompt.ts`, pure): one Stitch prompt per screen, built from the project's idea, research (target user, problem, differentiation), MVP plan (features), Brand Kit (name, tagline, colours, fonts, tone) and verified customer quotes. Suggested screens: entry, sign-up and the main screen, plus the MVP must-haves (up to 6 per run). Web generates at desktop width, mobile at 390px. Founders can add their own screens and see the exact prompt before sending.
- **Generation:** runs on the research queue (`research_jobs.input.kind = "design"`, `src/server/jobs/design.ts`), one screen at a time. Each screen has its own credit reservation, so a failed screen refunds only itself. The Stitch project id is stored on `projects.design_project_id` and screens in `design_screens`; their HTML is stored so exports don't depend on Stitch links. An edit creates a new version and archives the old one.
- **Preview safety:** screen HTML is served by `/app/projects/[id]/design/[screenId]/html` with `Content-Security-Policy: sandbox allow-scripts` and shown in `sandbox="allow-scripts"` iframes. Scripts (Stitch uses the Tailwind CDN) can run, but with an opaque origin and no access to the app or cookies. Only that route may be framed (same origin); everything else stays `X-Frame-Options: DENY`.
- **Export:** `/app/projects/[id]/design/export` returns a zip: `PROMPT.md` (brief for Claude Code, Cursor, Windsurf, Lovable, Bolt or v0), `CLAUDE.md` / `AGENTS.md`, `design/*.html`, and `docs/` with the MVP spec, brand and customer language. `?format=prompt` returns just the prompt.
- **Setup:** `DESIGN_PROVIDER=stitch` and `STITCH_API_KEY`. `DESIGN_PROVIDER=mock` (dev and tests only) makes labelled placeholder screens. The SDK is ESM-only and loaded on first use, so the CommonJS worker starts without it.
- **Limits:** one API key means one Stitch quota shared by all your users, so watch usage (rate-limit errors are refunded and shown as "usage limit reached"). The SDK repo says it is "not an officially supported Google product".

**Motion** (CSS in `globals.css`, plus `src/components/motion/`): pages fade up on navigation through `template.tsx` files, and their sections and card grids (`.stagger`) rise in one after another. Bars fill in (`.bar-grow`), the verdict score counts up inside a ring that draws itself, and a Go verdict gets a one-time confetti burst. Primary buttons get a light sweep on hover, clickable cards lift slightly, steps in progress shimmer, and the low-credit bar slides in. No animation library is used, and everything is off for users who choose reduced motion in their system settings.

**Navigation** is grouped by journey phase: Discover, Validate, Build & grow, Account (`src/components/app/nav.ts`).

**Marketplace proof:** every listing card shows counts from the seller's linked project, computed live by the platform: sourced facts, real quotes, competitors, waitlist signups and test results. Only counts are public, never the content.

## Admin console

`/app/admin` is the control panel for running Startum. **Only the platform team can open it:** an admin is an account whose email is in the server's `ADMIN_EMAILS`, and nothing else. Admin access can't be granted from inside the app, so a client can never be promoted and a hijacked admin session can't create new admins. Everyone else gets the not-found page. Every change is written to `admin_audit_log` (the **Audit log** tab).

**Admin accounts only see statistics and controls.** They skip founder onboarding and land on `/app/admin`. The sidebar shows only *Statistics* (Overview, Sign-ups, Projects, Jobs & AI, Billing & credits) and *Control* (Users, Marketplace, Settings, Audit log). Founder tools live in the `app/(founder)` route group, whose layout (`requireFounder`) sends admins back to the console. The marketplace's browse, selling, deals list and payouts pages do the same. Admins can still open deal rooms (to resolve disputes) and listing pages (to review them), which the console links to. To try the client experience, sign in with a non-admin account.

| Tab | What you can do |
|---|---|
| Overview | Live counts: users, active users, onboarding rate, plans, projects, waitlist sign-ups, research jobs, AI cost, marketplace queue and sales; new accounts per day |
| Users | Search and filter; open a user to change plan (manual override, Stripe untouched), add/remove credits (ledger rows), suspend (signs them out everywhere, reason shown at sign-in), ban from the marketplace, or delete the account (typed-email confirmation; refused if they have marketplace deals) |
| Sign-ups | Open / invite-only (allowed emails and domains) / closed, with a custom message. Enforced on the server when a new account first signs in; a refused new Firebase login is deleted. `ADMIN_EMAILS` can always join |
| Projects | Every project with owner, stage, waitlist count; archive or restore. Project contents stay private to the owner |
| Jobs & AI | Research jobs (cancel and refund, or retry for free), AI calls, tokens and estimated cost per feature, recent AI errors |
| Billing & credits | Stripe subscriptions, credit ledger, 30-day credit totals |
| Marketplace | Review queue, reports and disputes, plus every listing, deal, buyer payment and seller payout |
| Settings | Turn modules off (hidden for users, their paid AI actions blocked before any charge; admins still see them), maintenance mode, announcement banner, pause all AI, monthly credits per plan, marketplace fee and auto-confirm window |

Settings live in `platform_settings` (one JSON row, validated by `src/lib/platform-settings.ts`; missing fields fall back to the defaults, so a fresh install behaves as before). Each process caches them for 5 seconds. `MARKETPLACE_ENABLED` still decides whether the marketplace is deployed at all; the console can then switch it off and on.

## Quick start (local)

Requirements: Node 22+, pnpm 9+, Docker, and Java 11+ (for the Firebase Auth emulator).

```bash
pnpm install
cp .env.example .env             # see "Configuration" below
pnpm services:up                 # Postgres :5460 + Redis :6390
pnpm db:migrate
pnpm emulator                    # terminal 1: Firebase Auth emulator (no Firebase project needed)
pnpm dev                         # terminal 2: http://localhost:3100
pnpm worker                      # terminal 3: worker (research + Gold Mine pain mining)
pnpm seed:demo                   # optional: demo login in the emulator (credentials in seed/demo-account.json)
```

### Try everything without any API keys

Set these in `.env` to click through the whole product with canned, clearly labelled data. A yellow "Mock mode" banner is shown, and production refuses this mode:

```
AI_PROVIDER=mock
SEARCH_PROVIDER=mock
KEYWORD_PROVIDER=mock
NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-stratum.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-stratum
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIREBASE_ADMIN_PROJECT_ID=demo-stratum
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

To use real services, replace these with the keys listed under [Accounts & keys](#accounts--keys).

### Docker credential error

If `docker compose up` fails with `error getting credentials`, your Docker credential helper is broken. The images are public, so pull them with an empty config: `DOCKER_CONFIG=$(mktemp -d) docker compose up -d`. This uses the `default` Docker context, so list those containers with `docker --context default ps`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm worker` | App on :3100 / research worker (`pnpm worker:dev` restarts on change) |
| `pnpm emulator` | Firebase Auth emulator on :9099 |
| `pnpm typecheck` · `pnpm lint` | Route types + `tsc --noEmit` · ESLint |
| `pnpm check` | typecheck + lint + build |
| `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:studio` | Drizzle migrations / studio |

## Architecture

A modular monolith plus one worker:

```
src/
  app/
    (marketing)/   /, /pricing, /terms, /privacy (light landing design)
    (auth)/        /login, /signup (light split-screen design)
    (onboarding)/  /onboarding
    (app)/app/     dashboard, ideas, projects/[id]/{research,competitors,validation,plan}, research, lab, settings
    p/[slug]/      public validation landing pages
    api/           auth/session, health, p/[slug]/{visit,signup}, stripe/webhook
  components/      ui (shadcn), app shell, ideas, research, lab, plan, billing, landing, auth
  server/
    auth/          firebase-admin, session cookies, getCurrentUser()/requireUser()
    db/            Drizzle schema, client, migrations
    data/          data-access layer: every query scoped by the verified userId
    ai/            providers.ts, run.ts (credits → model → Zod → usage log → refund), prompts/ (versioned)
    search/        provider interface, tavily.ts, mock.ts, reader.ts (SSRF-safe)
    jobs/          BullMQ queues, research pipeline + citation verifier, Gold Mine pain miner
    keywords/      KeywordDataProvider: dataforseo, mock
    discussions/   DiscussionReader: web, reddit, mock
    billing/       credits ledger, Stripe client, subscriptions/webhook handling
    services/      use cases: ideas, research, validation, planning, build kit, project context
  lib/             env (Zod), brand, plans, validation schemas
worker/            worker entrypoint
```

### Security model

- **Auth:** the Firebase client SDK signs in, and the server verifies the ID token (recent sign-in required) and issues an httpOnly `__session` cookie. Every page, action and route handler verifies it with firebase-admin, including revocation.
- **Isolation without RLS:** `src/server/data/*` functions take a branded `UserId` that only a verified session produces, and filter every query by it, through `projects.user_id` for child tables. Foreign records behave as "not found".
- **Rate limits (Redis):** AI calls are limited per user (6/min, 60/h) and research per user (10/h). Waitlist signups are limited per hashed IP. Visits are counted once per visitor per 30 minutes, and bots are ignored.
- **Credits:** reserved before work under a row lock (no overspending under concurrency) and refunded exactly once on failure (unique index). Monthly allowance per plan, reset each calendar month.
- **Stripe webhooks:** signature-verified. The event id is stored in the same transaction as its effects, so each event applies once and retries stay safe.
- Security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `COOP`) come from Next.js, and HSTS from Caddy.

### Research pipeline (worker)

`queued → planning → searching → reading → extracting → synthesizing → verifying → saving`. The UI shows only the stage the worker reports, with no fake percentages. Failures store a safe message and refund credits. Stale jobs are failed and refunded on worker start and every 5 minutes.

## Configuration

Copy `.env.example` to `.env`. Core settings fail fast. A missing integration shows a "missing configuration" notice in the UI that names the variables, and **Settings → Integrations** lists the status of each service (development only).

## Accounts & keys

| Service | Where to get it | Env vars |
|---|---|---|
| **Firebase** | [console.firebase.google.com](https://console.firebase.google.com): create a project; under **Authentication → Sign-in method**, enable Email/Password and Google. **Project settings → Your apps → Web app** has the public config. **Service accounts → Generate new private key** gives the admin credentials. Add your domain under **Authentication → Settings → Authorized domains**. | `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_ADMIN_*` |
| **AI** | Anthropic: [console.anthropic.com](https://console.anthropic.com) → API Keys. OpenAI also works (`AI_PROVIDER=openai`). | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL_FAST` (e.g. `claude-haiku-5-5`), `AI_MODEL_SMART` (e.g. `claude-opus-5-5`) |
| **Tavily** | [app.tavily.com](https://app.tavily.com) | `SEARCH_PROVIDER=tavily`, `SEARCH_API_KEY` |
| **DataForSEO** (Gold Mine demand) | [app.dataforseo.com/api-access](https://app.dataforseo.com/api-access): API login + password, pay-as-you-go | `KEYWORD_PROVIDER=dataforseo`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` |
| **Stripe** | [dashboard.stripe.com](https://dashboard.stripe.com) (use test mode first): create two monthly Prices (Founder $49, Studio $69), then add a webhook endpoint `https://YOUR_DOMAIN/api/stripe/webhook` with events `checkout.session.completed` and `customer.subscription.created/updated/deleted/paused/resumed`. Enable the Customer Portal. Local testing: `stripe listen --forward-to localhost:3100/api/stripe/webhook`. | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_FOUNDER_MONTHLY`, `STRIPE_PRICE_STUDIO_MONTHLY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| **Stripe Connect** (Marketplace) | Same Stripe account → **Connect → Get started**, choose Express. Add `account.updated` and `charge.dispute.created` to the webhook and enable connected-account events. | `MARKETPLACE_ENABLED`, `MARKETPLACE_PAYMENTS=stripe`, `MARKETPLACE_FEE_PERCENT`, `MARKETPLACE_AUTO_CONFIRM_DAYS`, `ADMIN_EMAILS` |
| **Google Stitch** (MVP design) | [stitch.withgoogle.com](https://stitch.withgoogle.com): create an API key (see its docs) | `DESIGN_PROVIDER=stitch`, `STITCH_API_KEY` |
| **Resend** (optional) | [resend.com](https://resend.com) | `RESEND_API_KEY`, `EMAIL_FROM` |
| **Sentry** (optional) | [sentry.io](https://sentry.io) → project DSN. Loaded only when set. | `SENTRY_DSN` |

## Deploying to a VPS

1. Install Docker on an Ubuntu server and point your domain's A/AAAA records at it.
2. Copy the repo to the server (e.g. `/opt/stratum`), then `cp .env.production.example .env.production` and fill it in. `DATABASE_URL` must use the same password as `POSTGRES_PASSWORD`.
3. Run `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`.
   This starts Postgres (pgvector) and Redis, runs migrations once, and then starts the app, the worker and Caddy (automatic HTTPS).
4. Check `https://YOUR_DOMAIN/api/health`, which returns `{"status":"ok"}`.
5. Set up backups: run `crontab -e` and add `0 3 * * * /opt/stratum/scripts/backup.sh >> /var/log/stratum-backup.log 2>&1`.
   Daily `pg_dump` files land in `./backups` and are kept for 14 days. The restore command is in the script header. Copy backups off the server too.
6. To update: `git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`.

The images build and pass a smoke test locally (health, pages, auth redirect, security headers, migrations). A real deployment still needs your domain, DNS and production keys.

## Before going live

- Replace the bracketed placeholders in `/terms` and `/privacy`, and have them reviewed by a lawyer.
- Set `BRAND.supportEmail` in `src/lib/brand.ts`.
- Use Stripe live keys and live Price ids only after testing the full checkout → webhook → plan flow in test mode.
- Remove every `*_EMULATOR_HOST` variable. Never set `AI_PROVIDER=mock` or `MARKETPLACE_PAYMENTS=mock` (both are refused in production anyway).
- Marketplace: have the NDA and Asset Transfer Agreement templates (`src/lib/marketplace/terms.ts`) **reviewed by a lawyer**. Test the full Connect flow in Stripe test mode. Mention in your privacy policy that NDA and agreement acceptances store the IP address.

## Design references

`stitch_ai_saas_validation_platform_landing_page/` holds the original static designs. The public site and auth screens use that light design (`src/app/(marketing)/landing.css`, `src/app/(auth)/auth.css`). The app uses the dark theme tokens in `src/app/globals.css`.
