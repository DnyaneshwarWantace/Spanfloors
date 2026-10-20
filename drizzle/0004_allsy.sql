CREATE TYPE "public"."allsy_asset_type" AS ENUM('image', 'pdf', 'video');--> statement-breakpoint
CREATE TABLE "allsy_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "allsy_asset_type" NOT NULL,
	"url" text NOT NULL,
	"mime" text,
	"width" integer,
	"height" integer,
	"bytes" integer,
	"title" text DEFAULT '' NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"product_id" text,
	"project" jsonb,
	"section" text,
	"video_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"source_updated_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"event_id" text,
	"received" integer DEFAULT 0 NOT NULL,
	"upserted" integer DEFAULT 0 NOT NULL,
	"deleted" integer DEFAULT 0 NOT NULL,
	"flagged" integer DEFAULT 0 NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"error" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "allsy_assets_product_idx" ON "allsy_assets" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "allsy_assets_type_idx" ON "allsy_assets" USING btree ("type","deleted");--> statement-breakpoint
CREATE INDEX "sync_log_created_idx" ON "sync_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_log_event_idx" ON "sync_log" USING btree ("source","event_id");