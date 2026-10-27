CREATE TYPE "public"."ad_test_status" AS ENUM('draft', 'running', 'completed', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('ad_variants', 'social_posts', 'community_post', 'cold_email_sequence', 'dm_script', 'seo_keywords', 'article_outline', 'launch_post', 'newsletter_pitch');--> statement-breakpoint
CREATE TYPE "public"."channel_role" AS ENUM('primary', 'test', 'later');--> statement-breakpoint
CREATE TYPE "public"."channel_status" AS ENUM('planned', 'active', 'paused', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."page_event_type" AS ENUM('visit', 'signup');--> statement-breakpoint
CREATE TABLE "ad_experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"channel_id" uuid,
	"platform" text NOT NULL,
	"name" text NOT NULL,
	"hypothesis" text NOT NULL,
	"audience" text NOT NULL,
	"budget_total" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"duration_days" integer NOT NULL,
	"max_cost_per_signup" numeric(12, 2) NOT NULL,
	"min_clicks" integer DEFAULT 100 NOT NULL,
	"status" "ad_test_status" DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"lab_experiment_id" uuid,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ad_experiment_id" uuid NOT NULL,
	"name" text NOT NULL,
	"angle" text DEFAULT '' NOT NULL,
	"headline" text NOT NULL,
	"primary_text" text NOT NULL,
	"cta" text NOT NULL,
	"audience_idea" text DEFAULT '' NOT NULL,
	"asset_id" uuid,
	"utm_content" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_source_quotes" (
	"asset_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	CONSTRAINT "asset_source_quotes_asset_id_quote_id_pk" PRIMARY KEY("asset_id","quote_id")
);
--> statement-breakpoint
CREATE TABLE "marketing_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"channel_id" uuid,
	"channel_name" text NOT NULL,
	"type" "asset_type" NOT NULL,
	"group_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"policy_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"plan_id" uuid,
	"name" text NOT NULL,
	"type" "channel_type" NOT NULL,
	"role" "channel_role" DEFAULT 'later' NOT NULL,
	"status" "channel_status" DEFAULT 'planned' NOT NULL,
	"monthly_budget" numeric(12, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"utm_source" text NOT NULL,
	"notes" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"based_on" jsonb NOT NULL,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"landing_page_id" uuid NOT NULL,
	"type" "page_event_type" NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utm_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"landing_page_id" uuid NOT NULL,
	"channel_id" uuid,
	"ad_variant_id" uuid,
	"source" text NOT NULL,
	"medium" text NOT NULL,
	"campaign" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_results" ADD COLUMN "channel_id" uuid;--> statement-breakpoint
ALTER TABLE "channel_results" ADD COLUMN "ad_experiment_id" uuid;--> statement-breakpoint
ALTER TABLE "channel_results" ADD COLUMN "ad_variant_id" uuid;--> statement-breakpoint
ALTER TABLE "channel_results" ADD COLUMN "impressions" integer;--> statement-breakpoint
ALTER TABLE "channel_results" ADD COLUMN "clicks" integer;--> statement-breakpoint
ALTER TABLE "channel_results" ADD COLUMN "revenue" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "marketing_plans" ADD COLUMN "inputs" jsonb;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD COLUMN "expected_output" text;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ad_experiments" ADD CONSTRAINT "ad_experiments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_experiments" ADD CONSTRAINT "ad_experiments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_experiments" ADD CONSTRAINT "ad_experiments_channel_id_marketing_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."marketing_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_experiments" ADD CONSTRAINT "ad_experiments_lab_experiment_id_experiments_id_fk" FOREIGN KEY ("lab_experiment_id") REFERENCES "public"."experiments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_variants" ADD CONSTRAINT "ad_variants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_variants" ADD CONSTRAINT "ad_variants_ad_experiment_id_ad_experiments_id_fk" FOREIGN KEY ("ad_experiment_id") REFERENCES "public"."ad_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_variants" ADD CONSTRAINT "ad_variants_asset_id_marketing_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."marketing_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_source_quotes" ADD CONSTRAINT "asset_source_quotes_asset_id_marketing_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."marketing_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_source_quotes" ADD CONSTRAINT "asset_source_quotes_quote_id_customer_language_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."customer_language_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_channel_id_marketing_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."marketing_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_channels" ADD CONSTRAINT "marketing_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_channels" ADD CONSTRAINT "marketing_channels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_channels" ADD CONSTRAINT "marketing_channels_plan_id_marketing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."marketing_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_recommendations" ADD CONSTRAINT "marketing_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_recommendations" ADD CONSTRAINT "marketing_recommendations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_events" ADD CONSTRAINT "page_events_landing_page_id_landing_pages_id_fk" FOREIGN KEY ("landing_page_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_links" ADD CONSTRAINT "utm_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_links" ADD CONSTRAINT "utm_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_links" ADD CONSTRAINT "utm_links_landing_page_id_landing_pages_id_fk" FOREIGN KEY ("landing_page_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_links" ADD CONSTRAINT "utm_links_channel_id_marketing_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."marketing_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_links" ADD CONSTRAINT "utm_links_ad_variant_id_ad_variants_id_fk" FOREIGN KEY ("ad_variant_id") REFERENCES "public"."ad_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_experiments_project_idx" ON "ad_experiments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "ad_experiments_user_idx" ON "ad_experiments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ad_variants_experiment_idx" ON "ad_variants" USING btree ("ad_experiment_id","position");--> statement-breakpoint
CREATE INDEX "asset_source_quotes_quote_idx" ON "asset_source_quotes" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_assets_version_idx" ON "marketing_assets" USING btree ("group_id","version");--> statement-breakpoint
CREATE INDEX "marketing_assets_project_idx" ON "marketing_assets" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "marketing_assets_user_idx" ON "marketing_assets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_channels_source_idx" ON "marketing_channels" USING btree ("project_id","utm_source");--> statement-breakpoint
CREATE INDEX "marketing_channels_user_idx" ON "marketing_channels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "marketing_recommendations_project_idx" ON "marketing_recommendations" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "page_events_page_idx" ON "page_events" USING btree ("landing_page_id","created_at");--> statement-breakpoint
CREATE INDEX "page_events_source_idx" ON "page_events" USING btree ("landing_page_id","utm_source","utm_campaign");--> statement-breakpoint
CREATE UNIQUE INDEX "utm_links_unique_idx" ON "utm_links" USING btree ("landing_page_id","source","medium","campaign","content");--> statement-breakpoint
CREATE INDEX "utm_links_project_idx" ON "utm_links" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "channel_results" ADD CONSTRAINT "channel_results_channel_id_marketing_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."marketing_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_results" ADD CONSTRAINT "channel_results_ad_experiment_id_ad_experiments_id_fk" FOREIGN KEY ("ad_experiment_id") REFERENCES "public"."ad_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_results" ADD CONSTRAINT "channel_results_ad_variant_id_ad_variants_id_fk" FOREIGN KEY ("ad_variant_id") REFERENCES "public"."ad_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_results_ad_idx" ON "channel_results" USING btree ("ad_experiment_id");