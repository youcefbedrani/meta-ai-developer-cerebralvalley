CREATE TYPE "public"."channel_type" AS ENUM('organic', 'paid');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'done');--> statement-breakpoint
CREATE TABLE "channel_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"channel_type" "channel_type" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"spend" numeric(12, 2),
	"visits" integer,
	"signups" integer,
	"customers" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"schema_version" integer NOT NULL,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"week" integer NOT NULL,
	"position" integer NOT NULL,
	"channel" text NOT NULL,
	"channel_type" "channel_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"success_metric" text,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_results" ADD CONSTRAINT "channel_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_results" ADD CONSTRAINT "channel_results_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_plans" ADD CONSTRAINT "marketing_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_plans" ADD CONSTRAINT "marketing_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_plan_id_marketing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."marketing_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_results_project_idx" ON "channel_results" USING btree ("project_id","period_start");--> statement-breakpoint
CREATE INDEX "channel_results_user_idx" ON "channel_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "marketing_plans_project_idx" ON "marketing_plans" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "marketing_plans_user_idx" ON "marketing_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "marketing_tasks_plan_idx" ON "marketing_tasks" USING btree ("plan_id","week","position");--> statement-breakpoint
CREATE INDEX "marketing_tasks_user_idx" ON "marketing_tasks" USING btree ("user_id");