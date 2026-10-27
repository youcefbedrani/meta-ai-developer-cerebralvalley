CREATE TYPE "public"."competitor_origin" AS ENUM('research', 'scan', 'manual');--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "origin" "competitor_origin" DEFAULT 'research' NOT NULL;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "target_customer" text;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "pricing_plans" jsonb;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "source_ids" jsonb;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "last_scanned_at" timestamp with time zone;