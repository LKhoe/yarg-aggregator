-- Remove the unused full-text search column (never queried; search uses pg_trgm).
-- Trigger and function first: the function body references NEW.search_vector.
DROP TRIGGER IF EXISTS "tsvectorupdate" ON "song";--> statement-breakpoint
DROP FUNCTION IF EXISTS song_search_vector_update();--> statement-breakpoint
DROP INDEX IF EXISTS "song_search_vector_gin_idx";--> statement-breakpoint
ALTER TABLE "song" DROP COLUMN "search_vector";
