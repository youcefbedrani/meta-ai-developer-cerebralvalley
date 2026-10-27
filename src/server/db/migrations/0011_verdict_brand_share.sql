ALTER TABLE "projects" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "brand" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_share_token_idx" ON "projects" USING btree ("share_token");