CREATE TABLE "innovation_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"input" jsonb NOT NULL,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"stage" text,
	"observation" jsonb,
	"ideas" jsonb,
	"credits_reserved" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "innovation_scans" ADD CONSTRAINT "innovation_scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "innovation_scans_user_idx" ON "innovation_scans" USING btree ("user_id","created_at");