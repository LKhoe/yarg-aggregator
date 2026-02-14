import type { ProviderMusic } from "@/types";
import { db } from "@/lib/db";
import { installation, installationSong, song } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { SongEntry } from "@/services/cache-reader/Song/Entries/SongEntry";
import { type SerializedSongEntry } from "./serialization";
import {
  normalizeProviderSongs,
  deduplicateSongs,
  fetchExistingSongs,
  resolveMetadata,
  insertNewSongs,
  type SongWithKey,
} from "./helpers";

// =============================================================================
// Types
// =============================================================================

export interface InstallationInfo {
  id?: string;
  name: string;
  path?: string;
}

export interface SongDetail {
  title: string;
  artist: string;
}

export interface InstalledSongsStats {
  added: number;
  updated: number;
  linked: number;
  details: {
    added: SongDetail[];
    updated: SongDetail[];
    linked: SongDetail[];
  };
}

// =============================================================================
// SongEntry → ProviderMusic Conversion
// =============================================================================

/**
 * Converts a SongEntry from the YARG cache to a ProviderMusic shape
 * Uses _metadata for title/artist/album/etc and _parts for instrument difficulties
 */
export function songEntryToProviderMusic(entry: SongEntry): ProviderMusic {
  const meta = entry._metadata;
  const parts = entry._parts;

  // Get difficulty (intensity) for each main instrument type
  // Use the best available variant for each instrument
  const getGuitarDiff = () => {
    // Check FiveFretGuitar first, then SixFretGuitar
    if (parts.FiveFretGuitar.Intensity >= 0)
      return parts.FiveFretGuitar.Intensity;
    if (parts.SixFretGuitar.Intensity >= 0)
      return parts.SixFretGuitar.Intensity;
    return null;
  };

  const getBassDiff = () => {
    if (parts.FiveFretBass.Intensity >= 0) return parts.FiveFretBass.Intensity;
    if (parts.SixFretBass.Intensity >= 0) return parts.SixFretBass.Intensity;
    return null;
  };

  const getDrumsDiff = () => {
    if (parts.FourLaneDrums.Intensity >= 0)
      return parts.FourLaneDrums.Intensity;
    if (parts.FiveLaneDrums.Intensity >= 0)
      return parts.FiveLaneDrums.Intensity;
    if (parts.ProDrums.Intensity >= 0) return parts.ProDrums.Intensity;
    return null;
  };

  const getKeysDiff = () => {
    if (parts.Keys.Intensity >= 0) return parts.Keys.Intensity;
    if (parts.ProKeys.Intensity >= 0) return parts.ProKeys.Intensity;
    return null;
  };

  const getVocalsDiff = () => {
    if (parts.LeadVocals.Intensity >= 0) return parts.LeadVocals.Intensity;
    if (parts.HarmonyVocals.Intensity >= 0)
      return parts.HarmonyVocals.Intensity;
    return null;
  };

  // Parse year as integer if possible
  let year: number | null = null;
  if (meta.Year) {
    const parsed = parseInt(meta.Year, 10);
    if (!isNaN(parsed)) {
      year = parsed;
    }
  }

  return {
    name: meta.Name,
    artist: meta.Artist,
    album: meta.Album || null,
    genre: meta.Genre || null,
    year,
    charter: meta.Charter || null,
    coverUrl: "", // Cache doesn't contain cover URLs
    downloadUrls: [], // Installed songs don't have download URLs
    sourceUpdatedAt: null,
    instruments: {
      guitar: getGuitarDiff(),
      bass: getBassDiff(),
      drums: getDrumsDiff(),
      keys: getKeysDiff(),
      vocals: getVocalsDiff(),
    },
  };
}

// =============================================================================
// Installation Management
// =============================================================================

/**
 * Finds an existing installation by ID or creates a new one
 */
export async function getOrCreateInstallation(
  info: InstallationInfo,
): Promise<string> {
  // If ID is provided, try to find existing
  if (info.id) {
    const [existing] = await db
      .select()
      .from(installation)
      .where(eq(installation.id, info.id))
      .limit(1);
    if (existing) {
      return existing.id;
    }
  }

  // Create new installation
  const [created] = await db
    .insert(installation)
    .values({
      id: info.id || randomUUID(),
      name: info.name,
      path: info.path || null,
    })
    .returning({ id: installation.id });

  return created.id;
}

/**
 * Gets all installations from the database
 */
export async function getAllInstallations() {
  return db.select().from(installation).orderBy(installation.name);
}

// =============================================================================
// Main Processing Function
// =============================================================================

/**
 * Processes installed songs for a specific installation.
 *
 * 1. Converts SongEntry[] to ProviderMusic shape
 * 2. Normalizes + keys them (normalizedSongKey)
 * 3. Upserts into song/artist/album/genre using existing pipeline
 * 4. Creates the installation if it doesn't exist
 * 5. Inserts into installation_song any (installationId, songId) that is missing
 *
 * @returns Stats: { added, updated, linked }
 */
export async function processInstalledSongsForInstallation(
  installationInfo: InstallationInfo,
  songEntries: SongEntry[],
): Promise<InstalledSongsStats> {
  const stats: InstalledSongsStats = {
    added: 0,
    updated: 0,
    linked: 0,
    details: { added: [], updated: [], linked: [] },
  };

  if (songEntries.length === 0) {
    return stats;
  }

  // Step 1: Convert SongEntry[] to ProviderMusic[]
  const providerSongs = songEntries.map(songEntryToProviderMusic);

  // Step 2: Normalize and deduplicate
  const songsWithKeysRaw = normalizeProviderSongs(providerSongs);
  const songsWithKeys = deduplicateSongs(songsWithKeysRaw);
  const keys = songsWithKeys.map((s) => s.key);

  // Step 3: Fetch existing songs
  const existingMap = await fetchExistingSongs(keys);

  // Step 4: Resolve metadata (Artists, Albums, Genres)
  const metadata = await resolveMetadata(songsWithKeys);

  // Step 5: Separate new and existing songs
  const newSongs: SongWithKey[] = [];
  const existingSongIds: string[] = [];

  for (const songData of songsWithKeys) {
    const existing = existingMap.get(songData.key);
    if (!existing) {
      newSongs.push(songData);
    } else {
      existingSongIds.push(existing.id);
      stats.updated++;
      stats.details.updated.push({
        title: songData.name,
        artist: songData.artist,
      });
    }
  }

  // Step 6: Insert new songs (using "local" as the provider - no download links)
  const insertedSongs = await insertNewSongs(newSongs, metadata, "local");
  stats.added = insertedSongs.length;
  for (const songData of newSongs) {
    stats.details.added.push({
      title: songData.name,
      artist: songData.artist,
    });
  }

  // Build a map from songId to song detail for linked tracking
  const songIdToDetail = new Map<string, SongDetail>();
  for (let i = 0; i < insertedSongs.length; i++) {
    songIdToDetail.set(insertedSongs[i].id, {
      title: newSongs[i].name,
      artist: newSongs[i].artist,
    });
  }
  for (let i = 0; i < existingSongIds.length; i++) {
    const songData = songsWithKeys.find(
      (s) => existingMap.get(s.key)?.id === existingSongIds[i],
    );
    if (songData) {
      songIdToDetail.set(existingSongIds[i], {
        title: songData.name,
        artist: songData.artist,
      });
    }
  }

  // Collect all song IDs (new + existing)
  const allSongIds = [...insertedSongs.map((s) => s.id), ...existingSongIds];

  // Step 7: Get or create installation
  const installationId = await getOrCreateInstallation(installationInfo);

  // Step 8: Link songs to installation (only those not already linked)
  if (allSongIds.length > 0) {
    // Get existing links for this installation
    const existingLinks = await db
      .select({ songId: installationSong.songId })
      .from(installationSong)
      .where(
        and(
          eq(installationSong.installationId, installationId),
          inArray(installationSong.songId, allSongIds),
        ),
      );

    const existingLinkedSongIds = new Set(existingLinks.map((l) => l.songId));

    // Filter out songs that are already linked
    const songsToLink = allSongIds.filter(
      (id) => !existingLinkedSongIds.has(id),
    );

    if (songsToLink.length > 0) {
      await db.insert(installationSong).values(
        songsToLink.map((songId) => ({
          id: randomUUID(),
          installationId,
          songId,
        })),
      );
      stats.linked = songsToLink.length;
      for (const songId of songsToLink) {
        const detail = songIdToDetail.get(songId);
        if (detail) {
          stats.details.linked.push(detail);
        }
      }
    }
  }

  return stats;
}

// =============================================================================
// Helpers for serialized entry processing (SerializedSongEntry imported above)
// =============================================================================

/**
 * Converts a serialized song entry back to a ProviderMusic shape
 */
export function serializedEntryToProviderMusic(
  entry: SerializedSongEntry,
): ProviderMusic {
  const meta = entry.metadata;
  const parts = entry.parts;

  const getGuitarDiff = () => {
    if (parts.FiveFretGuitar.Intensity >= 0)
      return parts.FiveFretGuitar.Intensity;
    if (parts.SixFretGuitar.Intensity >= 0)
      return parts.SixFretGuitar.Intensity;
    return null;
  };

  const getBassDiff = () => {
    if (parts.FiveFretBass.Intensity >= 0) return parts.FiveFretBass.Intensity;
    if (parts.SixFretBass.Intensity >= 0) return parts.SixFretBass.Intensity;
    return null;
  };

  const getDrumsDiff = () => {
    if (parts.FourLaneDrums.Intensity >= 0)
      return parts.FourLaneDrums.Intensity;
    if (parts.FiveLaneDrums.Intensity >= 0)
      return parts.FiveLaneDrums.Intensity;
    if (parts.ProDrums.Intensity >= 0) return parts.ProDrums.Intensity;
    return null;
  };

  const getKeysDiff = () => {
    if (parts.Keys.Intensity >= 0) return parts.Keys.Intensity;
    if (parts.ProKeys.Intensity >= 0) return parts.ProKeys.Intensity;
    return null;
  };

  const getVocalsDiff = () => {
    if (parts.LeadVocals.Intensity >= 0) return parts.LeadVocals.Intensity;
    if (parts.HarmonyVocals.Intensity >= 0)
      return parts.HarmonyVocals.Intensity;
    return null;
  };

  let year: number | null = null;
  if (meta.Year) {
    const parsed = parseInt(meta.Year, 10);
    if (!isNaN(parsed)) {
      year = parsed;
    }
  }

  return {
    name: meta.Name,
    artist: meta.Artist,
    album: meta.Album || null,
    genre: meta.Genre || null,
    year,
    charter: meta.Charter || null,
    coverUrl: "",
    downloadUrls: [],
    sourceUpdatedAt: null,
    instruments: {
      guitar: getGuitarDiff(),
      bass: getBassDiff(),
      drums: getDrumsDiff(),
      keys: getKeysDiff(),
      vocals: getVocalsDiff(),
    },
  };
}

/**
 * Processes installed songs from serialized entries (for API use)
 */
export async function processSerializedInstalledSongs(
  installationInfo: InstallationInfo,
  serializedEntries: SerializedSongEntry[],
): Promise<InstalledSongsStats> {
  const stats: InstalledSongsStats = {
    added: 0,
    updated: 0,
    linked: 0,
    details: { added: [], updated: [], linked: [] },
  };

  if (serializedEntries.length === 0) {
    return stats;
  }

  // Convert serialized entries to ProviderMusic
  const providerSongs = serializedEntries.map(serializedEntryToProviderMusic);

  // Step 2: Normalize and deduplicate
  const songsWithKeysRaw = normalizeProviderSongs(providerSongs);
  const songsWithKeys = deduplicateSongs(songsWithKeysRaw);
  const keys = songsWithKeys.map((s) => s.key);

  // Step 3: Fetch existing songs
  const existingMap = await fetchExistingSongs(keys);

  // Step 4: Resolve metadata (Artists, Albums, Genres)
  const metadata = await resolveMetadata(songsWithKeys);

  // Step 5: Separate new and existing songs
  const newSongs: SongWithKey[] = [];
  const existingSongIds: string[] = [];

  for (const songData of songsWithKeys) {
    const existing = existingMap.get(songData.key);
    if (!existing) {
      newSongs.push(songData);
    } else {
      existingSongIds.push(existing.id);
      stats.updated++;
      stats.details.updated.push({
        title: songData.name,
        artist: songData.artist,
      });
    }
  }

  // Step 6: Insert new songs
  const insertedSongs = await insertNewSongs(newSongs, metadata, "local");
  stats.added = insertedSongs.length;
  for (const songData of newSongs) {
    stats.details.added.push({
      title: songData.name,
      artist: songData.artist,
    });
  }

  // Build a map from songId to song detail for linked tracking
  const songIdToDetail = new Map<string, SongDetail>();
  for (let i = 0; i < insertedSongs.length; i++) {
    songIdToDetail.set(insertedSongs[i].id, {
      title: newSongs[i].name,
      artist: newSongs[i].artist,
    });
  }
  for (let i = 0; i < existingSongIds.length; i++) {
    const songData = songsWithKeys.find(
      (s) => existingMap.get(s.key)?.id === existingSongIds[i],
    );
    if (songData) {
      songIdToDetail.set(existingSongIds[i], {
        title: songData.name,
        artist: songData.artist,
      });
    }
  }

  // Collect all song IDs
  const allSongIds = [...insertedSongs.map((s) => s.id), ...existingSongIds];

  // Step 7: Get or create installation
  const installationId = await getOrCreateInstallation(installationInfo);

  // Step 8: Link songs to installation
  if (allSongIds.length > 0) {
    const existingLinks = await db
      .select({ songId: installationSong.songId })
      .from(installationSong)
      .where(
        and(
          eq(installationSong.installationId, installationId),
          inArray(installationSong.songId, allSongIds),
        ),
      );

    const existingLinkedSongIds = new Set(existingLinks.map((l) => l.songId));
    const songsToLink = allSongIds.filter(
      (id) => !existingLinkedSongIds.has(id),
    );

    if (songsToLink.length > 0) {
      await db.insert(installationSong).values(
        songsToLink.map((songId) => ({
          id: randomUUID(),
          installationId,
          songId,
        })),
      );
      stats.linked = songsToLink.length;
      for (const songId of songsToLink) {
        const detail = songIdToDetail.get(songId);
        if (detail) {
          stats.details.linked.push(detail);
        }
      }
    }
  }

  return stats;
}
