import { getDTAEntries } from "./dta-tokenizer";
import { createDefaultSongData, type SongData } from "../types";

/**
 * Parse DTA bytes into an array of SongData objects.
 * Port of DTAParser.ReadDTA() from DTAParser.cs:583.
 */
export function parseDTA(dtaBytes: Uint8Array): SongData[] {
  const entries = getDTAEntries(dtaBytes);
  const songs: SongData[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const song = createDefaultSongData();
    song.dtaLines = entry;
    song.dtaIndex = i;

    let didDrums = false,
      didBass = false,
      didGuitar = false;
    let didKeys = false,
      didVocals = false,
      didCrowd = false;
    let didPans = false,
      didVols = false,
      didCores = false;
    let open = 0;
    let isDLC = false,
      isRB1 = false;

    for (let z = 0; z < entry.length; z++) {
      try {
        let line = entry[z];
        if (line.trim().startsWith(";;")) continue;
        if (!line.trim()) continue;

        const inQuotes = line.trimStart().startsWith('"');
        if (!inQuotes && line.includes("(")) open++;

        // SHORT NAME
        if (open === 1 && line.trim().startsWith("(") && !line.includes(")")) {
          song.shortName =
            line.trim() === "("
              ? (entry[z + 1]?.replace(/'/g, "").trim() ?? "")
              : line.replace("(", "").replace(/'/g, "").trim();
        }

        // SONG NAME
        if (line.includes("(name") && !line.includes("songs/")) {
          if (!line.includes(")")) {
            z++;
            line = entry[z];
          }
          song.name = extractQuoted(line);
        } else if (line.includes("'name'") && !line.includes("songs/")) {
          z++;
          line = entry[z];
          if (!line.includes("songs/")) {
            song.name = extractQuoted(line);
          } else if (!line.includes("_short")) {
            song.filePath = getSongPath(line);
            song.internalName = getInternalName(line);
          }
        }

        // FILE PATH & INTERNAL NAME
        else if (line.includes("songs/") && !line.includes("_short")) {
          song.filePath = getSongPath(line);
          song.internalName = getInternalName(line);
        } else if (line.includes("midi_file") && !line.includes("_short")) {
          song.midiFile = line
            .replace("midi_file", "")
            .replace(/[()\"]/g, "")
            .trim();
        }

        // ARTIST
        else if (line.includes("(artist")) {
          if (!line.includes(")")) {
            z++;
            line = entry[z];
          }
          song.artist = extractQuoted(line);
        } else if (line.includes("'artist'")) {
          z++;
          line = entry[z];
          song.artist = extractQuoted(line);
        }

        // MASTER FLAG
        else if (line.includes("(master") || line.includes("('master")) {
          song.master =
            line.includes("1") || line.toLowerCase().includes("true");
        }

        // TRACKS (channels for each instrument)
        else if (line.includes("(tracks")) {
          while (
            line != null &&
            line.trim() !== ")" &&
            !line.trim().includes(")))")
          ) {
            const ll = line.toLowerCase();
            if (ll.includes("bass") && !didBass) {
              if (!line.includes(")")) {
                z++;
                line = entry[z];
              }
              song.channelsBass = getChannels(line, "bass");
              song.channelsBassStart = getChannelsStart(line, "bass");
              didBass = true;
              if (line.includes(")))")) break;
            } else if (ll.includes("guitar") && !didGuitar) {
              if (!line.includes(")")) {
                z++;
                line = entry[z];
              }
              song.channelsGuitar = getChannels(line, "guitar");
              song.channelsGuitarStart = getChannelsStart(line, "guitar");
              didGuitar = true;
              if (line.includes(")))")) break;
            } else if (ll.includes("keys") && !didKeys) {
              if (!line.includes(")")) {
                z++;
                line = entry[z];
              }
              song.channelsKeys = getChannels(line, "keys");
              song.channelsKeysStart = getChannelsStart(line, "keys");
              didKeys = true;
              if (line.includes(")))")) break;
            } else if (ll.includes("vocals") && !didVocals) {
              if (!line.includes(")")) {
                z++;
                line = entry[z];
              }
              song.channelsVocals = getChannels(line, "vocals");
              song.channelsVocalsStart = getChannelsStart(line, "vocals");
              didVocals = true;
              if (line.includes(")))")) break;
            } else if (ll.includes("drum") && !didDrums) {
              if (!line.includes(")")) {
                z++;
                line = entry[z];
              }
              song.channelsDrums = getChannels(line, "drum");
              song.channelsDrumsStart = getChannelsStart(line, "drum");
              didDrums = true;
              if (line.includes(")))")) break;
            } else if (line.includes("crowd_channels") && !didCrowd) {
              song.channelsCrowd = getChannels(line, "crowd_channels");
              song.channelsCrowdStart = getChannelsStart(
                line,
                "crowd_channels",
              );
              didCrowd = true;
            }
            z++;
            line = entry[z];
          }
        }

        // SONG_ID
        else if (line.includes("song_id") && !line.trim().startsWith(";")) {
          const idStr = extractSongID(line);
          song.songIdString = idStr;
          song.hasSongIDError = !idStr;
          const parsed = parseInt(idStr, 10);
          song.songId = isNaN(parsed) ? 99999999 : parsed;
        }

        // VOCAL PARTS
        else if (line.includes("vocal_parts")) {
          const m = line.match(/\d+/);
          song.vocalParts = m ? parseInt(m[0], 10) : 0;
        }

        // VOLS (attenuation values)
        else if (line.includes("'vols'") && !didVols) {
          z++;
          line = entry[z];
          song.attenuationValues = cleanValuesLine(line);
          song.originalAttenuationValues = song.attenuationValues;
          didVols = true;
        } else if (line.includes("(vols") && !didVols) {
          if (!line.includes(")")) {
            z++;
            line = entry[z];
          }
          song.attenuationValues = cleanValuesLine(line);
          song.originalAttenuationValues = song.attenuationValues;
          didVols = true;
        }

        // PANS
        else if (line.includes("'pans'") && !didPans) {
          z++;
          line = entry[z];
          song.panningValues = cleanValuesLine(line);
          didPans = true;
        } else if (line.includes("(pans") && !didPans) {
          if (!line.includes(")")) {
            z++;
            line = entry[z];
          }
          song.panningValues = cleanValuesLine(line);
          didPans = true;
        }

        // CORES (total channels)
        else if (line.includes("(cores") && !didCores) {
          if (!line.includes(")")) {
            z++;
            line = entry[z];
          }
          song.channelsTotal = getAudioChannels(line);
          didCores = true;
        } else if (line.includes("'cores'") && !didCores) {
          z++;
          line = entry[z];
          song.channelsTotal = getAudioChannels(line);
          didCores = true;
        }

        // HOPO THRESHOLD
        else if (line.includes("hopo_threshold")) {
          const m = line.match(/\d+/);
          song.hopoThreshold = m ? parseInt(m[0], 10) : 0;
        }

        // BANK / DRUM_BANK
        else if (line.includes("bank sfx") && !line.includes("drum_bank")) {
          song.percussionBank = line
            .replace("(bank", "")
            .replace(/[()]/g, "")
            .trim();
        } else if (line.includes("'bank'")) {
          z++;
          line = entry[z];
          song.percussionBank = line.replace(/"/g, "").trim();
        } else if (line.includes("drum_bank")) {
          song.drumBank = getDTAStringValue(line, "drum_bank");
        }

        // SCROLL SPEED
        else if (line.includes("song_scroll_speed")) {
          const m = line.match(/\d+/);
          song.scrollSpeed = m ? parseInt(m[0], 10) : 2300;
        }

        // PREVIEW TIMES
        else if (
          (line.includes("(preview") || line.includes("('preview")) &&
          !line.trim().startsWith(";")
        ) {
          const nums = line.match(/-?\d+/g);
          if (nums && nums.length >= 2) {
            song.previewStart = parseInt(nums[0], 10);
            song.previewEnd = parseInt(nums[1], 10);
          }
        }

        // SONG LENGTH
        else if (line.includes("song_length")) {
          const m = line.match(/\d+/);
          song.length = m ? parseInt(m[0], 10) : 0;
        }

        // DIFFICULTY LEVELS
        else if (
          (line.includes("('drum'") || line.includes("(drum ")) &&
          !line.includes("solo")
        ) {
          song.drumsDiff = extractDiff(line);
        } else if (
          (line.includes("('guitar'") || line.includes("(guitar ")) &&
          !line.includes("solo")
        ) {
          song.guitarDiff = extractDiff(line);
        } else if (
          (line.includes("('bass'") || line.includes("(bass ")) &&
          !line.includes("solo")
        ) {
          song.bassDiff = extractDiff(line);
        } else if (
          (line.includes("('vocals'") || line.includes("(vocals ")) &&
          !line.includes("solo")
        ) {
          song.vocalsDiff = extractDiff(line);
        } else if (
          (line.includes("('keys'") || line.includes("(keys ")) &&
          !line.includes("solo")
        ) {
          song.keysDiff = extractDiff(line);
        } else if (line.includes("real_keys")) {
          song.proKeysDiff = extractDiff(line);
        } else if (line.includes("real_guitar") && !line.includes("tuning")) {
          song.proGuitarDiff = extractDiff(line);
        } else if (line.includes("real_bass") && !line.includes("tuning")) {
          song.proBassDiff = extractDiff(line);
        } else if (line.includes("('band'") || line.includes("(band ")) {
          song.bandDiff = extractDiff(line);
        }

        // GAME VERSION
        else if (
          line.includes("version") &&
          !line.includes("short") &&
          !line.includes("fake")
        ) {
          const m = line.match(/\d+/);
          song.gameVersion = m ? parseInt(m[0], 10) : -1;
        }

        // SOURCE GAME
        else if (line.toLowerCase().includes("game_origin")) {
          song.source = getDTAStringValue(line, "game_origin");
        }

        // SOLOS
        else if (line.toLowerCase().includes("(solo (")) {
          song.instrumentSolos = line.replace(/solo/g, "").replace(/[()]/g, "");
        }

        // ENCODING
        else if (line.toLowerCase().includes("encoding")) {
          song.encoding = line
            .toLowerCase()
            .replace("encoding", "")
            .replace(/[()]/g, "");
        }

        // RATING
        else if (line.toLowerCase().includes("rating")) {
          const m = line.match(/\d+/);
          song.rating = m ? parseInt(m[0], 10) : 4;
        }

        // GENRE & SUBGENRE
        else if (line.includes("genre") && !line.includes("subgenre")) {
          song.rawGenre = getDTAStringValue(line, "genre");
          song.genre = prettifyGenre(song.rawGenre);
        } else if (line.toLowerCase().includes("subgenre_")) {
          song.rawSubGenre = getDTAStringValue(line, "sub_genre");
          song.subGenre = prettifyGenre(song.rawSubGenre);
        }

        // GENDER
        else if (line.toLowerCase().includes("gender")) {
          song.gender = line.toLowerCase().includes("female")
            ? "Female"
            : "Male";
        }

        // YEAR
        else if (
          line.includes("(year_released") ||
          line.includes("('year_released")
        ) {
          const m = line.match(/\d+/);
          song.yearReleased = m ? parseInt(m[0], 10) : 0;
        } else if (
          line.includes("(year_recorded") ||
          line.includes("('year_recorded")
        ) {
          const m = line.match(/\d+/);
          song.yearRecorded = m ? parseInt(m[0], 10) : 0;
        }

        // CHART AUTHOR
        else if (line.includes("(author") || line.includes("'author")) {
          song.chartAuthor = line
            .replace("(author", "")
            .replace("'author", "")
            .replace(/["'()]/g, "")
            .trim();
        }

        // ALBUM
        else if (line.includes("(album_name")) {
          if (!line.includes(")")) {
            z++;
            line = entry[z];
          }
          song.album = extractQuoted(line);
        } else if (line.includes("'album_name'")) {
          z++;
          line = entry[z];
          song.album = extractQuoted(line);
        }

        // TRACK NUMBER
        else if (line.toLowerCase().includes("track_number")) {
          const m = line.match(/\d+/);
          song.trackNumber = m ? parseInt(m[0], 10) : 1;
        }

        // RB1 EXPORTED FLAG
        else if (line.trim().includes("(exported TRUE)")) {
          isRB1 = true;
          song.source = "rb1";
        }

        // VOCAL TONIC NOTE
        else if (line.includes("vocal_tonic_note")) {
          const m = line.match(/\d+/);
          song.tonicNote = m ? parseInt(m[0], 10) : 0;
        }

        // TONALITY
        else if (line.includes("song_tonality")) {
          const m = line.match(/\d+/);
          song.tonality = m ? parseInt(m[0], 10) : 0;
        }

        // TUNING
        else if (line.includes("tuning_offset")) {
          const m = line.match(/\d+/);
          song.tuningCents = m ? parseInt(m[0], 10) : 0;
        } else if (line.includes("guitar_tuning")) {
          song.proGuitarTuning = extractTuning(line);
        } else if (line.includes("bass_tuning")) {
          song.proBassTuning = extractTuning(line);
        }

        // DLC FLAG
        else if (
          line.toLowerCase().includes("downloaded") &&
          line.toLowerCase().includes("true")
        ) {
          isDLC = true;
        }

        // C3/MAGMA EXTENDED INFO (comment-based metadata)
        else if (line.includes(";Song authored by ")) {
          song.chartAuthor = line.replace(";Song authored by ", "").trim();
        } else if (line.includes(";DisableProKeys=1")) {
          song.disableProKeys = true;
        } else if (line.includes(";RhythmBass=1")) {
          song.rhythmBass = true;
        } else if (line.includes(";RhythmKeys=1") && !song.rhythmBass) {
          song.rhythmKeys = true;
        } else if (line.includes(";2xBass=1")) {
          song.doubleBass = true;
        } else if (line.includes(";Karaoke=1")) {
          song.karaoke = true;
        } else if (line.includes(";Multitrack=1")) {
          song.multitrack = true;
        } else if (line.includes(";DIYStems=1")) {
          song.diyStems = true;
        } else if (line.includes(";PartialMultitrack=1")) {
          song.partialMultitrack = true;
        } else if (line.includes(";UnpitchedVocals=1")) {
          song.unpitchedVocals = true;
        } else if (line.includes(";Convert=1")) {
          song.convert = true;
        } else if (line.includes(";RB3Version=1")) {
          song.rb3Version = true;
        } else if (line.includes(";CATemh=1")) {
          song.catemh = true;
        } else if (line.includes(";ExpertOnly=1")) {
          song.expertOnly = true;
        } else if (line.includes(";OriginalAttenuationValues=")) {
          song.originalAttenuationValues = line.replace(
            ";OriginalAttenuationValues=",
            "",
          );
        }
      } catch {
        // Continue parsing even if one line fails
      }
    }

    // Defaults
    if (song.vocalsDiff > 0 && song.vocalParts === 0) song.vocalParts = 1;
    if (!song.source) song.source = "rb1_dlc";

    if (!song.chartAuthor.trim() && song.songIdString.length === 7) {
      const prefix = song.songIdString.substring(0, 2);
      if (prefix === "10") song.chartAuthor = "Harmonix";
      else if (prefix === "50") song.chartAuthor = "Rock Band Network";
    }

    if (!song.songIdString) song.songIdString = String(song.songId);

    if (isDLC && !isRB1) {
      if (song.source === "" || song.source === "rb1") song.source = "rb1_dlc";
      else if (song.source === "rb2") song.source = "rb2_dlc";
    }

    songs.push(song);
  }

  return songs;
}

// ── Helper Functions ──

function extractQuoted(line: string): string {
  const match = line.match(/"([^"]*)"/);
  if (match) return match[1];
  return line.replace(/[()'"]/g, "").trim();
}

function getSongPath(line: string): string {
  const match = line.match(/(songs\/[^\s"')]+)/);
  return match ? match[1] : "";
}

function getInternalName(line: string): string {
  const match = line.match(/songs\/([^/\s"')]+)/);
  return match ? match[1] : "";
}

function extractSongID(line: string): string {
  const cleaned = line
    .replace("song_id", "")
    .replace(/[()'"]/g, "")
    .trim();
  return cleaned;
}

function extractDiff(line: string): number {
  console.log(line);
  const m = line.match(/\d+/);
  console.log(m);
  if (m) {
    console.log(m[0]);
  }
  return m ? parseInt(m[0], 10) : 0;
}

function getDTAStringValue(line: string, key: string): string {
  return line
    .replace(key, "")
    .replace(/[()'"]/g, "")
    .trim();
}

function getAudioChannels(line: string): number {
  const cleaned = line
    .replace(/[()'"]/g, "")
    .replace("cores", "")
    .replace(/\t/g, " ")
    .trim();
  return cleaned.split(/\s+/).filter((s) => s).length;
}

function getChannels(line: string, instrument: string): number {
  if (line.includes("()")) return 0;
  if (line.includes(";")) return 0;
  const cleaned = cleanChannelsLine(line, instrument);
  const parts = cleaned.split(/\s+/).filter((s) => s);
  return parts.length;
}

function getChannelsStart(line: string, instrument: string): number {
  if (line.includes("()")) return 0;
  if (line.includes(";")) return 0;
  const cleaned = cleanChannelsLine(line, instrument);
  const parts = cleaned.split(/\s+/).filter((s) => s);
  return parts.length > 0 ? parseInt(parts[0], 10) || 0 : 0;
}

function cleanChannelsLine(line: string, instrument: string): string {
  return line
    .replace(new RegExp(instrument, "gi"), "")
    .replace(/[()'"]/g, "")
    .replace(/\t/g, " ")
    .trim();
}

function cleanValuesLine(line: string): string {
  let cleaned = line
    .replace(/[()'"]/g, "")
    .replace("vols", "")
    .replace("pans", "")
    .replace(/\t/g, " ")
    .trim();
  // Remove inline DTA comments
  const commentIdx = cleaned.indexOf(";;");
  if (commentIdx >= 0) cleaned = cleaned.substring(0, commentIdx).trim();
  return cleaned;
}

function extractTuning(line: string): string {
  const match = line.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : "";
}

function prettifyGenre(raw: string): string {
  // Basic prettification: remove underscores, title case
  return (
    raw
      .replace(
        /^(rock|pop|metal|country|classical|jazz|blues|punk|alternative|indie|electronic|hip_hop|r_and_b|reggae|latin|world|other|new_wave|grunge|southern_rock|funk|prog)_?/i,
        "",
      )
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || raw
  );
}
