CREATE TYPE "public"."fetch_run_mode" AS ENUM('incremental', 'full');--> statement-breakpoint
CREATE TYPE "public"."fetch_run_status" AS ENUM('queued', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled', 'interrupted');--> statement-breakpoint
CREATE TABLE "provider_fetch_run" (
	"id" text PRIMARY KEY NOT NULL,
	"source" "source" NOT NULL,
	"mode" "fetch_run_mode" NOT NULL,
	"status" "fetch_run_status" DEFAULT 'queued' NOT NULL,
	"cutoff" timestamp,
	"current_page" integer DEFAULT 0 NOT NULL,
	"total_pages" integer,
	"page_map" text DEFAULT '' NOT NULL,
	"songs_fetched" integer DEFAULT 0 NOT NULL,
	"added" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"ignored" integer DEFAULT 0 NOT NULL,
	"parse_issues" integer DEFAULT 0 NOT NULL,
	"newest_seen_at" timestamp,
	"oldest_seen_at" timestamp,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider" ADD COLUMN "source_cursor" timestamp;--> statement-breakpoint
CREATE INDEX "provider_fetch_run_source_created_idx" ON "provider_fetch_run" USING btree ("source","created_at");--> statement-breakpoint
CREATE INDEX "provider_fetch_run_status_idx" ON "provider_fetch_run" USING btree ("status");--> statement-breakpoint
-- Keep incremental fetches incremental after the upgrade: the old cutoff was last_successful_fetch
UPDATE "provider" SET "source_cursor" = "last_successful_fetch" WHERE "source_cursor" IS NULL;