CREATE TABLE "product_seen" (
	"twenty_id" uuid PRIMARY KEY NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_overrides" ADD COLUMN "badges" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "product_overrides" ADD COLUMN "related_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;