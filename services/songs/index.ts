import type { ProviderMusic } from "@/types";
import { db } from "@/lib/db";
import { song, downloadUrl } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  normalizeProviderSongs,
  deduplicateSongs,
  fetchExistingSongs,
  resolveMetadata,
  getInstrumentCountFromProviderMusic,
  getInstrumentCountFromDBSong,
  type SongWithKey,
  type ExistingSongWithDownloads,
} from "./helpers";
import type { NewSong } from "@/lib/db/schema";

// Re-export helpers for backwards compatibility
export { normalizedSongKey, normalizeText } from "./helpers";

interface ProcessingStats {
  updated: number;
  added: number;
  ignored: number;
}

export type ProgressCallback = (data: {
  phase: string;
  progress: number;
  stats: ProcessingStats;
}) => void;

export async function processSongs(
  songs: ProviderMusic[],
  provider: string,
  onProgress?: ProgressCallback,
): Promise<ProcessingStats> {
  const BATCH_SIZE = 500;
  const stats: ProcessingStats = { updated: 0, added: 0, ignored: 0 };
  const totalSongs = songs.length;
  let processedCount = 0;

  const chunks = [];
  for (let i = 0; i < totalSongs; i += BATCH_SIZE) {
    chunks.push(songs.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    const reportProgress = (phase: string) => {
      if (onProgress) {
        const progress = Math.min(
          100,
          Math.round((processedCount / totalSongs) * 100),
        );
        onProgress({ phase, progress, stats });
      }
    };

    const batchStats = await saveSongsInBatches(
      chunk,
      provider,
      reportProgress,
    );
    stats.updated += batchStats.updated;
    stats.added += batchStats.added;
    stats.ignored += batchStats.ignored;

    processedCount += chunk.length;

    // Report progress after batch completion
    if (onProgress) {
      const progress = Math.min(
        100,
        Math.round((processedCount / totalSongs) * 100),
      );
      onProgress({ phase: "Saving songs", progress, stats });
    }
  }

  return stats;
}

async function saveSongsInBatches(
  songs: ProviderMusic[],
  provider: string,
  onPhaseChange?: (phase: string) => void,
): Promise<ProcessingStats> {
  const stats: ProcessingStats = { updated: 0, added: 0, ignored: 0 };

  // 1. Normalize and deduplicate songs within the batch
  if (onPhaseChange) onPhaseChange("Deduplicating songs");
  const songsWithKeysRaw = normalizeProviderSongs(songs);
  const songsWithKeys = deduplicateSongs(songsWithKeysRaw);
  const keys = songsWithKeys.map((s) => s.key);

  // 2. Fetch existing songs
  if (onPhaseChange) onPhaseChange("Fetching existing songs");
  const existingMap = await fetchExistingSongs(keys);

  // 3. Pre-resolve metadata (Artists, Albums, Genres) in parallel
  if (onPhaseChange) onPhaseChange("Pre-resolving metadata");
  const metadata = await resolveMetadata(songsWithKeys);

  // 4. Separate new and existing songs
  if (onPhaseChange) onPhaseChange("Building transactions");

  const newSongs: SongWithKey[] = [];
  const existingSongsToUpdate: {
    song: SongWithKey;
    existing: ExistingSongWithDownloads;
  }[] = [];

  for (const songData of songsWithKeys) {
    const existing = existingMap.get(songData.key);

    if (!existing) {
      newSongs.push(songData);
    } else {
      existingSongsToUpdate.push({ song: songData, existing });
    }
  }

  // Bulk create new songs
  if (newSongs.length > 0) {
    const newSongData = newSongs.map((songData) => {
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
    await db.transaction(async (tx) => {
      const insertedSongs = await tx
        .insert(song)
        .values(newSongData)
        .returning();

      // Insert downloads for each song
      const downloadInserts = insertedSongs.map((insertedSong, index) => {
        const originalSong = newSongs[index];
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
    });

    stats.added += newSongs.length;
  }

  // Process existing songs for updates
  const transactionOps: Promise<unknown>[] = [];

  for (const { song: songData, existing } of existingSongsToUpdate) {
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
      stats.ignored++;
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

    // If nothing to do, ignore
    if (!shouldUpdateSong && !shouldAddDownload && !shouldReplaceDownloads) {
      stats.ignored++;
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

    stats.updated++;
  }

  // 5. Execute all operations in a single transaction
  if (transactionOps.length > 0) {
    if (onPhaseChange) onPhaseChange("Saving songs");
    await db.transaction(async () => {
      await Promise.all(transactionOps);
    });
  }

  return stats;
}
