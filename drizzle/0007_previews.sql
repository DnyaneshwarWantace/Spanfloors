CREATE TABLE "editing_presence" (
	"content_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editing_presence_content_id_user_id_pk" PRIMARY KEY("content_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "previews" (
	"id" text PRIMARY KEY NOT NULL,
	"content_id" uuid,
	"data" jsonb NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "editing_presence" ADD CONSTRAINT "editing_presence_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editing_presence" ADD CONSTRAINT "editing_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previews" ADD CONSTRAINT "previews_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previews" ADD CONSTRAINT "previews_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "previews_expires_idx" ON "previews" USING btree ("expires_at");