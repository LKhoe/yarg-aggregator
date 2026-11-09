-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";

-- 2. Fuzzy Search (pg_trgm)

-- Queried with the `%` operator (threshold: pg_trgm.similarity_threshold, default 0.3) in
-- MusicService.search(); similarity(col, q) >= x cannot use these indexes.
-- (The old tsvector column, trigger and GIN index were dropped in migration 0009.)

-- GIN Trigram Index on Song Title
-- Supports: LIKE '%query%', ILIKE, and similarity comparison
CREATE INDEX IF NOT EXISTS song_title_trgm_idx ON song USING GIN (title gin_trgm_ops);

-- GIN Trigram Index on Artist Name
-- Important: Artist name is in the 'artist' table.
-- If we filter artists by fuzzy name, we need this index on the artist table.
CREATE INDEX IF NOT EXISTS artist_name_trgm_idx ON artist USING GIN (name gin_trgm_ops);

-- GIN Trigram Index on Album Name
CREATE INDEX IF NOT EXISTS album_name_trgm_idx ON album USING GIN (name gin_trgm_ops);


-- 3. Instrument Filtering Optimization (Optional extra tuning)

-- While standard B-Tree indexes on instrument columns (created in Prisma) work well,
-- if we strictly only query for "Presence" (IS NOT NULL), we could use Partial Indexes
-- to save space if the data is very sparse (e.g. if 90% of songs don't have keys).
-- However, standard indexes are usually fine. If space is tight:
-- CREATE INDEX song_diff_keys_present_idx ON song(diff_keys) WHERE diff_keys IS NOT NULL;
-- For now, standard indexes in schema.prisma are sufficient.
