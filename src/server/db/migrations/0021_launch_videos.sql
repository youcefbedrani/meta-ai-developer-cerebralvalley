CREATE TYPE "public"."social_post_status" AS ENUM('queued', 'posting', 'published', 'sent_to_inbox', 'failed');--> statement-breakpoint
CREATE TYPE "public"."social_provider" AS ENUM('linkedin', 'facebook', 'instagram', 'tiktok');--> statement-breakpoint
CREATE TABLE "launch_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"job_id" uuid,
	"angle" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"script" jsonb,
	"video_key" text,
	"thumb_key" text,
	"duration_sec" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "social_provider" NOT NULL,
	"account_id" text NOT NULL,
	"account_name" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"connection_id" uuid,
	"provider" "social_provider" NOT NULL,
	"caption" text NOT NULL,
	"status" "social_post_status" DEFAULT 'queued' NOT NULL,
	"external_id" text,
	"url" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "launch_videos" ADD CONSTRAINT "launch_videos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launch_videos" ADD CONSTRAINT "launch_videos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launch_videos" ADD CONSTRAINT "launch_videos_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_video_id_launch_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."launch_videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_connection_id_social_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."social_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "launch_videos_project_idx" ON "launch_videos" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_connections_account_idx" ON "social_connections" USING btree ("user_id","provider","account_id");--> statement-breakpoint
CREATE INDEX "social_posts_video_idx" ON "social_posts" USING btree ("video_id","created_at");