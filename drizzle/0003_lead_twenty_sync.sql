ALTER TABLE "leads" ADD COLUMN "twenty_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "twenty_lead_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "twenty_note_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "twenty_error" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "twenty_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "twenty_synced_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "leads_twenty_idx" ON "leads" USING btree ("twenty_status");