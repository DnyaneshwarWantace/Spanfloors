ALTER TABLE "media" ADD COLUMN "folder" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "media_folder_idx" ON "media" USING btree ("folder");