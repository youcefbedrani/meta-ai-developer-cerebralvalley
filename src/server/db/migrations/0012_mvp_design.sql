CREATE TYPE "public"."design_device" AS ENUM('MOBILE', 'DESKTOP');--> statement-breakpoint
CREATE TABLE "design_screens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"job_id" uuid,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"device" "design_device" NOT NULL,
	"prompt" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"provider" text NOT NULL,
	"provider_screen_id" text,
	"html" text,
	"image_url" text,
	"replaces_id" uuid,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "design_project_id" text;--> statement-breakpoint
ALTER TABLE "design_screens" ADD CONSTRAINT "design_screens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_screens" ADD CONSTRAINT "design_screens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_screens" ADD CONSTRAINT "design_screens_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "design_screens_project_idx" ON "design_screens" USING btree ("project_id","archived","position");