import { db } from "@/lib/db";
import {
  song,
  artist,
  album,
  genre,
  downloadUrl,
  installationSong,
  songList,
  songListItem,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql, or, inArray } from "drizzle-orm";
import type { ProviderMusic, SearchParams, PaginatedResponse } from "@/types";

export class MusicService {
  static async findById(id: string): Promise<ProviderMusic | null> {
    const data = await db
      .select({
        id: song.id,
        title: song.title,
        year: song.year,
        charter: song.charter,
        diffGuitar: song.diffGuitar,
        diffBass: song.diffBass,
        diffDrums: song.diffDrums,
        diffKeys: song.diffKeys,
        diffVocals: song.diffVocals,
        vocalParts: song.vocalParts,
        albumImageUrl: song.albumImageUrl,
        previewUrl: song.previewUrl,
        artist: artist.name,
        album: album.name,
        genre: genre.name,
        downloadUrls: sql<{ url: string; source: string }[]>`
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object('url', ${downloadUrl.url}, 'source', ${downloadUrl.source})
            ) FILTER (WHERE ${downloadUrl.url} IS NOT NULL),
            '[]'
          )
        `,
      })
      .from(song)
      .leftJoin(artist, eq(song.artistId, artist.id))
      .leftJoin(album, eq(song.albumId, album.id))
      .leftJoin(genre, eq(song.genreId, genre.id))
      .leftJoin(downloadUrl, eq(song.id, downloadUrl.songId))
      .where(eq(song.id, id))
      .groupBy(
        song.id,
        song.title,
        song.year,
        song.charter,
        song.diffGuitar,
        song.diffBass,
        song.diffDrums,
        song.diffKeys,
        song.diffVocals,
        song.vocalParts,
        song.albumImageUrl,
        song.previewUrl,
        artist.name,
        album.name,
        genre.name,
      )
      .limit(1);

    return data[0] ? this.convertToProviderMusic(data[0]) : null;
  }

  static async findByIds(ids: string[]): Promise<ProviderMusic[]> {
    if (ids.length === 0) return [];

    const data = await db
      .select({
        id: song.id,
        title: song.title,
        year: song.year,
        charter: song.charter,
        diffGuitar: song.diffGuitar,
        diffBass: song.diffBass,
        diffDrums: song.diffDrums,
        diffKeys: song.diffKeys,
        diffVocals: song.diffVocals,
        vocalParts: song.vocalParts,
        albumImageUrl: song.albumImageUrl,
        previewUrl: song.previewUrl,
        artist: artist.name,
        album: album.name,
        genre: genre.name,
        downloadUrls: sql<{ url: string; source: string }[]>`
          (SELECT COALESCE(json_agg(jsonb_build_object('url', du.url, 'source', du.source)), '[]')
           FROM download_url du WHERE du.song_id = ${song.id})
        `,
      })
      .from(song)
      .leftJoin(artist, eq(song.artistId, artist.id))
      .leftJoin(album, eq(song.albumId, album.id))
      .leftJoin(genre, eq(song.genreId, genre.id))
      .where(inArray(song.id, ids));

    return data.map((record) => this.convertToProviderMusic(record));
  }

  static async search(
    params: SearchParams,
    userId?: string | null,
  ): Promise<PaginatedResponse<ProviderMusic>> {
    const {
      query,
      limit = 20,
      sortBy = "name",
      sortOrder = "desc",
      genre: genreFilter,
      instruments,
      source,
      cursor,
      installationId,
      installed,
      artist: artistFilter,
      album: albumFilter,
      charter: charterFilter,
    } = params;

    const conditions = [];
    let relevanceScore: ReturnType<typeof sql<number>> | null = null;

    if (query) {
      const similarityThreshold = 0.3;
      const { songQuery, artistQuery, isCombined } =
        this.parseSearchQuery(query);

      if (isCombined && songQuery && artistQuery) {
        conditions.push(
          or(
            and(
              sql`similarity(${song.title}, ${songQuery}) >= ${similarityThreshold}`,
              sql`similarity(${artist.name}, ${artistQuery}) >= ${similarityThreshold}`,
            ),
            and(
              sql`similarity(${song.title}, ${artistQuery}) >= ${similarityThreshold}`,
              sql`similarity(${artist.name}, ${songQuery}) >= ${similarityThreshold}`,
            ),
          ),
        );

        relevanceScore = sql`GREATEST(
            (similarity(${song.title}, ${songQuery}) * 0.6) + (similarity(${artist.name}, ${artistQuery}) * 0.4),
            (similarity(${song.title}, ${artistQuery}) * 0.6) + (similarity(${artist.name}, ${songQuery}) * 0.4)
          )`;
      } else {
        conditions.push(
          or(
            sql`similarity(${song.title}, ${query}) >= ${similarityThreshold}`,
            sql`similarity(${artist.name}, ${query}) >= ${similarityThreshold}`,
            sql`similarity(${album.name}, ${query}) >= ${similarityThreshold * 0.8}`,
          ),
        );

        relevanceScore = sql`GREATEST(
            similarity(${song.title}, ${query}) * 1.0,
            similarity(${artist.name}, ${query}) * 0.9,
            similarity(${album.name}, ${query}) * 0.7
          )`;
      }
    }

    if (genreFilter) {
      conditions.push(eq(genre.name, genreFilter));
    }

    if (artistFilter) {
      conditions.push(eq(artist.name, artistFilter));
    }

    if (albumFilter) {
      conditions.push(eq(album.name, albumFilter));
    }

    if (charterFilter) {
      conditions.push(eq(song.charter, charterFilter));
    }

    if (source) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM download_url du WHERE du.song_id = ${song.id} AND du.source = ${source})`,
      );
    }

    if (instruments.length > 0) {
      const instrumentConditions = instruments
        .filter((inst) => inst !== "harmony")
        .map((instrument) => this.getDifficultyField(instrument))
        .filter(
          (
            field,
          ): field is NonNullable<ReturnType<typeof this.getDifficultyField>> =>
            field !== null,
        )
        .map((field) => sql`${field} IS NOT NULL`);

      if (instruments.includes("harmony")) {
        instrumentConditions.push(sql`${song.vocalParts} >= 2`);
      }

      if (instrumentConditions.length > 0) {
        conditions.push(and(...instrumentConditions));
      }
    }

    // Note: The 'installed' filter is handled after the LEFT JOIN on installationSong
    // by checking if installationSong.id IS NOT NULL in the WHERE clause
    const filterByInstalled = installed && installationId;

    // Use relevance sort only when explicitly requested and a query is present
    const useRelevanceSort = sortBy === "relevance" && query && relevanceScore;

    let orderByPrimary;
    if (useRelevanceSort) {
      orderByPrimary = desc(relevanceScore!);
    } else {
      const field = this.getSortField(sortBy);
      orderByPrimary = sortOrder === "asc" ? asc(field) : desc(field);
    }

    // Parse cursor to get the last seen values
    let cursorCondition = undefined;
    if (cursor) {
      let cursorData: { lastValue?: unknown; lastId?: string; lastScore?: number; total?: number };
      try {
        cursorData = JSON.parse(atob(cursor));
      } catch {
        // Return empty result for malformed cursors
        return { data: [], total: 0, page: 1, limit, totalPages: 0, nextCursor: null, hasMore: false };
      }
      if (!cursorData || typeof cursorData.lastId !== "string") {
        return { data: [], total: 0, page: 1, limit, totalPages: 0, nextCursor: null, hasMore: false };
      }
      const { lastValue, lastId } = cursorData;

      if (useRelevanceSort) {
        const { lastScore } = cursorData;
        cursorCondition = sql`((${relevanceScore} < ${lastScore}) OR (${relevanceScore} = ${lastScore} AND ${song.id} > ${lastId}))`;
      } else {
        const sortField = this.getSortField(sortBy);

        if (sortOrder === "desc") {
          cursorCondition = sql`((${sortField} < ${lastValue}) OR (${sortField} = ${lastValue} AND ${song.id} > ${lastId}))`;
        } else {
          cursorCondition = sql`((${sortField} > ${lastValue}) OR (${sortField} = ${lastValue} AND ${song.id} > ${lastId}))`;
        }
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    // Note: installedCondition will be added after the LEFT JOIN is set up
    const baseFinalWhereClause = cursorCondition
      ? and(whereClause, cursorCondition)
      : whereClause;

    // Build the join condition for installation status
    const installationJoinCondition = installationId
      ? and(
          eq(installationSong.songId, song.id),
          eq(installationSong.installationId, installationId),
        )
      : sql`false`;

    // Build the join conditions for favorites status
    const favoritesListJoinCondition = userId
      ? and(eq(songList.userId, userId), eq(songList.isFavorites, sql`true`))
      : sql`false`;

    const favoritesItemJoinCondition = and(
      eq(songListItem.listId, songList.id),
      eq(songListItem.songId, song.id),
    );

    // Get data with cursor-based pagination
    const baseDataQuery = db
      .select({
        id: song.id,
        title: song.title,
        year: song.year,
        charter: song.charter,
        diffGuitar: song.diffGuitar,
        diffBass: song.diffBass,
        diffDrums: song.diffDrums,
        diffKeys: song.diffKeys,
        diffVocals: song.diffVocals,
        vocalParts: song.vocalParts,
        albumImageUrl: song.albumImageUrl,
        previewUrl: song.previewUrl,
        createdAt: song.createdAt,
        artist: artist.name,
        album: album.name,
        genre: genre.name,
        downloadUrls: sql<{ url: string; source: string }[]>`
          (SELECT COALESCE(json_agg(jsonb_build_object('url', du.url, 'source', du.source)), '[]')
           FROM download_url du WHERE du.song_id = ${song.id})
        `,
        installed: sql<boolean>`${installationSong.id} IS NOT NULL`,
        favorited: sql<boolean>`${songListItem.id} IS NOT NULL`,
        ...(relevanceScore ? { relevanceScore } : {}),
      })
      .from(song)
      .leftJoin(artist, eq(song.artistId, artist.id))
      .leftJoin(album, eq(song.albumId, album.id))
      .leftJoin(genre, eq(song.genreId, genre.id))
      .leftJoin(installationSong, installationJoinCondition)
      .leftJoin(songList, favoritesListJoinCondition)
      .leftJoin(songListItem, favoritesItemJoinCondition);

    // Add the installed filter condition after the JOIN is set up
    const finalWhereClause = filterByInstalled
      ? and(baseFinalWhereClause, sql`${installationSong.id} IS NOT NULL`)
      : baseFinalWhereClause;

    const filteredQuery = finalWhereClause
      ? baseDataQuery.where(finalWhereClause)
      : baseDataQuery;
    const data = await filteredQuery
      .orderBy(orderByPrimary, asc(song.id))
      .limit(limit + 1);

    const hasMore = data.length > limit;
    const resultData = hasMore ? data.slice(0, limit) : data;

    // Get total count: only query if no cursor, otherwise use count from cursor
    let count: number;
    if (cursor) {
      let cursorData: { total?: number };
      try {
        cursorData = JSON.parse(atob(cursor));
      } catch {
        cursorData = {};
      }
      count = typeof cursorData.total === "number" ? cursorData.total : 0;
    } else {
      const countBaseQuery = db
        .select({ count: sql<number>`count(${song.id})` })
        .from(song)
        .leftJoin(artist, eq(song.artistId, artist.id))
        .leftJoin(album, eq(song.albumId, album.id))
        .leftJoin(genre, eq(song.genreId, genre.id));

      const finalCountQuery = whereClause
        ? countBaseQuery.where(whereClause)
        : countBaseQuery;
      const [result] = await finalCountQuery;
      count = Number(result.count);
    }

    // Generate next cursor if there are more results
    let nextCursor: string | null = null;
    if (hasMore && resultData.length > 0) {
      const lastItem = resultData[resultData.length - 1];
      let lastValue;

      if (useRelevanceSort) {
        const cursorData = {
          lastScore: lastItem.relevanceScore,
          lastId: lastItem.id,
          total: count,
        };
        nextCursor = btoa(JSON.stringify(cursorData));
      } else {
        const sortField = sortBy === "relevance" ? "createdAt" : sortBy;
        const fieldMap: Record<string, unknown> = {
          name: lastItem.title,
          artist: lastItem.artist,
          album: lastItem.album,
          createdAt: lastItem.createdAt,
        };
        lastValue = fieldMap[sortField] ?? lastItem.createdAt;

        const cursorData = { lastValue, lastId: lastItem.id, total: count };
        nextCursor = btoa(JSON.stringify(cursorData));
      }
    }

    return {
      data: resultData.map((record) => this.convertToProviderMusic(record)),
      total: count,
      page: 1,
      limit,
      totalPages: Math.ceil(count / limit),
      nextCursor,
      hasMore,
    };
  }

  static async findBySource(
    source: "enchor" | "rhythmverse",
  ): Promise<ProviderMusic[]> {
    const data = await db
      .select({
        id: song.id,
        title: song.title,
        year: song.year,
        charter: song.charter,
        diffGuitar: song.diffGuitar,
        diffBass: song.diffBass,
        diffDrums: song.diffDrums,
        diffKeys: song.diffKeys,
        diffVocals: song.diffVocals,
        vocalParts: song.vocalParts,
        albumImageUrl: song.albumImageUrl,
        previewUrl: song.previewUrl,
        artist: artist.name,
        album: album.name,
        genre: genre.name,
        downloadUrls: sql<{ url: string; source: string }[]>`
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object('url', ${downloadUrl.url}, 'source', ${downloadUrl.source})
            ) FILTER (WHERE ${downloadUrl.url} IS NOT NULL),
            '[]'
          )
        `,
      })
      .from(song)
      .leftJoin(artist, eq(song.artistId, artist.id))
      .leftJoin(album, eq(song.albumId, album.id))
      .leftJoin(genre, eq(song.genreId, genre.id))
      .leftJoin(downloadUrl, eq(song.id, downloadUrl.songId))
      .where(eq(downloadUrl.source, source))
      .groupBy(
        song.id,
        song.title,
        song.year,
        song.charter,
        song.diffGuitar,
        song.diffBass,
        song.diffDrums,
        song.diffKeys,
        song.diffVocals,
        song.vocalParts,
        song.albumImageUrl,
        song.previewUrl,
        artist.name,
        album.name,
        genre.name,
      );

    return data.map((record) => this.convertToProviderMusic(record));
  }

  /**
   * Parse intelligent search query into song and artist components
   */
  private static parseSearchQuery(query: string): {
    songQuery?: string;
    artistQuery?: string;
    isCombined: boolean;
  } {
    const trimmedQuery = query.trim();

    // Check for "song - artist" or "artist - song" patterns
    const dashPattern = /^(.+?)\s*-\s*(.+?)$/;
    const match = trimmedQuery.match(dashPattern);

    if (match) {
      const [, part1, part2] = match;

      // Return both parts without trying to determine which is which
      // The search will handle both possibilities
      return {
        songQuery: part1.trim(),
        artistQuery: part2.trim(),
        isCombined: true,
      };
    }

    // Single query - could be either song or artist
    return { songQuery: trimmedQuery, isCombined: false };
  }

  private static getSortField(sortBy: string) {
    switch (sortBy === "relevance" ? "createdAt" : sortBy) {
      case "name":
        return song.title;
      case "artist":
        return artist.name;
      case "album":
        return album.name;
      case "createdAt":
      default:
        return song.createdAt;
    }
  }

  private static getDifficultyField(instrument: string) {
    switch (instrument) {
      case "guitar":
        return song.diffGuitar;
      case "bass":
        return song.diffBass;
      case "drums":
        return song.diffDrums;
      case "keys":
        return song.diffKeys;
      case "vocals":
        return song.diffVocals;
      default:
        return null;
    }
  }

  static async create(songData: {
    name: string;
    artist: string;
    album: string;
    coverUrl?: string;
    downloadUrl: string;
    source: "enchor" | "rhythmverse";
    sourceUpdatedAt?: Date;
    instruments: {
      drums?: number;
      bass?: number;
      guitar?: number;
      keys?: number;
      vocals?: number;
    };
    genre?: string;
    year?: number;
    charter?: string;
    vocalParts?: number;
  }): Promise<ProviderMusic> {
    return await db.transaction(async (tx) => {
      // Find or create artist
      let [artistRecord] = await tx
        .select()
        .from(artist)
        .where(eq(artist.name, songData.artist))
        .limit(1);

      if (!artistRecord) {
        [artistRecord] = await tx
          .insert(artist)
          .values({ name: songData.artist })
          .returning();
      }

      // Find or create album
      let [albumRecord] = await tx
        .select()
        .from(album)
        .where(eq(album.name, songData.album))
        .limit(1);

      if (!albumRecord) {
        [albumRecord] = await tx
          .insert(album)
          .values({ name: songData.album })
          .returning();
      }

      // Find or create genre if provided
      let genreRecord = null;
      if (songData.genre) {
        [genreRecord] = await tx
          .select()
          .from(genre)
          .where(eq(genre.name, songData.genre))
          .limit(1);

        if (!genreRecord) {
          [genreRecord] = await tx
            .insert(genre)
            .values({ name: songData.genre })
            .returning();
        }
      }

      // Create song
      const [songRecord] = await tx
        .insert(song)
        .values({
          key: `${songData.artist}-${songData.album}-${songData.name}`
            .toLowerCase()
            .replace(/\s+/g, "-"),
          title: songData.name,
          year: songData.year,
          artistId: artistRecord.id,
          albumId: albumRecord.id,
          genreId: genreRecord?.id,
          albumImageUrl: songData.coverUrl,
          charter: songData.charter,
          diffGuitar: songData.instruments.guitar,
          diffBass: songData.instruments.bass,
          diffDrums: songData.instruments.drums,
          diffKeys: songData.instruments.keys,
          diffVocals: songData.instruments.vocals,
          vocalParts: songData.vocalParts,
        })
        .returning();

      // Create download URL
      await tx.insert(downloadUrl).values({
        url: songData.downloadUrl,
        source: songData.source,
        songId: songRecord.id,
      });

      // Return the created song in ProviderMusic format
      return this.convertToProviderMusic({
        id: songRecord.id,
        title: songRecord.title,
        year: songRecord.year,
        charter: songRecord.charter,
        diffGuitar: songRecord.diffGuitar,
        diffBass: songRecord.diffBass,
        diffDrums: songRecord.diffDrums,
        diffKeys: songRecord.diffKeys,
        diffVocals: songRecord.diffVocals,
        vocalParts: songRecord.vocalParts,
        albumImageUrl: songRecord.albumImageUrl,
        previewUrl: songRecord.previewUrl,
        artist: artistRecord.name,
        album: albumRecord.name,
        genre: genreRecord?.name,
        downloadUrls: [{ url: songData.downloadUrl, source: songData.source }],
      });
    });
  }

  private static convertToProviderMusic(record: {
    id: string;
    title: string;
    artist?: string | null;
    album?: string | null;
    albumImageUrl?: string | null;
    previewUrl?: string | null;
    downloadUrls?: Array<{ url: string; source: string }>;
    diffDrums?: number | null;
    diffBass?: number | null;
    diffGuitar?: number | null;
    diffKeys?: number | null;
    diffVocals?: number | null;
    vocalParts?: number | null;
    genre?: string | null;
    year?: number | null;
    charter?: string | null;
    installed?: boolean;
    favorited?: boolean;
  }): ProviderMusic {
    return {
      id: record.id,
      name: record.title,
      artist: record.artist || "",
      album: record.album ?? null,
      coverUrl: record.albumImageUrl || "",
      downloadUrls: record.downloadUrls || [],
      sourceUpdatedAt: null,
      vocalParts: record.vocalParts ?? null,
      instruments: {
        drums: record.diffDrums ?? null,
        bass: record.diffBass ?? null,
        guitar: record.diffGuitar ?? null,
        keys: record.diffKeys ?? null,
        vocals: record.diffVocals ?? null,
      },
      genre: record.genre ?? null,
      year: record.year ?? null,
      charter: record.charter ?? null,
      installed: record.installed ?? undefined,
      favorited: record.favorited ?? undefined,
    };
  }
}
