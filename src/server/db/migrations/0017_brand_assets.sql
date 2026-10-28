CREATE TYPE "public"."brand_asset_kind" AS ENUM('logo', 'hero', 'ad');--> statement-breakpoint
CREATE TABLE "brand_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "brand_asset_kind" NOT NULL,
	"channel" text,
	"headline" text,
	"prompt" text NOT NULL,
	"rationale" text,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"image_key" text NOT NULL,
	"cutout_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_assets_project_idx" ON "brand_assets" USING btree ("project_id","created_at");