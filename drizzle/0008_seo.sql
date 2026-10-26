CREATE TABLE "not_found_log" (
	"path" text PRIMARY KEY NOT NULL,
	"hits" integer DEFAULT 1 NOT NULL,
	"referrer" text,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"ignored" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_overrides" ADD COLUMN "og_title" text;--> statement-breakpoint
ALTER TABLE "product_overrides" ADD COLUMN "og_description" text;--> statement-breakpoint
ALTER TABLE "product_overrides" ADD COLUMN "og_image_media_id" uuid;--> statement-breakpoint
CREATE INDEX "not_found_last_idx" ON "not_found_log" USING btree ("last_seen");--> statement-breakpoint
ALTER TABLE "product_overrides" ADD CONSTRAINT "product_overrides_og_image_media_id_media_id_fk" FOREIGN KEY ("og_image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;