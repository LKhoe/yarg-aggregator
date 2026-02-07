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
import { eq, and, desc, asc, sql, or } from "drizzle-orm";
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
        song.albumImageUrl,
        song.previewUrl,
        artist.name,
        album.name,
        genre.name,
      )
      .limit(1);

    return data[0] ? this.convertToProviderMusic(data[0]) : null;
  }

  static async search(
    params: SearchParams,
    userId?: string | null,
  ): Promise<PaginatedResponse<ProviderMusic>> {
    return this.searchWithCursor(params, userId);
  }

  static async searchWithCursor(
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

    if (source) {
      conditions.push(eq(downloadUrl.source, source));
    }

    if (instruments.length > 0) {
      const instrumentConditions = instruments
        .map((instrument) => this.getDifficultyField(instrument))
        .filter(
          (
            field,
          ): field is NonNullable<ReturnType<typeof this.getDifficultyField>> =>
            field !== null,
        )
        .map((field) => sql`${field} IS NOT NULL`);

      if (instrumentConditions.length > 0) {
        conditions.push(and(...instrumentConditions));
      }
    }

    // Note: The 'installed' filter is handled after the LEFT JOIN on installationSong
    // by checking if installationSong.id IS NOT NULL in the WHERE clause
    const filterByInstalled = installed && installationId;

    let orderByPrimary;
    if (query && relevanceScore) {
      orderByPrimary = desc(relevanceScore);
    } else {
      switch (sortBy) {
        case "name":
          orderByPrimary =
            sortOrder === "asc" ? asc(song.title) : desc(song.title);
          break;
        case "artist":
          orderByPrimary =
            sortOrder === "asc" ? asc(artist.name) : desc(artist.name);
          break;
        case "album":
          orderByPrimary =
            sortOrder === "asc" ? asc(album.name) : desc(album.name);
          break;
        case "createdAt":
        default:
          orderByPrimary =
            sortOrder === "asc" ? asc(song.createdAt) : desc(song.createdAt);
          break;
      }
    }

    // Parse cursor to get the last seen values
    let cursorCondition = undefined;
    if (cursor) {
      const cursorData = JSON.parse(atob(cursor));
      const { lastValue, lastId } = cursorData;

      if (query && relevanceScore) {
        const { lastScore } = cursorData;
        cursorCondition = sql`((${relevanceScore} < ${lastScore}) OR (${relevanceScore} = ${lastScore} AND ${song.id} > ${lastId}))`;
      } else {
        let sortField;
        switch (sortBy) {
          case "name":
            sortField = song.title;
            break;
          case "artist":
            sortField = artist.name;
            break;
          case "album":
            sortField = album.name;
            break;
          case "createdAt":
          default:
            sortField = song.createdAt;
            break;
        }

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
        albumImageUrl: song.albumImageUrl,
        previewUrl: song.previewUrl,
        createdAt: song.createdAt,
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
        installed: sql<boolean>`BOOL_OR(${installationSong.id} IS NOT NULL)`,
        favorited: sql<boolean>`BOOL_OR(${songListItem.id} IS NOT NULL)`,
        ...(relevanceScore ? { relevanceScore } : {}),
      })
      .from(song)
      .leftJoin(artist, eq(song.artistId, artist.id))
      .leftJoin(album, eq(song.albumId, album.id))
      .leftJoin(genre, eq(song.genreId, genre.id))
      .leftJoin(downloadUrl, eq(song.id, downloadUrl.songId))
      .leftJoin(installationSong, installationJoinCondition)
      .leftJoin(songList, favoritesListJoinCondition)
      .leftJoin(songListItem, favoritesItemJoinCondition);

    // Add the installed filter condition after the JOIN is set up
    const finalWhereClause = filterByInstalled
      ? and(baseFinalWhereClause, sql`${installationSong.id} IS NOT NULL`)
      : baseFinalWhereClause;

    const groupByClause = [
      song.id,
      song.title,
      song.year,
      song.charter,
      song.diffGuitar,
      song.diffBass,
      song.diffDrums,
      song.diffKeys,
      song.diffVocals,
      song.albumImageUrl,
      song.previewUrl,
      song.createdAt,
      artist.name,
      album.name,
      genre.name,
      ...(relevanceScore ? [] : []),
    ];

    const data = finalWhereClause
      ? await baseDataQuery
          .where(finalWhereClause)
          .groupBy(...groupByClause)
          .orderBy(orderByPrimary, asc(song.id))
          .limit(limit + 1)
      : await baseDataQuery
          .groupBy(...groupByClause)
          .orderBy(orderByPrimary, asc(song.id))
          .limit(limit + 1);

    const hasMore = data.length > limit;
    const resultData = hasMore ? data.slice(0, limit) : data;

    // Get total count: only query if no cursor, otherwise use count from cursor
    let count: number;
    if (cursor) {
      const cursorData = JSON.parse(atob(cursor));
      count = cursorData.total;
    } else {
      const countBaseQuery = db
        .select({ count: sql<number>`count(DISTINCT ${song.id})` })
        .from(song)
        .leftJoin(artist, eq(song.artistId, artist.id))
        .leftJoin(album, eq(song.albumId, album.id))
        .leftJoin(genre, eq(song.genreId, genre.id))
        .leftJoin(downloadUrl, eq(song.id, downloadUrl.songId));

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

      if (query && relevanceScore) {
        const cursorData = {
          lastScore: lastItem.relevanceScore,
          lastId: lastItem.id,
          total: count,
        };
        nextCursor = btoa(JSON.stringify(cursorData));
      } else {
        switch (sortBy) {
          case "name":
            lastValue = lastItem.title;
            break;
          case "artist":
            lastValue = lastItem.artist;
            break;
          case "album":
            lastValue = lastItem.album;
            break;
          case "createdAt":
          default:
            lastValue = lastItem.createdAt;
            break;
        }

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
        albumImageUrl: songRecord.albumImageUrl,
        previewUrl: songRecord.previewUrl,
        artist: artistRecord.name,
        album: albumRecord.name,
        genre: genreRecord?.name,
        downloadUrls: [{ url: songData.downloadUrl, source: songData.source }],
      });
    });
  }

  private static convertToProviderMusic(record: any): ProviderMusic {
    return {
      id: record.id,
      name: record.title,
      artist: record.artist || "",
      album: record.album ?? null,
      coverUrl: record.albumImageUrl || "",
      downloadUrls: record.downloadUrls || [],
      sourceUpdatedAt: null,
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
