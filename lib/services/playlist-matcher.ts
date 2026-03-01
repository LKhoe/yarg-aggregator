import { db } from "@/lib/db";
import { sql, eq, and } from "drizzle-orm";
import { song, artist } from "@/lib/db/schema";

export interface ExternalTrack {
  title: string;
  artist: string;
}

export interface MatchedSong {
  songId: string;
  title: string;
  artist: string;
  albumImageUrl: string | null;
  score: number;
  confident: boolean;
}

export interface MatchResult {
  externalTrack: ExternalTrack;
  match: MatchedSong | null;
}

const CONFIDENT_THRESHOLD = 0.4;
const MIN_THRESHOLD = 0.3;

// Must sum up to 1.0
const SIMILARITY_TITLE_WEIGHT = 0.6;
const SIMILARITY_ARTIST_WEIGHT = 0.4;

export class PlaylistMatcherService {
  static async matchTracks(tracks: ExternalTrack[]): Promise<MatchResult[]> {
    if (tracks.length === 0) return [];

    // Deduplicate tracks by canonical title+artist key
    const seen = new Map<string, number>(); // key → unique index
    const uniqueTracks: ExternalTrack[] = [];
    const indexMap: number[] = []; // original index → unique index

    for (let i = 0; i < tracks.length; i++) {
      const key = `${tracks[i].title.toLowerCase()}|||${tracks[i].artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, uniqueTracks.length);
        uniqueTracks.push(tracks[i]);
      }
      indexMap.push(seen.get(key)!);
    }

    try {
      // Build a VALUES list: Drizzle expands arrays as individual $N params (a tuple),
      // which PostgreSQL can't cast to text[]. Using VALUES avoids the unnest/cast issue.
      const valuesList = sql.join(
        uniqueTracks.map(
          (t, i) => sql`(${i + 1}::int, ${t.title}::text, ${t.artist}::text)`,
        ),
        sql`, `,
      );

      // CTE 1: input tracks from VALUES list
      const inputTracks = db.$with("input_tracks").as(
        db
          .select({
            idx: sql<number>`idx`.as("idx"),
            inputTitle: sql<string>`input_title`.as("input_title"),
            inputArtist: sql<string>`input_artist`.as("input_artist"),
          })
          .from(
            sql`(VALUES ${valuesList}) AS t(idx, input_title, input_artist)`,
          ),
      );

      // CTE 2: scored candidates with window function to pick best match per track
      const scored = db.$with("scored").as(
        db
          .select({
            idx: inputTracks.idx,
            songId: song.id,
            title: song.title,
            artistName: artist.name,
            albumImageUrl: song.albumImageUrl,
            score: sql<number>`(
              similarity(${song.title}, ${inputTracks.inputTitle}) * ${SIMILARITY_TITLE_WEIGHT} +
              similarity(${artist.name}, ${inputTracks.inputArtist}) * ${SIMILARITY_ARTIST_WEIGHT}
            )`.as("score"),
            rn: sql<number>`ROW_NUMBER() OVER (
              PARTITION BY ${inputTracks.idx}
              ORDER BY (
                similarity(${song.title}, ${inputTracks.inputTitle}) * ${SIMILARITY_TITLE_WEIGHT} +
                similarity(${artist.name}, ${inputTracks.inputArtist}) * ${SIMILARITY_ARTIST_WEIGHT}
              ) DESC,
              GREATEST(
                similarity(${song.title}, ${inputTracks.inputTitle}),
                similarity(${artist.name}, ${inputTracks.inputArtist})
              ) DESC
            )`.as("rn"),
          })
          .from(inputTracks)
          .crossJoin(song)
          .innerJoin(artist, eq(song.artistId, artist.id))
          .where(
            and(
              sql`similarity(${song.title}, ${inputTracks.inputTitle}) >= ${MIN_THRESHOLD}`,
              sql`similarity(${artist.name}, ${inputTracks.inputArtist}) >= ${MIN_THRESHOLD}`,
            ),
          ),
      );

      const result = await db
        .with(inputTracks, scored)
        .select({
          idx: scored.idx,
          songId: scored.songId,
          title: scored.title,
          artistName: scored.artistName,
          albumImageUrl: scored.albumImageUrl,
          score: scored.score,
        })
        .from(scored)
        .where(
          and(sql`${scored.rn} = 1`, sql`${scored.score} >= ${MIN_THRESHOLD}`),
        )
        .orderBy(scored.idx);

      // Build map from unique index (1-based) → row
      const matchMap = new Map(result.map((r) => [r.idx, r]));

      // Expand results back to original track list via dedup index map
      return tracks.map((track, i) => {
        const uniqueIdx = indexMap[i] + 1; // VALUES indices are 1-based
        const row = matchMap.get(uniqueIdx);
        if (!row) return { externalTrack: track, match: null };
        return {
          externalTrack: track,
          match: {
            songId: row.songId,
            title: row.title,
            artist: row.artistName,
            albumImageUrl: row.albumImageUrl,
            score: Number(row.score),
            confident: Number(row.score) >= CONFIDENT_THRESHOLD,
          },
        };
      });
    } catch (err) {
      console.error("[PlaylistMatcher] Batch match failed:", err);
      return tracks.map((track) => ({ externalTrack: track, match: null }));
    }
  }
}
