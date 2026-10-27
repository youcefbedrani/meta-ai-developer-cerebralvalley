CREATE TYPE "public"."listing_kind" AS ENUM('project', 'idea');--> statement-breakpoint
ALTER TYPE "public"."listing_asset_kind" ADD VALUE 'idea' BEFORE 'research_reports';--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "delivered_idea_id" uuid;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "kind" "listing_kind" DEFAULT 'project' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "idea_id" uuid;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "niche" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "earning_min_cents" integer;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "earning_max_cents" integer;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "earning_basis" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_delivered_idea_id_ideas_id_fk" FOREIGN KEY ("delivered_idea_id") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;