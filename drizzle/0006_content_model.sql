ALTER TYPE "public"."content_status" ADD VALUE 'review' BEFORE 'published';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'author';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'sales';--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"user_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reusable_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"section" jsonb NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "layout" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "unpublish_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "og_title" text;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "og_description" text;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "focus_keyword" text;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "schema_type" text;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "aeo" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "system_key" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "focal_x" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "focal_y" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "fit" text DEFAULT 'cover' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "credit" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "placeholder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "variants" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reusable_sections" ADD CONSTRAINT "reusable_sections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reusable_sections" ADD CONSTRAINT "reusable_sections_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_revisions_item_idx" ON "content_revisions" USING btree ("content_id","created_at");--> statement-breakpoint
CREATE INDEX "media_sha_idx" ON "media" USING btree ("sha256");--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_system_key_unique" UNIQUE("system_key");--> statement-breakpoint
-- Fixed site pages: reuse the imported row at each URL (keeps its SEO), create the rest.
INSERT INTO "content" ("type", "path", "title", "status", "system_key") VALUES
  ('page', '/', 'Home', 'published', 'home'),
  ('page', '/blog/', 'Blog', 'published', 'blog'),
  ('page', '/engineered-wood-flooring-collection/', 'Engineered Wood Flooring', 'published', 'collection:engineered-wood-flooring-collection'),
  ('page', '/laminate-flooring-collection/', 'Laminate Flooring', 'published', 'collection:laminate-flooring-collection'),
  ('page', '/composite-flooring-collection/', 'Composite Flooring', 'published', 'collection:composite-flooring-collection'),
  ('page', '/decking-collection/', 'Decking', 'published', 'collection:decking-collection'),
  ('page', '/facades-collection/', 'Facades', 'published', 'collection:facades-collection'),
  ('page', '/accessories/', 'Accessories', 'published', 'accessories')
ON CONFLICT ("path") DO UPDATE SET "system_key" = EXCLUDED."system_key";
