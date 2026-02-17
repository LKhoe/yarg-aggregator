import { db } from "@/lib/db";
import { songList, songListItem, song, artist, album, downloadUrl } from "@/lib/db/schema";
import { eq, and, sql, or, desc, inArray, ne } from "drizzle-orm";
import type { SongList, SongListItem, Song } from "@/lib/db/schema";

export type ListWithItemCount = SongList & {
  itemCount: number;
};

export type ListWithItems = SongList & {
  items: (SongListItem & {
    song: Song & {
      artist: { name: string };
      album: { name: string } | null;
      downloadUrls: { url: string; source: string }[];
    };
  })[];
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export class ListService {
  static async getUserLists(userId: string): Promise<ListWithItemCount[]> {
    const listsResult = await db.select().from(songList).where(eq(songList.userId, userId));
    const lists = listsResult;

    // Get item counts for each list
    const listsWithCounts = await Promise.all(
      lists.map(async (list) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(songListItem)
          .where(eq(songListItem.listId, list.id));

        return {
          ...list,
          itemCount: Number(countResult?.count ?? 0),
        };
      }),
    );

    return listsWithCounts;
  }

  static async getPublicLists(userId: string): Promise<ListWithItemCount[]> {
    const listsResult = await db.select().from(songList).where(and(eq(songList.userId, userId), eq(songList.isPublic, true)));
    const lists = listsResult;

    const listsWithCounts = await Promise.all(
      lists.map(async (list) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(songListItem)
          .where(eq(songListItem.listId, list.id));

        return {
          ...list,
          itemCount: Number(countResult?.count ?? 0),
        };
      }),
    );

    return listsWithCounts;
  }

  static async getListById(
    listId: string,
    userId?: string,
  ): Promise<ListWithItems | null> {
    const whereCondition = userId
      ? and(eq(songList.id, listId), or(eq(songList.userId, userId), eq(songList.isPublic, true)))
      : and(eq(songList.id, listId), eq(songList.isPublic, true));

    const listResult = await db.select().from(songList).where(whereCondition).limit(1);
    const list = listResult[0];

    if (!list) {
      return null;
    }

    // Get items with songs, artists, and albums using separate queries
    const itemsResult = await db
      .select()
      .from(songListItem)
      .where(eq(songListItem.listId, list.id))
      .orderBy(desc(songListItem.addedAt));

    // Get all songs for these items
    const songIds = itemsResult.map(item => item.songId);
    const songs = songIds.length > 0 
      ? await db.select().from(song).where(inArray(song.id, songIds))
      : [];

    // Get all artists for these songs
    const artistIds = songs.map(song => song.artistId).filter(Boolean);
    const artists = artistIds.length > 0
      ? await db.select().from(artist).where(inArray(artist.id, artistIds))
      : [];

    // Get all albums for these songs
    const albumIds = songs.map(song => song.albumId).filter((id): id is string => id !== null);
    const albums = albumIds.length > 0
      ? await db.select().from(album).where(inArray(album.id, albumIds))
      : [];

    // Get download URLs for all songs
    const downloadUrls = songIds.length > 0
      ? await db.select().from(downloadUrl).where(inArray(downloadUrl.songId, songIds))
      : [];

    // Create lookup maps
    const artistMap = new Map(artists.map(a => [a.id, a]));
    const albumMap = new Map(albums.map(a => [a.id, a]));
    const songMap = new Map(songs.map(s => [s.id, s]));
    const downloadUrlMap = new Map<string, { url: string; source: string }[]>();
    for (const dl of downloadUrls) {
      const existing = downloadUrlMap.get(dl.songId) ?? [];
      existing.push({ url: dl.url, source: dl.source });
      downloadUrlMap.set(dl.songId, existing);
    }

    // Assemble the final result
    const transformedItems = itemsResult.map(item => {
      const songData = songMap.get(item.songId);
      if (!songData) return null;

      const artistData = artistMap.get(songData.artistId);
      const albumData = songData.albumId ? albumMap.get(songData.albumId) : null;

      return {
        ...item,
        song: {
          ...songData,
          artist: artistData ? { name: artistData.name } : { name: 'Unknown' },
          album: albumData ? { name: albumData.name } : null,
          downloadUrls: downloadUrlMap.get(item.songId) ?? [],
        },
      };
    }).filter(Boolean);

    return {
      ...list,
      items: transformedItems,
    } as ListWithItems;
  }

  static async getListBySlug(
    userId: string,
    slug: string,
  ): Promise<ListWithItems | null> {
    const listResult = await db.select().from(songList).where(and(eq(songList.userId, userId), eq(songList.slug, slug))).limit(1);
    const list = listResult[0];

    if (!list) {
      return null;
    }

    // Similar to getListById, get items with songs, artists, and albums
    const itemsResult = await db
      .select()
      .from(songListItem)
      .where(eq(songListItem.listId, list.id))
      .orderBy(desc(songListItem.addedAt));

    // Get all songs for these items
    const songIds = itemsResult.map(item => item.songId);
    const songs = songIds.length > 0 
      ? await db.select().from(song).where(inArray(song.id, songIds))
      : [];

    // Get all artists for these songs
    const artistIds = songs.map(song => song.artistId).filter(Boolean);
    const artists = artistIds.length > 0
      ? await db.select().from(artist).where(inArray(artist.id, artistIds))
      : [];

    // Get all albums for these songs
    const albumIds = songs.map(song => song.albumId).filter((id): id is string => id !== null);
    const albums = albumIds.length > 0
      ? await db.select().from(album).where(inArray(album.id, albumIds))
      : [];

    // Get download URLs for all songs
    const downloadUrls = songIds.length > 0
      ? await db.select().from(downloadUrl).where(inArray(downloadUrl.songId, songIds))
      : [];

    // Create lookup maps
    const artistMap = new Map(artists.map(a => [a.id, a]));
    const albumMap = new Map(albums.map(a => [a.id, a]));
    const songMap = new Map(songs.map(s => [s.id, s]));
    const downloadUrlMap = new Map<string, { url: string; source: string }[]>();
    for (const dl of downloadUrls) {
      const existing = downloadUrlMap.get(dl.songId) ?? [];
      existing.push({ url: dl.url, source: dl.source });
      downloadUrlMap.set(dl.songId, existing);
    }

    // Assemble the final result
    const transformedItems = itemsResult.map(item => {
      const songData = songMap.get(item.songId);
      if (!songData) return null;

      const artistData = artistMap.get(songData.artistId);
      const albumData = songData.albumId ? albumMap.get(songData.albumId) : null;

      return {
        ...item,
        song: {
          ...songData,
          artist: artistData ? { name: artistData.name } : { name: 'Unknown' },
          album: albumData ? { name: albumData.name } : null,
          downloadUrls: downloadUrlMap.get(item.songId) ?? [],
        },
      };
    }).filter(Boolean);

    return {
      ...list,
      items: transformedItems,
    } as ListWithItems | null;
  }

  static async getFavoritesList(userId: string): Promise<SongList | null> {
    const result = await db.select().from(songList).where(and(eq(songList.userId, userId), eq(songList.isFavorites, true))).limit(1);
    return result[0] ?? null;
  }

  static async createList(
    userId: string,
    name: string,
    isPublic: boolean = true,
  ): Promise<SongList> {
    const slug = generateSlug(name);

    // Ensure unique slug for user
    let finalSlug = slug;
    let suffix = 1;
    while (true) {
      const existingResult = await db.select().from(songList).where(and(eq(songList.userId, userId), eq(songList.slug, finalSlug))).limit(1);
      const existing = existingResult[0];
      if (!existing) break;
      finalSlug = `${slug}-${suffix}`;
      suffix++;
    }

    const [list] = await db
      .insert(songList)
      .values({
        userId,
        name,
        slug: finalSlug,
        isPublic,
        isFavorites: false,
      })
      .returning();

    return list;
  }

  static async updateList(
    listId: string,
    userId: string,
    data: { name?: string; isPublic?: boolean },
  ): Promise<SongList | null> {
    // Verify ownership
    const existingResult = await db.select().from(songList).where(and(eq(songList.id, listId), eq(songList.userId, userId))).limit(1);
    const existing = existingResult[0];

    if (!existing) {
      return null;
    }

    // Don't allow modifying favorites list name
    if (existing.isFavorites && data.name) {
      delete data.name;
    }

    const updateData: Partial<SongList> & { updatedAt: Date } = {
      ...data,
      updatedAt: new Date(),
    };

    // Update slug if name changed
    if (data.name && !existing.isFavorites) {
      let newSlug = generateSlug(data.name);
      let suffix = 1;
      while (true) {
        const slugExistsResult = await db.select().from(songList).where(and(eq(songList.userId, userId), eq(songList.slug, newSlug), ne(songList.id, listId))).limit(1);
        const slugExists = slugExistsResult[0];
        if (!slugExists) break;
        newSlug = `${generateSlug(data.name)}-${suffix}`;
        suffix++;
      }
      (updateData as { slug?: string }).slug = newSlug;
    }

    const [updated] = await db
      .update(songList)
      .set(updateData)
      .where(eq(songList.id, listId))
      .returning();

    return updated;
  }

  static async deleteList(listId: string, userId: string): Promise<boolean> {
    // Verify ownership and not favorites
    const existingResult = await db.select().from(songList).where(and(eq(songList.id, listId), eq(songList.userId, userId))).limit(1);
    const existing = existingResult[0];

    if (!existing || existing.isFavorites) {
      return false;
    }

    await db.delete(songList).where(eq(songList.id, listId));
    return true;
  }

  static async addSongsToList(
    listId: string,
    songIds: string[],
    userId: string,
  ): Promise<number> {
    if (songIds.length === 0) return 0;

    // Verify list ownership
    const listResult = await db.select().from(songList).where(and(eq(songList.id, listId), eq(songList.userId, userId))).limit(1);
    const list = listResult[0];

    if (!list) return 0;

    // Get existing songs in list to skip duplicates
    const existingItems = await db
      .select({ songId: songListItem.songId })
      .from(songListItem)
      .where(eq(songListItem.listId, listId));

    const existingSet = new Set(existingItems.map((item) => item.songId));
    const newSongIds = songIds.filter((id) => !existingSet.has(id));

    if (newSongIds.length === 0) return 0;

    await db.insert(songListItem).values(
      newSongIds.map((songId) => ({
        listId,
        songId,
      })),
    );

    await db
      .update(songList)
      .set({ updatedAt: new Date() })
      .where(eq(songList.id, listId));

    return newSongIds.length;
  }

  static async addSongToList(
    listId: string,
    songId: string,
    userId: string,
  ): Promise<SongListItem | null> {
    // Verify list ownership
    const listResult = await db.select().from(songList).where(and(eq(songList.id, listId), eq(songList.userId, userId))).limit(1);
    const list = listResult[0];

    if (!list) {
      return null;
    }

    // Check if song already in list
    const existingResult = await db.select().from(songListItem).where(and(eq(songListItem.listId, listId), eq(songListItem.songId, songId))).limit(1);
    const existing = existingResult[0];

    if (existing) {
      return existing;
    }

    const [item] = await db
      .insert(songListItem)
      .values({
        listId,
        songId,
      })
      .returning();

    // Update list updatedAt
    await db
      .update(songList)
      .set({ updatedAt: new Date() })
      .where(eq(songList.id, listId));

    return item;
  }

  static async removeSongFromList(
    listId: string,
    songId: string,
    userId: string,
  ): Promise<boolean> {
    // Verify list ownership
    const listResult = await db.select().from(songList).where(and(eq(songList.id, listId), eq(songList.userId, userId))).limit(1);
    const list = listResult[0];

    if (!list) {
      return false;
    }

    await db
      .delete(songListItem)
      .where(
        and(eq(songListItem.listId, listId), eq(songListItem.songId, songId)),
      );

    // Update list updatedAt
    await db
      .update(songList)
      .set({ updatedAt: new Date() })
      .where(eq(songList.id, listId));

    return true;
  }

  static async isSongInFavorites(
    userId: string,
    songId: string,
  ): Promise<boolean> {
    const favorites = await this.getFavoritesList(userId);
    if (!favorites) return false;

    const itemResult = await db.select().from(songListItem).where(and(eq(songListItem.listId, favorites.id), eq(songListItem.songId, songId))).limit(1);
    const item = itemResult[0];

    return !!item;
  }

  static async toggleFavorite(
    userId: string,
    songId: string,
  ): Promise<boolean> {
    const favorites = await this.getFavoritesList(userId);
    if (!favorites) return false;

    const existingResult = await db.select().from(songListItem).where(and(eq(songListItem.listId, favorites.id), eq(songListItem.songId, songId))).limit(1);
    const existing = existingResult[0];

    if (existing) {
      await db.delete(songListItem).where(eq(songListItem.id, existing.id));
      return false; // Removed from favorites
    } else {
      await db.insert(songListItem).values({
        listId: favorites.id,
        songId,
      });
      return true; // Added to favorites
    }
  }
}
