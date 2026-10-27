CREATE TYPE "public"."gold_mine_mode" AS ENUM('market', 'idea');--> statement-breakpoint
CREATE TYPE "public"."gold_mine_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."gold_mine_step" AS ENUM('market', 'demand', 'pains', 'ideas', 'landing');--> statement-breakpoint
CREATE TYPE "public"."trend_class" AS ENUM('growing', 'stable', 'fad', 'declining', 'unknown');--> statement-breakpoint
CREATE TABLE "customer_language_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"source_quote_id" uuid,
	"cluster_title" text NOT NULL,
	"quote" text NOT NULL,
	"url" text NOT NULL,
	"platform" text NOT NULL,
	"community" text,
	"posted_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demand_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"volume" integer,
	"trend" jsonb,
	"trend_class" "trend_class" DEFAULT 'unknown' NOT NULL,
	"provider" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gold_mine_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"mode" "gold_mine_mode" NOT NULL,
	"niche" text NOT NULL,
	"idea_description" text,
	"market_path" jsonb,
	"current_step" "gold_mine_step" NOT NULL,
	"status" "gold_mine_status" DEFAULT 'active' NOT NULL,
	"demand_summary" jsonb,
	"demand_acknowledged" boolean DEFAULT false NOT NULL,
	"mining_status" "job_status",
	"mining_stage" text,
	"mining_error" text,
	"mining_stats" jsonb,
	"mining_started_at" timestamp with time zone,
	"mining_finished_at" timestamp with time zone,
	"landing_page_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idea_pain_links" (
	"idea_id" uuid NOT NULL,
	"cluster_id" uuid NOT NULL,
	CONSTRAINT "idea_pain_links_idea_id_cluster_id_pk" PRIMARY KEY("idea_id","cluster_id")
);
--> statement-breakpoint
CREATE TABLE "market_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tree" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_maps_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "pain_cluster_quotes" (
	"cluster_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"is_best" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pain_cluster_quotes_cluster_id_quote_id_pk" PRIMARY KEY("cluster_id","quote_id")
);
--> statement-breakpoint
CREATE TABLE "pain_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"frequency" integer NOT NULL,
	"intensity" integer NOT NULL,
	"recency" numeric(4, 3),
	"rank" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pain_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"quote" text NOT NULL,
	"url" text NOT NULL,
	"platform" text NOT NULL,
	"community" text,
	"thread_title" text,
	"posted_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone NOT NULL,
	"engagement" integer,
	"dedupe_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "gold_mine_session_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_language_quotes" ADD CONSTRAINT "customer_language_quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_language_quotes" ADD CONSTRAINT "customer_language_quotes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_language_quotes" ADD CONSTRAINT "customer_language_quotes_source_quote_id_pain_quotes_id_fk" FOREIGN KEY ("source_quote_id") REFERENCES "public"."pain_quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_checks" ADD CONSTRAINT "demand_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_checks" ADD CONSTRAINT "demand_checks_session_id_gold_mine_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."gold_mine_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gold_mine_sessions" ADD CONSTRAINT "gold_mine_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gold_mine_sessions" ADD CONSTRAINT "gold_mine_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gold_mine_sessions" ADD CONSTRAINT "gold_mine_sessions_landing_page_id_landing_pages_id_fk" FOREIGN KEY ("landing_page_id") REFERENCES "public"."landing_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_pain_links" ADD CONSTRAINT "idea_pain_links_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_pain_links" ADD CONSTRAINT "idea_pain_links_cluster_id_pain_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."pain_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_maps" ADD CONSTRAINT "market_maps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_cluster_quotes" ADD CONSTRAINT "pain_cluster_quotes_cluster_id_pain_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."pain_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_cluster_quotes" ADD CONSTRAINT "pain_cluster_quotes_quote_id_pain_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."pain_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_clusters" ADD CONSTRAINT "pain_clusters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_clusters" ADD CONSTRAINT "pain_clusters_session_id_gold_mine_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."gold_mine_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_quotes" ADD CONSTRAINT "pain_quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pain_quotes" ADD CONSTRAINT "pain_quotes_session_id_gold_mine_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."gold_mine_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_language_project_idx" ON "customer_language_quotes" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_language_unique_idx" ON "customer_language_quotes" USING btree ("project_id","source_quote_id");--> statement-breakpoint
CREATE INDEX "demand_checks_session_idx" ON "demand_checks" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "demand_checks_user_idx" ON "demand_checks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gold_mine_sessions_user_idx" ON "gold_mine_sessions" USING btree ("user_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "idea_pain_links_cluster_idx" ON "idea_pain_links" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "pain_cluster_quotes_quote_idx" ON "pain_cluster_quotes" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "pain_clusters_session_idx" ON "pain_clusters" USING btree ("session_id","rank");--> statement-breakpoint
CREATE INDEX "pain_clusters_user_idx" ON "pain_clusters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pain_quotes_session_idx" ON "pain_quotes" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "pain_quotes_user_idx" ON "pain_quotes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pain_quotes_dedupe_idx" ON "pain_quotes" USING btree ("session_id","dedupe_hash");--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_gold_mine_session_id_gold_mine_sessions_id_fk" FOREIGN KEY ("gold_mine_session_id") REFERENCES "public"."gold_mine_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ideas_gold_mine_idx" ON "ideas" USING btree ("gold_mine_session_id");