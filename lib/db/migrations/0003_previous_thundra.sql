DROP INDEX "song_updated_at_idx";--> statement-breakpoint
CREATE INDEX "song_created_at_idx" ON "song" USING btree ("created_at" DESC NULLS LAST,"id");