import { db } from "@/lib/db";
import { song, artist } from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";

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
const BATCH_SIZE = 10;

export class PlaylistMatcherService {
  static async matchTracks(tracks: ExternalTrack[]): Promise<MatchResult[]> {
    const results: MatchResult[] = [];

    // Process in batches for efficiency
    for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
      const batch = tracks.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((track) => this.matchSingleTrack(track)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  private static async matchSingleTrack(track: ExternalTrack): Promise<MatchResult> {
    try {
      const scoreExpr = sql<number>`(similarity(${song.title}, ${track.title}) * 0.6 + similarity(${artist.name}, ${track.artist}) * 0.4)`;

      const rows = await db
        .select({
          songId: song.id,
          title: song.title,
          artist: artist.name,
          albumImageUrl: song.albumImageUrl,
          score: scoreExpr,
        })
        .from(song)
        .innerJoin(artist, eq(song.artistId, artist.id))
        .where(
          sql`similarity(${song.title}, ${track.title}) >= ${MIN_THRESHOLD} OR similarity(${artist.name}, ${track.artist}) >= ${MIN_THRESHOLD}`,
        )
        .orderBy(sql`${scoreExpr} DESC`)
        .limit(1);

      if (rows.length === 0 || rows[0].score < MIN_THRESHOLD) {
        return { externalTrack: track, match: null };
      }

      const row = rows[0];
      return {
        externalTrack: track,
        match: {
          songId: row.songId,
          title: row.title,
          artist: row.artist,
          albumImageUrl: row.albumImageUrl,
          score: row.score,
          confident: row.score >= CONFIDENT_THRESHOLD,
        },
      };
    } catch {
      return { externalTrack: track, match: null };
    }
  }
}
