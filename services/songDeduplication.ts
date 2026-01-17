import { ProviderMusic, IMusic } from '@/types';
import Music from '@/models/Music';

/**
 * Sanitizes artist and song name for consistent comparison
 * - Converts to lowercase
 * - Removes extra whitespace
 * - Removes common punctuation and special characters
 * - Normalizes accented characters
 */
export function sanitizeSongName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s]/g, '') // Remove special characters except spaces
    .normalize('NFD') // Normalize accented characters
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
}

/**
 * Counts the number of instruments in a song configuration
 */
export function countInstruments(instruments: ProviderMusic['instruments'] | IMusic['instruments']): number {
  return Object.values(instruments).filter(
    (value): value is number => value !== undefined && value !== null && value > 0
  ).length;
}

/**
 * Finds existing songs in the database that match the given artist and song name
 * Uses sanitized comparison for matching across all sources
 */
export async function findExistingSongs(
  artist: string,
  name: string
): Promise<IMusic[]> {
  const sanitizedArtist = sanitizeSongName(artist);
  const sanitizedName = sanitizeSongName(name);
  
  // Use a more efficient approach: query with basic patterns and then filter
  // This is much better than loading all songs into memory
  const candidateSongs = await Music.find({
    $or: [
      { artist: { $regex: sanitizedArtist.split(' ').join('.*'), $options: 'i' } },
      { name: { $regex: sanitizedName.split(' ').join('.*'), $options: 'i' } }
    ]
  }).lean<IMusic[]>();
  
  // Filter the candidates with exact sanitization match
  return candidateSongs.filter(song => {
    const existingSanitizedArtist = sanitizeSongName(song.artist);
    const existingSanitizedName = sanitizeSongName(song.name);
    
    return existingSanitizedArtist === sanitizedArtist && existingSanitizedName === sanitizedName;
  });
}

/**
 * Compares two song versions and returns the one with more instruments
 * If they have the same number of instruments, prefers the existing one
 */
export function selectBestSongVersion(
  existingSong: IMusic,
  newSong: ProviderMusic
): { shouldKeep: 'existing' | 'new'; reason: string } {
  const existingInstrumentCount = countInstruments(existingSong.instruments);
  const newInstrumentCount = countInstruments(newSong.instruments);
  
  if (newInstrumentCount > existingInstrumentCount) {
    return {
      shouldKeep: 'new',
      reason: `New version has ${newInstrumentCount} instruments vs ${existingInstrumentCount} in existing version`
    };
  } else if (existingInstrumentCount > newInstrumentCount) {
    return {
      shouldKeep: 'existing',
      reason: `Existing version has ${existingInstrumentCount} instruments vs ${newInstrumentCount} in new version`
    };
  } else {
    // Same number of instruments, prefer existing to avoid unnecessary updates
    return {
      shouldKeep: 'existing',
      reason: 'Both versions have the same number of instruments, keeping existing'
    };
  }
}

/**
 * Processes a song for deduplication
 * Returns the song to save (if any) and information about duplicates found
 */
export async function processSongForDeduplication(
  song: ProviderMusic,
  source: string
): Promise<{
  songToSave: ProviderMusic | null;
  duplicateInfo: {
    found: boolean;
    existingSong?: IMusic;
    decision?: 'existing' | 'new';
    reason?: string;
  };
}> {
  // Find existing songs with same artist and name across all sources
  const existingSongs = await findExistingSongs(song.artist, song.name);
  
  if (existingSongs.length === 0) {
    // No duplicates found, save the new song
    return {
      songToSave: song,
      duplicateInfo: { found: false }
    };
  }
  
  // Find the best existing version (most instruments)
  let bestExistingSong = existingSongs[0];
  let bestInstrumentCount = countInstruments(bestExistingSong.instruments);
  
  for (const existingSong of existingSongs.slice(1)) {
    const instrumentCount = countInstruments(existingSong.instruments);
    if (instrumentCount > bestInstrumentCount) {
      bestExistingSong = existingSong;
      bestInstrumentCount = instrumentCount;
    }
  }
  
  // Compare new song with best existing version
  const comparison = selectBestSongVersion(bestExistingSong, song);
  
  if (comparison.shouldKeep === 'new') {
    // New song is better, save it with its source
    // Note: We keep the existing song from other source for now
    // In the future, we might want to update the existing song or mark it as inferior
    return {
      songToSave: song,
      duplicateInfo: {
        found: true,
        existingSong: bestExistingSong,
        decision: 'new',
        reason: `${comparison.reason} (from source '${bestExistingSong.source}')`
      }
    };
  } else {
    // Existing song is better or equal, don't save new one
    return {
      songToSave: null,
      duplicateInfo: {
        found: true,
        existingSong: bestExistingSong,
        decision: 'existing',
        reason: `${comparison.reason} (from source '${bestExistingSong.source}')`
      }
    };
  }
}

/**
 * Processes multiple songs for deduplication in batch
 * Returns songs to save and information about duplicates found
 */
export async function processSongsForDeduplication(
  songs: ProviderMusic[],
  source: string
): Promise<{
  songsToSave: ProviderMusic[];
  duplicateInfo: Array<{
    song: ProviderMusic;
    found: boolean;
    existingSong?: IMusic;
    decision?: 'existing' | 'new';
    reason?: string;
  }>;
}> {
  const results = await Promise.all(
    songs.map(song => processSongForDeduplication(song, source))
  );
  
  const songsToSave = results
    .filter(result => result.songToSave !== null)
    .map(result => result.songToSave!);
  
  const duplicateInfo = results.map((result, index) => ({
    song: songs[index],
    ...result.duplicateInfo
  }));
  
  return {
    songsToSave,
    duplicateInfo
  };
}
