import type { SongEntry } from "@/services/cache-reader/Song/Entries/SongEntry";

// =============================================================================
// Serialization helpers for API transport (client-safe, no DB dependencies)
// =============================================================================

export interface SerializedSongEntry {
  metadata: {
    Name: string;
    Artist: string;
    Album: string;
    Genre: string;
    Year: string;
    Charter: string;
  };
  parts: {
    FiveFretGuitar: { Intensity: number };
    FiveFretBass: { Intensity: number };
    SixFretGuitar: { Intensity: number };
    SixFretBass: { Intensity: number };
    FourLaneDrums: { Intensity: number };
    FiveLaneDrums: { Intensity: number };
    ProDrums: { Intensity: number };
    Keys: { Intensity: number };
    ProKeys: { Intensity: number };
    LeadVocals: { Intensity: number };
    HarmonyVocals: { Intensity: number };
  };
}

/**
 * Serializes a SongEntry for API transport (removes non-serializable fields)
 */
export function serializeSongEntry(entry: SongEntry): SerializedSongEntry {
  return {
    metadata: {
      Name: entry._metadata.Name,
      Artist: entry._metadata.Artist,
      Album: entry._metadata.Album,
      Genre: entry._metadata.Genre,
      Year: entry._metadata.Year,
      Charter: entry._metadata.Charter,
    },
    parts: {
      FiveFretGuitar: { Intensity: entry._parts.FiveFretGuitar.Intensity },
      FiveFretBass: { Intensity: entry._parts.FiveFretBass.Intensity },
      SixFretGuitar: { Intensity: entry._parts.SixFretGuitar.Intensity },
      SixFretBass: { Intensity: entry._parts.SixFretBass.Intensity },
      FourLaneDrums: { Intensity: entry._parts.FourLaneDrums.Intensity },
      FiveLaneDrums: { Intensity: entry._parts.FiveLaneDrums.Intensity },
      ProDrums: { Intensity: entry._parts.ProDrums.Intensity },
      Keys: { Intensity: entry._parts.Keys.Intensity },
      ProKeys: { Intensity: entry._parts.ProKeys.Intensity },
      LeadVocals: { Intensity: entry._parts.LeadVocals.Intensity },
      HarmonyVocals: { Intensity: entry._parts.HarmonyVocals.Intensity },
    },
  };
}
