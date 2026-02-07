import type { ProviderMusic } from "@/types";
import { db } from "@/lib/db";
import { song, artist, album, genre, downloadUrl } from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Song, NewSong } from "@/lib/db/schema";

// =============================================================================
// Normalization & Key Generation
// =============================================================================

const FEAT_REGEX = /\b(feat|ft|featuring|with)\b.*$/i;
const VERSION_REGEX =
  /\b(remix|edit|live|radio edit|extended|mix|version)\b.*$/i;

export function normalizeText(text: string): string {
  return text
    .replace(FEAT_REGEX, "")
    .replace(VERSION_REGEX, "")
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizedSongKey(title: string, artist: string): string {
  return `${normalizeText(title)}|${normalizeText(artist)}`;
}

// =============================================================================
// Instrument Counting Utilities
// =============================================================================

export function getInstrumentCountFromProviderMusic(
  instruments: ProviderMusic["instruments"],
): number {
  let count = 0;
  if (instruments.guitar !== undefined && instruments.guitar !== null) count++;
  if (instruments.bass !== undefined && instruments.bass !== null) count++;
  if (instruments.drums !== undefined && instruments.drums !== null) count++;
  if (instruments.keys !== undefined && instruments.keys !== null) count++;
  if (instruments.vocals !== undefined && instruments.vocals !== null) count++;
  return count;
}

export function getInstrumentCountFromDBSong(song: {
  diffGuitar: number | null;
  diffBass: number | null;
  diffDrums: number | null;
  diffKeys: number | null;
  diffVocals: number | null;
}): number {
  let count = 0;
  if (song.diffGuitar !== null) count++;
  if (song.diffBass !== null) count++;
  if (song.diffDrums !== null) count++;
  if (song.diffKeys !== null) count++;
  if (song.diffVocals !== null) count++;
  return count;
}

export function getMetadataCount(song: ProviderMusic): number {
  let count = 0;
  if (song.album) count++;
  if (song.genre) count++;
  if (song.year) count++;
  return count;
}

// =============================================================================
// Songs with Keys Type
// =============================================================================

export type SongWithKey = ProviderMusic & { key: string };

// =============================================================================
// Step 1: Normalize Songs & Add Keys
// =============================================================================

export function normalizeProviderSongs(songs: ProviderMusic[]): SongWithKey[] {
  return songs.map((s) => ({
    ...s,
    key: normalizedSongKey(s.name, s.artist),
  }));
}

// =============================================================================
// Step 2: Deduplicate Songs (keep best version by instrument count, then metadata)
// =============================================================================

export function deduplicateSongs(songsWithKeys: SongWithKey[]): SongWithKey[] {
  const uniqueMap = new Map<string, SongWithKey>();

  for (const s of songsWithKeys) {
    const existing = uniqueMap.get(s.key);
    if (!existing) {
      uniqueMap.set(s.key, s);
    } else {
      // Priority 1: More instruments wins
      const newInstruments = getInstrumentCountFromProviderMusic(s.instruments);
      const existingInstruments = getInstrumentCountFromProviderMusic(
        existing.instruments,
      );
      if (newInstruments > existingInstruments) {
        uniqueMap.set(s.key, s);
      } else if (
        newInstruments === existingInstruments &&
        getMetadataCount(s) > getMetadataCount(existing)
      ) {
        // Priority 2: More metadata wins (when instruments are equal)
        uniqueMap.set(s.key, s);
      }
    }
  }

  return Array.from(uniqueMap.values());
}

// =============================================================================
// Step 3: Fetch Existing Songs by Keys
// =============================================================================

export interface ExistingSongWithDownloads extends Song {
  downloads: { id: string; url: string; source: string; songId: string }[];
}

export async function fetchExistingSongs(
  keys: string[],
): Promise<Map<string, ExistingSongWithDownloads>> {
  if (keys.length === 0) return new Map();

  const existingSongs = await db
    .select()
    .from(song)
    .where(inArray(song.key, keys))
    .leftJoin(downloadUrl, eq(song.id, downloadUrl.songId));

  // Group by song and collect downloads
  const existingMap = new Map<string, ExistingSongWithDownloads>();
  existingSongs.forEach((row) => {
    if (!existingMap.has(row.song.key)) {
      existingMap.set(row.song.key, {
        ...row.song,
        downloads: [],
      });
    }
    if (row.download_url) {
      existingMap.get(row.song.key)!.downloads.push(row.download_url);
    }
  });

  return existingMap;
}

// =============================================================================
// Step 4: Resolve Metadata (Artists, Albums, Genres) in Bulk
// =============================================================================

export interface MetadataMaps {
  artistMap: Map<string, string>;
  albumMap: Map<string, string>;
  genreMap: Map<string, string>;
}

export async function resolveMetadata(
  songs: SongWithKey[],
): Promise<MetadataMaps> {
  const uniqueArtists = [...new Set(songs.map((s) => s.artist))];
  const uniqueAlbums = [
    ...new Set(
      songs.map((s) => s.album).filter((a): a is string => Boolean(a)),
    ),
  ];
  const uniqueGenres = [
    ...new Set(
      songs.map((s) => s.genre).filter((g): g is string => Boolean(g)),
    ),
  ];

  // Bulk upsert all metadata in parallel
  const [artists, albums, genres] = await Promise.all([
    uniqueArtists.length > 0
      ? db
          .insert(artist)
          .values(uniqueArtists.map((name) => ({ id: randomUUID(), name })))
          .onConflictDoUpdate({
            target: artist.name,
            set: { name: sql`excluded.name` },
          })
          .returning()
      : [],
    uniqueAlbums.length > 0
      ? db
          .insert(album)
          .values(uniqueAlbums.map((name) => ({ id: randomUUID(), name })))
          .onConflictDoUpdate({
            target: album.name,
            set: { name: sql`excluded.name` },
          })
          .returning()
      : [],
    uniqueGenres.length > 0
      ? db
          .insert(genre)
          .values(uniqueGenres.map((name) => ({ id: randomUUID(), name })))
          .onConflictDoUpdate({
            target: genre.name,
            set: { name: sql`excluded.name` },
          })
          .returning()
      : [],
  ]);

  return {
    artistMap: new Map(artists.map((a) => [a.name, a.id])),
    albumMap: new Map(albums.map((a) => [a.name, a.id])),
    genreMap: new Map(genres.map((g) => [g.name, g.id])),
  };
}

// =============================================================================
// Step 5: Insert New Songs
// =============================================================================

export interface InsertedSong {
  id: string;
  key: string;
}

export async function insertNewSongs(
  songs: SongWithKey[],
  metadata: MetadataMaps,
  provider: string,
): Promise<InsertedSong[]> {
  if (songs.length === 0) return [];

  const newSongData = songs.map((songData) => {
    const artistId = metadata.artistMap.get(songData.artist)!;
    const albumId = songData.album
      ? (metadata.albumMap.get(songData.album) ?? null)
      : null;
    const genreId = songData.genre
      ? (metadata.genreMap.get(songData.genre) ?? null)
      : null;

    const diffs = {
      diffGuitar: songData.instruments.guitar ?? null,
      diffBass: songData.instruments.bass ?? null,
      diffDrums: songData.instruments.drums ?? null,
      diffKeys: songData.instruments.keys ?? null,
      diffVocals: songData.instruments.vocals ?? null,
    };

    return {
      id: randomUUID(),
      key: songData.key,
      title: songData.name,
      year: songData.year,
      artistId,
      albumId,
      genreId,
      charter: songData.charter,
      previewUrl: null,
      albumImageUrl: songData.coverUrl,
      ...diffs,
      ...(songData.sourceUpdatedAt
        ? { createdAt: songData.sourceUpdatedAt }
        : {}),
    };
  });

  // Insert songs and their downloads in a transaction
  const insertedSongs = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(song)
      .values(newSongData)
      .returning({ id: song.id, key: song.key });

    // Insert downloads for each song
    const downloadInserts = inserted.map((insertedSong, index) => {
      const originalSong = songs[index];
      const firstDownload = originalSong.downloadUrls?.[0];
      if (!firstDownload) return Promise.resolve();
      return tx.insert(downloadUrl).values({
        id: randomUUID(),
        url: firstDownload.url,
        source: provider,
        songId: insertedSong.id,
      });
    });

    await Promise.all(downloadInserts);
    return inserted;
  });

  return insertedSongs;
}

// =============================================================================
// Step 6: Update Existing Songs
// =============================================================================

export interface UpdateResult {
  updated: number;
  ignored: number;
  songIds: string[];
}

export async function updateExistingSongs(
  songsToUpdate: { song: SongWithKey; existing: ExistingSongWithDownloads }[],
  metadata: MetadataMaps,
  provider: string,
): Promise<UpdateResult> {
  const result: UpdateResult = { updated: 0, ignored: 0, songIds: [] };
  const transactionOps: Promise<unknown>[] = [];

  for (const { song: songData, existing } of songsToUpdate) {
    const albumId = songData.album
      ? (metadata.albumMap.get(songData.album) ?? null)
      : null;
    const genreId = songData.genre
      ? (metadata.genreMap.get(songData.genre) ?? null)
      : null;

    const diffs = {
      diffGuitar: songData.instruments.guitar ?? null,
      diffBass: songData.instruments.bass ?? null,
      diffDrums: songData.instruments.drums ?? null,
      diffKeys: songData.instruments.keys ?? null,
      diffVocals: songData.instruments.vocals ?? null,
    };

    // UPDATE LOGIC for existing songs
    const newScore = getInstrumentCountFromProviderMusic(songData.instruments);
    const oldScore = getInstrumentCountFromDBSong(existing);

    // New version has FEWER instruments -> IGNORE completely
    if (newScore < oldScore) {
      result.ignored++;
      result.songIds.push(existing.id); // Still track the song id for linking
      continue;
    }

    let shouldUpdateSong = false;
    const updateData: Partial<NewSong> = {};
    let shouldReplaceDownloads = false;
    let shouldAddDownload = false;

    if (newScore > oldScore) {
      // New version has MORE instruments -> replace downloads and update diffs
      shouldReplaceDownloads = true;
      shouldUpdateSong = true;
      Object.assign(updateData, diffs);
    } else {
      // SAME instrument count -> check if we need to add a download link
      const existingLinksForSource = existing.downloads.filter(
        (d) => d.source === provider,
      );
      const firstDownloadUrl = songData.downloadUrls?.[0]?.url;
      const linkExists =
        firstDownloadUrl &&
        existingLinksForSource.some((d) => d.url === firstDownloadUrl);

      if (
        firstDownloadUrl &&
        (existingLinksForSource.length === 0 || !linkExists)
      ) {
        shouldAddDownload = true;
      }
    }

    // Check for missing metadata that can be filled
    if (songData.year && !existing.year) {
      updateData.year = songData.year;
      shouldUpdateSong = true;
    }
    if (albumId && !existing.albumId) {
      updateData.albumId = albumId;
      shouldUpdateSong = true;
    }
    if (genreId && !existing.genreId) {
      updateData.genreId = genreId;
      shouldUpdateSong = true;
    }
    if (songData.coverUrl && !existing.albumImageUrl) {
      updateData.albumImageUrl = songData.coverUrl;
      shouldUpdateSong = true;
    }

    // If nothing to do, track as ignored but still include song id
    if (!shouldUpdateSong && !shouldAddDownload && !shouldReplaceDownloads) {
      result.ignored++;
      result.songIds.push(existing.id);
      continue;
    }

    // Apply download operations
    const firstDownloadUrl = songData.downloadUrls?.[0]?.url;
    if (shouldReplaceDownloads && firstDownloadUrl) {
      transactionOps.push(
        db.delete(downloadUrl).where(eq(downloadUrl.songId, existing.id)),
      );
      transactionOps.push(
        db.insert(downloadUrl).values({
          id: randomUUID(),
          url: firstDownloadUrl,
          source: provider,
          songId: existing.id,
        }),
      );
    } else if (shouldAddDownload && firstDownloadUrl) {
      transactionOps.push(
        db.insert(downloadUrl).values({
          id: randomUUID(),
          url: firstDownloadUrl,
          source: provider,
          songId: existing.id,
        }),
      );
    }

    // Apply song update if needed
    if (shouldUpdateSong && Object.keys(updateData).length > 0) {
      transactionOps.push(
        db.update(song).set(updateData).where(eq(song.id, existing.id)),
      );
    }

    result.updated++;
    result.songIds.push(existing.id);
  }

  // Execute all operations
  if (transactionOps.length > 0) {
    await db.transaction(async () => {
      await Promise.all(transactionOps);
    });
  }

  return result;
}
