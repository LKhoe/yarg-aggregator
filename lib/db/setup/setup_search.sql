-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";

-- 2. Full-Text Search (tsvector)

-- Function to generate the tsvector
-- We concatenate Song Title and Artist Name.
-- You might also want to include Album name or Charter if desired.
CREATE OR REPLACE FUNCTION song_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE((SELECT name FROM artist WHERE id = NEW.artist_id), '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update search_vector on Song INSERT or UPDATE
-- note: The artist name join lookup in the trigger can be slightly expensive on bulk updates
-- but ensures accuracy. Ideally, search_vector might be a materialized view or denormalized,
-- but a direct column trigger is the standard robust Postgres approach.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tsvectorupdate' AND tgrelid = 'song'::regclass) THEN
        CREATE TRIGGER tsvectorupdate
        BEFORE INSERT OR UPDATE ON song
        FOR EACH ROW EXECUTE FUNCTION song_search_vector_update();
    END IF;
END
$$;

-- Index for Full-Text Search
-- This allows fast text search: WHERE search_vector @@ plainto_tsquery('query')
CREATE INDEX IF NOT EXISTS song_search_vector_gin_idx ON song USING GIN (search_vector);


-- 3. Fuzzy Search (pg_trgm)

-- GIN Trigram Index on Song Title
-- Supports: LIKE '%query%', ILIKE, and similarity comparison
CREATE INDEX IF NOT EXISTS song_title_trgm_idx ON song USING GIN (title gin_trgm_ops);

-- GIN Trigram Index on Artist Name
-- Important: Artist name is in the 'artist' table.
-- If we filter artists by fuzzy name, we need this index on the artist table.
CREATE INDEX IF NOT EXISTS artist_name_trgm_idx ON artist USING GIN (name gin_trgm_ops);


-- 4. Instrument Filtering Optimization (Optional extra tuning)

-- While standard B-Tree indexes on instrument columns (created in Prisma) work well,
-- if we strictly only query for "Presence" (IS NOT NULL), we could use Partial Indexes
-- to save space if the data is very sparse (e.g. if 90% of songs don't have keys).
-- However, standard indexes are usually fine. If space is tight:
-- CREATE INDEX song_diff_keys_present_idx ON song(diff_keys) WHERE diff_keys IS NOT NULL;
-- For now, standard indexes in schema.prisma are sufficient.
