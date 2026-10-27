import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const planEnum = pgEnum("plan", ["free", "founder", "studio"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const projectStageEnum = pgEnum("project_stage", [
  "idea",
  "research",
  "validation",
  "planning",
  "building",
  "launched",
]);
export const projectStatusEnum = pgEnum("project_status", ["active", "archived"]);
export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "succeeded", "failed", "cancelled"]);
export const reportTypeEnum = pgEnum("report_type", ["validation", "competitors", "business_model"]);
export const evidenceKindEnum = pgEnum("evidence_kind", ["FACT", "ANALYSIS", "ASSUMPTION"]);
export const competitorTypeEnum = pgEnum("competitor_type", ["direct", "indirect", "alternative"]);
export const competitorOriginEnum = pgEnum("competitor_origin", ["research", "scan", "manual"]);
export const experimentTypeEnum = pgEnum("experiment_type", [
  "interview",
  "survey",
  "landing_page",
  "waitlist",
  "demo_request",
  "outreach",
  "pre_sale",
]);
export const experimentStatusEnum = pgEnum("experiment_status", [
  "planned",
  "running",
  "completed",
  "cancelled",
]);
export const decisionEnum = pgEnum("decision", ["build", "pivot", "drop"]);
export const ideaStatusEnum = pgEnum("idea_status", ["generated", "saved", "dismissed", "converted"]);
export const creditReasonEnum = pgEnum("credit_reason", [
  "monthly_grant",
  "purchase",
  "reservation",
  "usage",
  "refund",
  "adjustment",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
]);
export const aiUsageStatusEnum = pgEnum("ai_usage_status", ["success", "error", "invalid_output"]);
export const goldMineModeEnum = pgEnum("gold_mine_mode", ["market", "idea"]);
export const goldMineStepEnum = pgEnum("gold_mine_step", ["market", "demand", "pains", "ideas", "landing"]);
export const goldMineStatusEnum = pgEnum("gold_mine_status", ["active", "completed", "archived"]);
export const trendClassEnum = pgEnum("trend_class", ["growing", "stable", "fad", "declining", "unknown"]);
export const channelTypeEnum = pgEnum("channel_type", ["organic", "paid"]);
export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "done"]);
export const channelRoleEnum = pgEnum("channel_role", ["primary", "test", "later"]);
export const channelStatusEnum = pgEnum("channel_status", ["planned", "active", "paused", "stopped"]);
export const assetTypeEnum = pgEnum("asset_type", [
  "ad_variants",
  "social_posts",
  "community_post",
  "cold_email_sequence",
  "dm_script",
  "seo_keywords",
  "article_outline",
  "launch_post",
  "newsletter_pitch",
]);
export const adTestStatusEnum = pgEnum("ad_test_status", ["draft", "running", "completed", "stopped"]);
export const pageEventTypeEnum = pgEnum("page_event_type", ["visit", "signup"]);

/* -------------------------------------------------------------------------- */
/* Accounts                                                                   */
/* -------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: id(),
  firebaseUid: text("firebase_uid").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  plan: planEnum("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  role: userRoleEnum("role").notNull().default("user"),
  /** Set by an admin: the user can no longer list, offer or buy on the marketplace. */
  marketplaceBannedAt: timestamp("marketplace_banned_at", { withTimezone: true }),
  /** Set by an admin: the user can't sign in until an admin lifts it. */
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspendedReason: text("suspended_reason"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  /** When the founder closed the one-time welcome popup (components/app/welcome-modal.tsx). */
  welcomeSeenAt: timestamp("welcome_seen_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const profiles = pgTable("profiles", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Onboarding answers; shape defined by `onboardingSchema` (src/lib/validation/onboarding.ts). */
  answers: jsonb("answers").notNull().$type<Record<string, unknown>>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* -------------------------------------------------------------------------- */
/* Projects & ideas                                                           */
/* -------------------------------------------------------------------------- */

export const projects = pgTable(
  "projects",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    stage: projectStageEnum("stage").notNull().default("idea"),
    status: projectStatusEnum("status").notNull().default("active"),
    nextAction: text("next_action"),
    decision: decisionEnum("decision"),
    decisionNote: text("decision_note"),
    /** Set while the owner shares a read-only verdict report at /r/<token>; null = not shared. */
    shareToken: text("share_token"),
    /** Brand Kit (names, palette, fonts, logo spec); validated by brandKitSchema. */
    brand: jsonb("brand").$type<Record<string, unknown>>(),
    /** Google Stitch project that holds this project's MVP design screens. */
    designProjectId: text("design_project_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("projects_user_idx").on(t.userId, t.status, t.updatedAt), uniqueIndex("projects_share_token_idx").on(t.shareToken)],
);

export const ideas = pgTable(
  "ideas",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    /** Structured idea (problem, customer, alternatives, ...); validated by Zod in the AI layer. */
    content: jsonb("content").notNull().$type<Record<string, unknown>>(),
    inputs: jsonb("inputs").$type<Record<string, unknown>>(),
    status: ideaStatusEnum("status").notNull().default("generated"),
    promptVersion: text("prompt_version"),
    /** Set when the idea came from a Gold Mine session (evidence-first ideas). */
    goldMineSessionId: uuid("gold_mine_session_id").references(() => goldMineSessions.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("ideas_user_idx").on(t.userId, t.status, t.createdAt), index("ideas_gold_mine_idx").on(t.goldMineSessionId)],
);

/* -------------------------------------------------------------------------- */
/* Research                                                                   */
/* -------------------------------------------------------------------------- */

export const researchJobs = pgTable(
  "research_jobs",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: jobStatusEnum("status").notNull().default("queued"),
    currentStage: text("current_stage"),
    input: jsonb("input").$type<Record<string, unknown>>(),
    error: text("error"),
    creditsReserved: integer("credits_reserved").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("research_jobs_project_idx").on(t.projectId, t.createdAt)],
);

export const reports = pgTable(
  "reports",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    researchJobId: uuid("research_job_id").references(() => researchJobs.id, { onDelete: "set null" }),
    type: reportTypeEnum("type").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    content: jsonb("content").notNull().$type<Record<string, unknown>>(),
    summary: text("summary"),
    /** Separate ratings, each with a justification — never a single "success probability". */
    ratings: jsonb("ratings").$type<Record<string, { score: number; justification: string }>>(),
    createdAt: createdAt(),
  },
  (t) => [index("reports_project_idx").on(t.projectId, t.type, t.createdAt)],
);

export const sources = pgTable(
  "sources",
  {
    id: id(),
    reportId: uuid("report_id").references(() => reports.id, { onDelete: "cascade" }),
    researchJobId: uuid("research_job_id").references(() => researchJobs.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    domain: text("domain").notNull(),
    snippet: text("snippet"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("sources_report_idx").on(t.reportId), index("sources_job_idx").on(t.researchJobId)],
);

export const evidence = pgTable(
  "evidence",
  {
    id: id(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    /** Required for FACT; ANALYSIS/ASSUMPTION may have no source. */
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    claim: text("claim").notNull(),
    kind: evidenceKindEnum("kind").notNull(),
    section: text("section"),
    createdAt: createdAt(),
  },
  (t) => [index("evidence_report_idx").on(t.reportId)],
);

export const competitors = pgTable(
  "competitors",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    website: text("website"),
    type: competitorTypeEnum("type").notNull(),
    features: jsonb("features").$type<string[]>(),
    /** Only stored when found in a source; `pricingSourceId` must then be set. */
    pricing: jsonb("pricing").$type<Record<string, unknown>>(),
    pricingSourceId: uuid("pricing_source_id").references(() => sources.id, { onDelete: "set null" }),
    strengths: jsonb("strengths").$type<string[]>(),
    weaknesses: jsonb("weaknesses").$type<string[]>(),
    /** research = from a research report (replaced on re-run); scan = competitor scan; manual = added by the user (unverified). */
    origin: competitorOriginEnum("origin").notNull().default("research"),
    description: text("description"),
    targetCustomer: text("target_customer"),
    /** Plans found in a source: each price was matched inside the quoted source text. */
    pricingPlans: jsonb("pricing_plans").$type<{ name: string; priceMonthly: number | null; currency: string; quote: string }[]>(),
    /** Every stored source this competitor's data came from. */
    sourceIds: jsonb("source_ids").$type<string[]>(),
    notes: text("notes"),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("competitors_project_idx").on(t.projectId)],
);

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export const experiments = pgTable(
  "experiments",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: experimentTypeEnum("type").notNull(),
    title: text("title").notNull(),
    hypothesis: text("hypothesis").notNull(),
    audience: text("audience"),
    procedure: text("procedure"),
    successCriteria: text("success_criteria").notNull(),
    status: experimentStatusEnum("status").notNull().default("planned"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    learnings: text("learnings"),
    nextAction: text("next_action"),
    /** Set only from results recorded by the user. */
    passed: boolean("passed"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("experiments_project_idx").on(t.projectId)],
);

export const experimentResults = pgTable(
  "experiment_results",
  {
    id: id(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(),
    value: numeric("value"),
    notes: text("notes"),
    /** Structured payload, e.g. an AI analysis of interview notes. */
    data: jsonb("data").$type<Record<string, unknown>>(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("experiment_results_exp_idx").on(t.experimentId)],
);

export const landingPages = pgTable(
  "landing_pages",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    experimentId: uuid("experiment_id").references(() => experiments.id, { onDelete: "set null" }),
    slug: text("slug").notNull(),
    content: jsonb("content").notNull().$type<Record<string, unknown>>(),
    published: boolean("published").notNull().default(false),
    visitCount: integer("visit_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("landing_pages_slug_idx").on(t.slug)],
);

export const waitlistSignups = pgTable(
  "waitlist_signups",
  {
    id: id(),
    landingPageId: uuid("landing_page_id")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    source: text("source"),
    /** Explicit opt-in to have the email passed to a future owner of the product (marketplace transfer). */
    consentTransfer: boolean("consent_transfer").notNull().default(false),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    consentVersion: text("consent_version"),
    /** Email removed at a marketplace transfer (no consent); the row keeps the signup count honest. */
    redacted: boolean("redacted").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("waitlist_unique_email_idx").on(t.landingPageId, t.email)],
);

export const mvpPlans = pgTable(
  "mvp_plans",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    content: jsonb("content").notNull().$type<Record<string, unknown>>(),
    schemaVersion: integer("schema_version").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("mvp_plans_project_idx").on(t.projectId)],
);

/* -------------------------------------------------------------------------- */
/* Project memory                                                             */
/* -------------------------------------------------------------------------- */

export const EMBEDDING_DIMENSIONS = 1536;

export const embeddings = pgTable(
  "embeddings",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceRef: uuid("source_ref"),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("embeddings_project_idx").on(t.projectId),
    index("embeddings_vector_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

/* -------------------------------------------------------------------------- */
/* Billing & usage                                                            */
/* -------------------------------------------------------------------------- */

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Positive = credits added, negative = credits consumed/reserved. */
    delta: integer("delta").notNull(),
    reason: creditReasonEnum("reason").notNull(),
    /** Links reservations, usage and refunds (e.g. a research job id). */
    referenceId: text("reference_id"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("credit_ledger_user_idx").on(t.userId, t.createdAt),
    // One monthly grant per user per period, and at most one refund per reservation.
    uniqueIndex("credit_ledger_grant_unique_idx")
      .on(t.userId, t.referenceId)
      .where(sql`${t.reason} = 'monthly_grant'`),
    uniqueIndex("credit_ledger_refund_unique_idx")
      .on(t.userId, t.referenceId)
      .where(sql`${t.reason} = 'refund'`),
  ],
);

export const subscriptions = pgTable("subscriptions", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  stripePriceId: text("stripe_price_id").notNull(),
  plan: planEnum("plan").notNull(),
  status: subscriptionStatusEnum("status").notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const stripeEvents = pgTable("stripe_events", {
  /** Stripe event id (evt_...) — primary key makes webhook processing idempotent. */
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    operation: text("operation").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }),
    durationMs: integer("duration_ms").notNull(),
    status: aiUsageStatusEnum("status").notNull(),
    errorCode: text("error_code"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_usage_logs_user_idx").on(t.userId, t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/* Gold Mine — evidence-first opportunity finder                              */
/* -------------------------------------------------------------------------- */

/** One market tree per user, expanded lazily one level at a time. */
export const marketMaps = pgTable("market_maps", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  /** { nodes: { id, parentId, label, description, depth, expanded }[] } — validated by Zod. */
  tree: jsonb("tree").notNull().$type<Record<string, unknown>>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const goldMineSessions = pgTable(
  "gold_mine_sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    mode: goldMineModeEnum("mode").notNull(),
    niche: text("niche").notNull(),
    ideaDescription: text("idea_description"),
    /** Breadcrumb from the market map (mode A). */
    marketPath: jsonb("market_path").$type<string[]>(),
    currentStep: goldMineStepEnum("current_step").notNull(),
    status: goldMineStatusEnum("status").notNull().default("active"),
    /** Deterministic demand summary: verdict, competitor count, provider. */
    demandSummary: jsonb("demand_summary").$type<Record<string, unknown>>(),
    demandAcknowledged: boolean("demand_acknowledged").notNull().default(false),
    miningStatus: jobStatusEnum("mining_status"),
    miningStage: text("mining_stage"),
    miningError: text("mining_error"),
    miningStats: jsonb("mining_stats").$type<Record<string, number>>(),
    miningStartedAt: timestamp("mining_started_at", { withTimezone: true }),
    miningFinishedAt: timestamp("mining_finished_at", { withTimezone: true }),
    landingPageId: uuid("landing_page_id").references(() => landingPages.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("gold_mine_sessions_user_idx").on(t.userId, t.status, t.updatedAt)],
);

export const demandChecks = pgTable(
  "demand_checks",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => goldMineSessions.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    /** Average monthly searches; null when the provider had no data. */
    volume: integer("volume"),
    /** Monthly interest series, oldest first: { month: "YYYY-MM", value }[]. */
    trend: jsonb("trend").$type<{ month: string; value: number }[]>(),
    trendClass: trendClassEnum("trend_class").notNull().default("unknown"),
    provider: text("provider").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("demand_checks_session_idx").on(t.sessionId), index("demand_checks_user_idx").on(t.userId)],
);

/** Short verbatim quotes from public discussions. Never full threads. */
export const painQuotes = pgTable(
  "pain_quotes",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => goldMineSessions.id, { onDelete: "cascade" }),
    quote: text("quote").notNull(),
    url: text("url").notNull(),
    platform: text("platform").notNull(),
    community: text("community"),
    threadTitle: text("thread_title"),
    /** When the discussion was posted, if the source exposes it. */
    postedAt: timestamp("posted_at", { withTimezone: true }),
    /** When we fetched the page. Always set. */
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    /** Comments/upvotes as reported by the source; null if unknown. */
    engagement: integer("engagement"),
    /** Normalised hash for de-duplication within a session. */
    dedupeHash: text("dedupe_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("pain_quotes_session_idx").on(t.sessionId),
    index("pain_quotes_user_idx").on(t.userId),
    uniqueIndex("pain_quotes_dedupe_idx").on(t.sessionId, t.dedupeHash),
  ],
);

export const painClusters = pgTable(
  "pain_clusters",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => goldMineSessions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    /** Number of quotes in the cluster (computed, not AI). */
    frequency: integer("frequency").notNull(),
    /** 1–5, judged from the quotes' wording. */
    intensity: integer("intensity").notNull(),
    /** Share (0–1) of dated quotes from the last 12 months (computed). */
    recency: numeric("recency", { precision: 4, scale: 3 }),
    rank: integer("rank").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("pain_clusters_session_idx").on(t.sessionId, t.rank), index("pain_clusters_user_idx").on(t.userId)],
);

export const painClusterQuotes = pgTable(
  "pain_cluster_quotes",
  {
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => painClusters.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => painQuotes.id, { onDelete: "cascade" }),
    isBest: boolean("is_best").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.clusterId, t.quoteId] }), index("pain_cluster_quotes_quote_idx").on(t.quoteId)],
);

export const ideaPainLinks = pgTable(
  "idea_pain_links",
  {
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => painClusters.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.ideaId, t.clusterId] }), index("idea_pain_links_cluster_idx").on(t.clusterId)],
);

/** A project's customer-language library: quotes copied in when an idea becomes a project. */
export const customerLanguageQuotes = pgTable(
  "customer_language_quotes",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceQuoteId: uuid("source_quote_id").references(() => painQuotes.id, { onDelete: "set null" }),
    clusterTitle: text("cluster_title").notNull(),
    quote: text("quote").notNull(),
    url: text("url").notNull(),
    platform: text("platform").notNull(),
    community: text("community"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("customer_language_project_idx").on(t.projectId),
    uniqueIndex("customer_language_unique_idx").on(t.projectId, t.sourceQuoteId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Marketing Studio — marketing plans, playbook tasks and channel results        */
/* -------------------------------------------------------------------------- */

export const marketingPlans = pgTable(
  "marketing_plans",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Positioning, channels, ad + content drafts; validated by Zod. */
    content: jsonb("content").notNull().$type<Record<string, unknown>>(),
    /** Go-to-market setup the plan was generated from (budget, hours, goal…); validated by Zod. */
    inputs: jsonb("inputs").$type<Record<string, unknown>>(),
    schemaVersion: integer("schema_version").notNull(),
    promptVersion: text("prompt_version"),
    createdAt: createdAt(),
  },
  (t) => [index("marketing_plans_project_idx").on(t.projectId, t.createdAt), index("marketing_plans_user_idx").on(t.userId)],
);

/** Step-by-step playbook tasks the founder ticks off. */
export const marketingTasks = pgTable(
  "marketing_tasks",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => marketingPlans.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    week: integer("week").notNull(),
    position: integer("position").notNull(),
    channel: text("channel").notNull(),
    channelType: channelTypeEnum("channel_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    successMetric: text("success_metric"),
    expectedOutput: text("expected_output"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    status: taskStatusEnum("status").notNull().default("todo"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("marketing_tasks_plan_idx").on(t.planId, t.week, t.position), index("marketing_tasks_user_idx").on(t.userId)],
);

/** Results the founder records per channel (spend, visits, signups, customers). */
export const channelResults = pgTable(
  "channel_results",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    channelType: channelTypeEnum("channel_type").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    channelId: uuid("channel_id").references(() => marketingChannels.id, { onDelete: "set null" }),
    adExperimentId: uuid("ad_experiment_id").references(() => adExperiments.id, { onDelete: "cascade" }),
    adVariantId: uuid("ad_variant_id").references(() => adVariants.id, { onDelete: "cascade" }),
    spend: numeric("spend", { precision: 12, scale: 2 }),
    impressions: integer("impressions"),
    clicks: integer("clicks"),
    visits: integer("visits"),
    signups: integer("signups"),
    customers: integer("customers"),
    revenue: numeric("revenue", { precision: 12, scale: 2 }),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    index("channel_results_project_idx").on(t.projectId, t.periodStart),
    index("channel_results_user_idx").on(t.userId),
    index("channel_results_ad_idx").on(t.adExperimentId),
  ],
);

/** Channels the founder runs for a project, each with its own budget and status. */
export const marketingChannels = pgTable(
  "marketing_channels",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => marketingPlans.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    type: channelTypeEnum("type").notNull(),
    role: channelRoleEnum("role").notNull().default("later"),
    status: channelStatusEnum("status").notNull().default("planned"),
    /** User-set monthly budget; null = not budgeted. */
    monthlyBudget: numeric("monthly_budget", { precision: 12, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    utmSource: text("utm_source").notNull(),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("marketing_channels_source_idx").on(t.projectId, t.utmSource), index("marketing_channels_user_idx").on(t.userId)],
);

/** Generated or edited marketing assets. Every edit is a new version in the same group. */
export const marketingAssets = pgTable(
  "marketing_assets",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => marketingChannels.id, { onDelete: "set null" }),
    channelName: text("channel_name").notNull(),
    type: assetTypeEnum("type").notNull(),
    groupId: uuid("group_id").notNull(),
    version: integer("version").notNull().default(1),
    title: text("title").notNull(),
    /** Type-specific structure; validated by Zod. */
    content: jsonb("content").notNull().$type<Record<string, unknown>>(),
    policyWarnings: jsonb("policy_warnings").notNull().$type<string[]>().default([]),
    source: text("source").notNull().default("ai"),
    promptVersion: text("prompt_version"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("marketing_assets_version_idx").on(t.groupId, t.version), index("marketing_assets_project_idx").on(t.projectId, t.createdAt), index("marketing_assets_user_idx").on(t.userId)],
);

/** Which customer quotes an asset was written from. */
export const assetSourceQuotes = pgTable(
  "asset_source_quotes",
  {
    assetId: uuid("asset_id")
      .notNull()
      .references(() => marketingAssets.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => customerLanguageQuotes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.quoteId] }), index("asset_source_quotes_quote_idx").on(t.quoteId)],
);

/** A small-budget paid ad experiment with 2–3 variants and a stop/continue rule set up front. */
export const adExperiments = pgTable(
  "ad_experiments",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => marketingChannels.id, { onDelete: "set null" }),
    platform: text("platform").notNull(),
    name: text("name").notNull(),
    hypothesis: text("hypothesis").notNull(),
    audience: text("audience").notNull(),
    budgetTotal: numeric("budget_total", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    durationDays: integer("duration_days").notNull(),
    /** User-set threshold: a variant above this cost per signup (after minClicks) should stop. */
    maxCostPerSignup: numeric("max_cost_per_signup", { precision: 12, scale: 2 }).notNull(),
    minClicks: integer("min_clicks").notNull().default(100),
    status: adTestStatusEnum("status").notNull().default("draft"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    labExperimentId: uuid("lab_experiment_id").references(() => experiments.id, { onDelete: "set null" }),
    decisionNote: text("decision_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("ad_experiments_project_idx").on(t.projectId, t.createdAt), index("ad_experiments_user_idx").on(t.userId)],
);

export const adVariants = pgTable(
  "ad_variants",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    adExperimentId: uuid("ad_experiment_id")
      .notNull()
      .references(() => adExperiments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    angle: text("angle").notNull().default(""),
    headline: text("headline").notNull(),
    primaryText: text("primary_text").notNull(),
    cta: text("cta").notNull(),
    audienceIdea: text("audience_idea").notNull().default(""),
    assetId: uuid("asset_id").references(() => marketingAssets.id, { onDelete: "set null" }),
    utmContent: text("utm_content").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("ad_variants_experiment_idx").on(t.adExperimentId, t.position)],
);

/** Tagged links to a project's landing page, per channel or ad variant. */
export const utmLinks = pgTable(
  "utm_links",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    landingPageId: uuid("landing_page_id")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => marketingChannels.id, { onDelete: "set null" }),
    adVariantId: uuid("ad_variant_id").references(() => adVariants.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    medium: text("medium").notNull(),
    campaign: text("campaign").notNull(),
    content: text("content").notNull().default(""),
    url: text("url").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("utm_links_unique_idx").on(t.landingPageId, t.source, t.medium, t.campaign, t.content), index("utm_links_project_idx").on(t.projectId)],
);

/** Visits and signups on hosted landing pages, with their UTM tags. Tracked by us, so "verified". */
export const pageEvents = pgTable(
  "page_events",
  {
    id: id(),
    landingPageId: uuid("landing_page_id")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    type: pageEventTypeEnum("type").notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    createdAt: createdAt(),
  },
  (t) => [index("page_events_page_idx").on(t.landingPageId, t.createdAt), index("page_events_source_idx").on(t.landingPageId, t.utmSource, t.utmCampaign)],
);

/** "Next best step" recommendations, with the metrics snapshot they were based on. */
export const marketingRecommendations = pgTable(
  "marketing_recommendations",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    content: jsonb("content").notNull().$type<Record<string, unknown>>(),
    basedOn: jsonb("based_on").notNull().$type<Record<string, unknown>>(),
    promptVersion: text("prompt_version"),
    createdAt: createdAt(),
  },
  (t) => [index("marketing_recommendations_project_idx").on(t.projectId, t.createdAt)],
);


/* -------------------------------------------------------------------------- */
/* Idea Marketplace (behind MARKETPLACE_ENABLED)                              */
/* -------------------------------------------------------------------------- */

export const listingStatusEnum = pgEnum("listing_status", ["draft", "pending_review", "published", "rejected", "unpublished", "sold"]);
export const licenseTypeEnum = pgEnum("license_type", ["exclusive_transfer", "non_exclusive"]);
export const priceTypeEnum = pgEnum("price_type", ["fixed", "offers"]);
export const validationLevelEnum = pgEnum("validation_level", ["none", "researched", "tested", "validated", "revenue"]);
export const listingKindEnum = pgEnum("listing_kind", ["project", "idea"]);
export const listingAssetKindEnum = pgEnum("listing_asset_kind", [
  "idea",
  "research_reports",
  "pain_quotes",
  "competitors",
  "experiments",
  "mvp_plan",
  "marketing",
  "landing_page",
  "waitlist",
  "domain",
  "code_repo",
  "social_accounts",
  "stripe_account",
  "other_external",
]);
export const offerStatusEnum = pgEnum("offer_status", ["pending", "accepted", "rejected", "countered", "withdrawn"]);
export const dealStateEnum = pgEnum("deal_state", [
  "DRAFT_OFFER",
  "ACCEPTED",
  "PAYMENT_HELD",
  "TRANSFER_IN_PROGRESS",
  "BUYER_CONFIRMED",
  "PAID_OUT",
  "CANCELLED",
  "REFUNDED",
  "DISPUTED",
]);
export const paymentStatusEnum = pgEnum("marketplace_payment_status", ["pending", "succeeded", "refunded", "failed"]);
export const payoutStatusEnum = pgEnum("payout_status", ["blocked", "pending", "paid", "failed"]);
export const disputeStatusEnum = pgEnum("dispute_status", ["open", "resolved_refund", "resolved_release", "resolved_continue"]);
export const reportStatusEnum = pgEnum("listing_report_status", ["open", "dismissed", "actioned"]);

export const listings = pgTable(
  "listings",
  {
    id: id(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    /** project = a full project package; idea = a single saved idea or sub-idea. */
    kind: listingKindEnum("kind").notNull().default("project"),
    ideaId: uuid("idea_id").references(() => ideas.id, { onDelete: "set null" }),
    /** Public: the only things shown before NDA + access are niche, price and the earning estimate. */
    niche: text("niche").notNull().default(""),
    /** Seller's estimate of monthly revenue potential (cents). Always labelled as a seller estimate. */
    earningMinCents: integer("earning_min_cents"),
    earningMaxCents: integer("earning_max_cents"),
    /** How the seller got to the estimate. Shown only after access. */
    earningBasis: text("earning_basis").notNull().default(""),
    status: listingStatusEnum("status").notNull().default("draft"),
    licenseType: licenseTypeEnum("license_type").notNull(),
    priceType: priceTypeEnum("price_type").notNull(),
    /** Fixed price, or the asking price when accepting offers. */
    priceCents: integer("price_cents").notNull(),
    minPriceCents: integer("min_price_cents"),
    maxPriceCents: integer("max_price_cents"),
    currency: text("currency").notNull().default("usd"),
    title: text("title").notNull(),
    /** Public teaser (no secrets); validated by Zod. */
    teaser: jsonb("teaser").notNull().$type<Record<string, unknown>>(),
    /** Computed by the platform from tracked data at submission; never self-declared. */
    validationLevel: validationLevelEnum("validation_level").notNull().default("none"),
    metrics: jsonb("metrics").notNull().$type<Record<string, unknown>>().default({}),
    nonCompeteMonths: integer("non_compete_months").notNull().default(12),
    nonCompeteScope: text("non_compete_scope").notNull().default(""),
    ownershipConfirmed: boolean("ownership_confirmed").notNull().default(false),
    originalWorkDeclared: boolean("original_work_declared").notNull().default(false),
    /** Feature-hashed text embedding of teaser + report summary, for duplicate detection. */
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    similarity: jsonb("similarity").$type<{ listingId: string; score: number } | null>(),
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("listings_status_idx").on(t.status, t.publishedAt), index("listings_seller_idx").on(t.sellerId)],
);

export const listingAssets = pgTable(
  "listing_assets",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    kind: listingAssetKindEnum("kind").notNull(),
    /** For external assets: what exactly is transferred (domain name, repo URL…), shown after NDA. */
    description: text("description").notNull().default(""),
  },
  (t) => [uniqueIndex("listing_assets_kind_idx").on(t.listingId, t.kind)],
);

/** Every access to a listing (teaser or full details), for the seller's protection. */
export const listingViews = pgTable(
  "listing_views",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    viewerId: uuid("viewer_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("listing_views_listing_idx").on(t.listingId, t.createdAt)],
);

export const ndaAcceptances = pgTable(
  "nda_acceptances",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("nda_unique_idx").on(t.listingId, t.userId, t.version)],
);

/** Buyer asks to see full details; the seller grants or declines. */
export const listingAccess = pgTable(
  "listing_access",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("requested"),
    message: text("message"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("listing_access_unique_idx").on(t.listingId, t.buyerId)],
);

export const deals = pgTable(
  "deals",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: dealStateEnum("state").notNull().default("DRAFT_OFFER"),
    /** State before a dispute, so an admin can resume it. */
    stateBeforeDispute: dealStateEnum("state_before_dispute"),
    licenseType: licenseTypeEnum("license_type").notNull(),
    amountCents: integer("amount_cents"),
    platformFeeCents: integer("platform_fee_cents"),
    currency: text("currency").notNull().default("usd"),
    autoConfirmAt: timestamp("auto_confirm_at", { withTimezone: true }),
    buyerConfirmedAt: timestamp("buyer_confirmed_at", { withTimezone: true }),
    /** Project the buyer received (moved or cloned). */
    deliveredProjectId: uuid("delivered_project_id").references(() => projects.id, { onDelete: "set null" }),
    /** Idea the buyer received (moved or copied), for idea listings. */
    deliveredIdeaId: uuid("delivered_idea_id").references(() => ideas.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("deals_buyer_idx").on(t.buyerId), index("deals_seller_idx").on(t.sellerId), index("deals_listing_idx").on(t.listingId, t.state)],
);

export const offers = pgTable(
  "offers",
  {
    id: id(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    message: text("message"),
    status: offerStatusEnum("status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [index("offers_deal_idx").on(t.dealId, t.createdAt)],
);

export const dealMessages = pgTable(
  "deal_messages",
  {
    id: id(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("deal_messages_deal_idx").on(t.dealId, t.createdAt)],
);

export const dealTransferItems = pgTable(
  "deal_transfer_items",
  {
    id: id(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    kind: listingAssetKindEnum("kind").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    /** In-platform items move automatically on completion; external items need both confirmations. */
    inPlatform: boolean("in_platform").notNull().default(false),
    sellerDoneAt: timestamp("seller_done_at", { withTimezone: true }),
    sellerNote: text("seller_note"),
    buyerReceivedAt: timestamp("buyer_received_at", { withTimezone: true }),
    buyerNote: text("buyer_note"),
  },
  (t) => [index("deal_transfer_items_deal_idx").on(t.dealId)],
);

export const agreements = pgTable(
  "agreements",
  {
    id: id(),
    dealId: uuid("deal_id")
      .notNull()
      .unique()
      .references(() => deals.id, { onDelete: "cascade" }),
    templateVersion: text("template_version").notNull(),
    body: text("body").notNull(),
    /** sha256 of the exact body both parties accepted. */
    hash: text("hash").notNull(),
    sellerAcceptedAt: timestamp("seller_accepted_at", { withTimezone: true }),
    sellerIp: text("seller_ip"),
    buyerAcceptedAt: timestamp("buyer_accepted_at", { withTimezone: true }),
    buyerIp: text("buyer_ip"),
    createdAt: createdAt(),
  },
);

export const connectAccounts = pgTable("connect_accounts", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeAccountId: text("stripe_account_id").notNull().unique(),
  detailsSubmitted: boolean("details_submitted").notNull().default(false),
  chargesEnabled: boolean("charges_enabled").notNull().default(false),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const marketplacePayments = pgTable(
  "marketplace_payments",
  {
    id: id(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    checkoutSessionId: text("checkout_session_id").notNull().unique(),
    paymentIntentId: text("payment_intent_id"),
    chargeId: text("charge_id"),
    amountCents: integer("amount_cents").notNull(),
    feeCents: integer("fee_cents").notNull(),
    currency: text("currency").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    refundId: text("refund_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("marketplace_payments_deal_idx").on(t.dealId)],
);

export const payouts = pgTable(
  "payouts",
  {
    id: id(),
    dealId: uuid("deal_id")
      .notNull()
      .unique()
      .references(() => deals.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    status: payoutStatusEnum("status").notNull().default("blocked"),
    transferId: text("transfer_id"),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("payouts_seller_idx").on(t.sellerId, t.status)],
);

export const disputes = pgTable(
  "disputes",
  {
    id: id(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    openedBy: uuid("opened_by").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    status: disputeStatusEnum("status").notNull().default("open"),
    resolution: text("resolution"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    externalId: text("external_id"),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("disputes_deal_idx").on(t.dealId, t.status)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    revieweeId: uuid("reviewee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reviews_unique_idx").on(t.dealId, t.reviewerId), index("reviews_reviewee_idx").on(t.revieweeId)],
);

export const listingReports = pgTable(
  "listing_reports",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    status: reportStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("listing_reports_status_idx").on(t.status, t.createdAt)],
);

/** Append-only log of every listing and deal state change. */
export const marketplaceAuditLog = pgTable(
  "marketplace_audit_log",
  {
    id: id(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    fromState: text("from_state"),
    toState: text("to_state"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("marketplace_audit_deal_idx").on(t.dealId, t.createdAt), index("marketplace_audit_listing_idx").on(t.listingId, t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/* Admin console                                                              */
/* -------------------------------------------------------------------------- */

/** Runtime platform settings edited from the admin console. One row per key; shape in src/lib/platform-settings.ts. */
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().$type<Record<string, unknown>>(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/** Every admin action, append-only. */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("admin_audit_created_idx").on(t.createdAt), index("admin_audit_target_idx").on(t.targetType, t.targetId)],
);

/* -------------------------------------------------------------------------- */
/* MVP design (Google Stitch)                                                 */
/* -------------------------------------------------------------------------- */

export const designDeviceEnum = pgEnum("design_device", ["MOBILE", "DESKTOP"]);

/** One generated UI screen. An edit creates a new row (replacesId) and archives the one it replaces. */
export const designScreens = pgTable(
  "design_screens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** The research_jobs row that generated it (input.kind = "design"). */
    jobId: uuid("job_id").references(() => researchJobs.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    device: designDeviceEnum("device").notNull(),
    prompt: text("prompt").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    error: text("error"),
    provider: text("provider").notNull(),
    providerScreenId: text("provider_screen_id"),
    /** Full HTML of the screen (rendered only inside a sandboxed iframe). */
    html: text("html"),
    imageUrl: text("image_url"),
    replacesId: uuid("replaces_id"),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("design_screens_project_idx").on(t.projectId, t.archived, t.position)],
);

/* -------------------------------------------------------------------------- */
/* AI Copilot                                                                 */
/* -------------------------------------------------------------------------- */

/** One Copilot conversation: a tool (landing copy, cold email…) and optionally a project for context. */
export const copilotThreads = pgTable(
  "copilot_threads",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    tool: text("tool").notNull(),
    title: text("title").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("copilot_threads_user_idx").on(t.userId, t.updatedAt)],
);

export const copilotRoleEnum = pgEnum("copilot_role", ["user", "assistant"]);

export const copilotMessages = pgTable(
  "copilot_messages",
  {
    id: id(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => copilotThreads.id, { onDelete: "cascade" }),
    role: copilotRoleEnum("role").notNull(),
    content: text("content").notNull(),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    /** Served from the answer cache: no AI call, no credits, no tokens. */
    cached: boolean("cached").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("copilot_messages_thread_idx").on(t.threadId, t.createdAt)],
);
