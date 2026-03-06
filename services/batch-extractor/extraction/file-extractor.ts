import { downloadZip } from "client-zip";
import { STFSPackage } from "../stfs/stfs-package";
import { parseDTA } from "../dta/dta-parser";
import { arrangeName } from "./naming";
import { getOutputDir } from "./output-organizer";
import { cleanString } from "../utils/clean-string";
import { decryptMogg } from "../mogg/mogg-decryptor";
import {
  FileType,
  NamingStyle,
  SpaceHandling,
  OutputLayout,
  type ExtractionOptions,
  type ExtractionResult,
  type ZipExtractionResult,
  type SongData,
  type ExtractFilesResult,
} from "../types";

const DEFAULT_OPTIONS: ExtractionOptions = {
  fileTypes: [
    FileType.DTA,
    FileType.MIDI,
    FileType.MOGG,
    FileType.PNG,
    FileType.MILO,
  ],
  namingStyle: NamingStyle.ArtistSong,
  spaceHandling: SpaceHandling.Keep,
  outputLayout: OutputLayout.ByType,
  appendSongsToFiles: false,
  removeKeepFromPNG: false,
  decryptMogg: true,
};

/**
 * Extract a single STFS package into an in-memory file map.
 * Returns both the file map and extraction metadata.
 */
async function extractPackageToMap(
  input: Uint8Array,
  opts: ExtractionOptions,
): Promise<{ files: Record<string, Uint8Array>; meta: ExtractionResult }> {
  const fileMap: Record<string, Uint8Array> = {};
  const logs: string[] = [];
  const errors: string[] = [];
  const counts = { dta: 0, midi: 0, mogg: 0, png: 0, milo: 0, thumbnail: 0 };
  const allSongs: SongData[] = [];

  const log = (msg: string, value: number) => {
    logs.push(msg);
    opts.onProgress?.(msg, value);
  };

  try {
    const pkg = new STFSPackage(input);
    log("STFS package parsed", 5);

    // Extract and parse DTA
    const dtaEntry = pkg.getFile("songs/songs.dta");
    if (!dtaEntry) {
      errors.push("Could not find songs/songs.dta in package");
      return {
        files: fileMap,
        meta: makeResult(false, 0, counts, allSongs, errors, logs),
      };
    }

    const dtaBytes = pkg.extractFile(dtaEntry);
    log("DTA entry found & extracted", 10);

    const songs = parseDTA(dtaBytes);

    if (songs.length === 0) {
      errors.push("No songs found in DTA file");
      return {
        files: fileMap,
        meta: makeResult(false, 0, counts, allSongs, errors, logs),
      };
    }

    allSongs.push(...songs);

    // YARG doesn't support packs
    if (songs.length > 1 && opts.outputLayout === OutputLayout.YARG) {
      errors.push("Pack files are not supported for YARG layout");
      return {
        files: fileMap,
        meta: makeResult(false, 0, counts, allSongs, errors, logs),
      };
    }

    log(
      `Package contains ${songs.length} ${songs.length === 1 ? "song" : "songs"}`,
      15,
    );

    const n = songs.length;
    for (let i = 0; i < n; i++) {
      const song = songs[i];
      const songId = song.internalName;

      const name = cleanString(song.name, true);
      const artist = cleanString(song.artist, true);
      const cleanId = cleanString(songId, true);

      let rename = arrangeName(
        name,
        artist,
        cleanId,
        opts.namingStyle,
        opts.spaceHandling,
      )
        .replace(/!/g, "")
        .replace(/'/g, "");
      rename = cleanString(rename, false);

      // Per-song range: 15–80% (65pp total), divided evenly across n songs.
      // Within each song's range the milestones mirror the n=1 percentages.
      const songBase = 15 + (i * 65) / n;
      const pp = (pct: number) => Math.round(songBase + pct / n);

      log(
        `Extracting song ${i + 1}/${n}: '${song.artist} - ${song.name}'`,
        pp(0),
      );

      // Extract DTA
      if (opts.fileTypes.includes(FileType.DTA)) {
        if (opts.outputLayout === OutputLayout.YARG) {
          // In YARG layout: songs.dta lives at _YARG/rename/songs/songs.dta
          // (the songId subdir is created for other files, but DTA stays at the songs/ level)
          const dtaDir = getOutputDir(
            "",
            opts.outputLayout,
            FileType.DTA,
            rename,
            songId,
          );
          fileMap[`${dtaDir}/songs.dta`] = dtaBytes;
          counts.dta++;
          log(`Extracted DTA: songs.dta`, pp(5));
        }
        // Non-YARG DTA is written after the loop (full file)
      }

      // Extract MIDI
      if (opts.fileTypes.includes(FileType.MIDI)) {
        const extracted = await extractSingleFileToMap(
          pkg,
          fileMap,
          "mid",
          false,
          songId,
          rename,
          opts,
          (msg) => log(msg, pp(20)),
        );
        if (extracted) counts.midi++;
      }

      // Extract MOGG
      if (opts.fileTypes.includes(FileType.MOGG)) {
        const extracted = await extractSingleFileToMap(
          pkg,
          fileMap,
          "mogg",
          false,
          songId,
          rename,
          opts,
          (msg) => log(msg, pp(45)),
        );
        if (extracted) counts.mogg++;
      }

      // Extract PNG
      if (opts.fileTypes.includes(FileType.PNG)) {
        const extracted = await extractSingleFileToMap(
          pkg,
          fileMap,
          "png_xbox",
          true,
          songId,
          rename,
          opts,
          (msg) => log(msg, pp(55)),
          true,
        );
        if (extracted) counts.png++;
      }

      // Extract MILO
      if (opts.fileTypes.includes(FileType.MILO)) {
        const extracted = await extractSingleFileToMap(
          pkg,
          fileMap,
          "milo_xbox",
          true,
          songId,
          rename,
          opts,
          (msg) => log(msg, pp(65)),
        );
        if (extracted) counts.milo++;
      }
    }

    // Handle upgrades.dta
    if (opts.outputLayout !== OutputLayout.YARG) {
      const upgradeEntry = pkg.getFile("songs_upgrades/upgrades.dta");
      if (upgradeEntry && opts.fileTypes.includes(FileType.MIDI)) {
        try {
          const upgData = pkg.extractFile(upgradeEntry);
          const upgText = new TextDecoder("utf-8").decode(upgData);
          const lines = upgText.split(/\r?\n/);

          for (const line of lines) {
            if (line.includes("midi_file")) {
              const midiName = line
                .replace("midi_file", "")
                .replace(/[()\"'\/]/g, "")
                .replace("songs_upgrades", "")
                .trim();

              if (midiName) {
                const midiEntry = pkg.getFile(`songs_upgrades/${midiName}`);
                if (midiEntry) {
                  const midiDir = getOutputDir(
                    "",
                    opts.outputLayout,
                    FileType.MIDI,
                    "",
                    "",
                  );
                  fileMap[`${midiDir}/${midiName}`] =
                    pkg.extractFile(midiEntry);
                  counts.midi++;
                  log(`Extracted upgrade MIDI: ${midiName}`, 80);
                }
              }
            }
          }

          // Write upgrades.dta
          if (opts.fileTypes.includes(FileType.DTA)) {
            const dtaDir = getOutputDir(
              "",
              opts.outputLayout,
              FileType.DTA,
              "",
              "",
            );
            const displayName = cleanString(
              pkg.header.titles[0] || "unknown",
              false,
            )
              .replace(/!/g, "")
              .replace(/'/g, "");
            fileMap[`${dtaDir}/${displayName}_upgrade.dta`] = upgData;
            counts.dta++;
            log(`Extracted upgrades.dta`, 80);
          }
        } catch (e) {
          errors.push(`Error extracting upgrades.dta: ${e}`);
        }
      }
    }

    // Write full DTA file for non-YARG layouts
    if (
      opts.fileTypes.includes(FileType.DTA) &&
      opts.outputLayout !== OutputLayout.YARG
    ) {
      const dtaDir = getOutputDir("", opts.outputLayout, FileType.DTA, "", "");

      const displayName =
        songs.length === 1
          ? cleanString(
              arrangeName(
                cleanString(songs[0].name, true),
                cleanString(songs[0].artist, true),
                cleanString(songs[0].internalName, true),
                opts.namingStyle,
                opts.spaceHandling,
              ),
              false,
            )
              .replace(/!/g, "")
              .replace(/'/g, "")
          : cleanString(pkg.header.titles[0] || "unknown", false)
              .replace(/!/g, "")
              .replace(/'/g, "");

      const suffix = opts.appendSongsToFiles ? "_songs" : "";
      const dtaPath = `${dtaDir}/${displayName}${suffix}.dta`;
      fileMap[dtaPath] = dtaBytes;
      counts.dta++;
      log(`Extracted DTA: ${displayName}${suffix}.dta`, 80);
    }

    // Extract thumbnails
    if (opts.fileTypes.includes(FileType.Thumbnail)) {
      const thumbDir = getOutputDir(
        "",
        opts.outputLayout,
        FileType.Thumbnail,
        "",
        "",
      );
      const displayName = cleanString(pkg.header.titles[0] || "unknown", false)
        .replace(/!/g, "")
        .replace(/'/g, "");

      if (pkg.header.contentImageBinary.length > 0) {
        fileMap[`${thumbDir}/${displayName} Content.png`] =
          pkg.header.contentImageBinary;
        counts.thumbnail++;
      }
      if (pkg.header.packageImageBinary.length > 0) {
        fileMap[`${thumbDir}/${displayName} Package.png`] =
          pkg.header.packageImageBinary;
        counts.thumbnail++;
      }
      if (counts.thumbnail > 0) log("Extracted thumbnails", 80);
    }

    const total =
      counts.dta +
      counts.midi +
      counts.mogg +
      counts.png +
      counts.milo +
      counts.thumbnail;
    return {
      files: fileMap,
      meta: makeResult(total > 0, songs.length, counts, allSongs, errors, logs),
    };
  } catch (e) {
    errors.push(`Error processing package: ${e}`);
    return {
      files: fileMap,
      meta: makeResult(false, 0, counts, allSongs, errors, logs),
    };
  }
}

async function extractSingleFileToMap(
  pkg: STFSPackage,
  fileMap: Record<string, Uint8Array>,
  extension: string,
  sublevel: boolean,
  internalName: string,
  rename: string,
  opts: ExtractionOptions,
  log: (msg: string) => void,
  keep: boolean = false,
): Promise<boolean> {
  const dir = `songs/${internalName}${sublevel ? "/gen/" : "/"}${internalName}`;
  const filePath = `${dir}${keep ? "_keep" : ""}.${extension}`;

  const entry = pkg.getFile(filePath);
  if (!entry) {
    log(`Could not find ${extension.toUpperCase()} file: ${filePath}`);
    return false;
  }

  try {
    const fileType = extensionToFileType(extension);

    if (opts.outputLayout === OutputLayout.YARG) {
      const outDir = getOutputDir(
        "",
        opts.outputLayout,
        fileType,
        rename,
        internalName,
      );
      const songDir = sublevel
        ? `${outDir}/${internalName}/gen`
        : `${outDir}/${internalName}`;
      const suffix = keep ? "_keep" : "";
      const outPath = `${songDir}/${internalName}${suffix}.${extension}`;

      let data = pkg.extractFile(entry);
      if (extension === "mogg" && opts.decryptMogg) {
        const decrypted = await decryptMogg(data, opts.moggDecryptCallback);
        if (decrypted) data = decrypted;
      }

      fileMap[outPath] = data;
      log(
        `Extracted ${extension.toUpperCase()}: ${internalName}${suffix}.${extension}`,
      );
    } else {
      const outDir = getOutputDir(
        "",
        opts.outputLayout,
        fileType,
        rename,
        internalName,
      );
      const suffix = keep && !opts.removeKeepFromPNG ? "_keep" : "";
      const outPath = `${outDir}/${rename}${suffix}.${extension}`;

      let data = pkg.extractFile(entry);
      if (extension === "mogg" && opts.decryptMogg) {
        const decrypted = await decryptMogg(data, opts.moggDecryptCallback);
        if (decrypted) data = decrypted;
      }

      fileMap[outPath] = data;
      log(
        `Extracted ${extension.toUpperCase()}: ${rename}${suffix}.${extension}`,
      );
    }

    return true;
  } catch (e) {
    log(`Error extracting ${extension}: ${e}`);
    return false;
  }
}

function extensionToFileType(ext: string): FileType {
  switch (ext) {
    case "dta":
      return FileType.DTA;
    case "mid":
      return FileType.MIDI;
    case "mogg":
      return FileType.MOGG;
    case "png_xbox":
      return FileType.PNG;
    case "milo_xbox":
      return FileType.MILO;
    default:
      return FileType.DTA;
  }
}

/**
 * Convert a raw DTA rank value to a 0–7 difficulty tier for display.
 * 0 = not charted. 1–6 = standard tiers. 7 = Impossible (shown in hard colour).
 * Thresholds are per-instrument as documented by the Rock Band Customs Project.
 * Keys thresholds are undocumented; guitar thresholds are used as an approximation.
 */
const RANK_THRESHOLDS: Record<string, number[]> = {
  //              [T1,  T2,  T3,  T4,  T5,  T6,  T7]
  drums:   [  1, 133, 169, 208, 294, 349, 401],
  guitar:  [  1, 145, 194, 247, 301, 354, 406],
  bass:    [  1, 166, 220, 259, 298, 349, 401],
  vocals:  [  1, 139, 180, 220, 259, 298, 373],
  keys:    [  1, 145, 194, 247, 301, 354, 406], // same as guitar (undocumented)
};

function rankToTier(rank: number, instrument: string): number {
  if (rank <= 0) return 0;
  const thresholds = RANK_THRESHOLDS[instrument] ?? RANK_THRESHOLDS.guitar;
  let tier = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (rank >= thresholds[i]) tier = i + 1;
  }
  return tier;
}

function makeResult(
  success: boolean,
  songsExtracted: number,
  counts: {
    dta: number;
    midi: number;
    mogg: number;
    png: number;
    milo: number;
    thumbnail: number;
  },
  songs: SongData[],
  errors: string[],
  logs: string[],
): ExtractionResult {
  return {
    success,
    songsExtracted,
    filesExtracted: counts,
    songs,
    errors,
    logs,
  };
}

/**
 * Extract one or more STFS packages into a ZIP archive.
 *
 * Browser usage:
 *   const result = await extractToZip(new Uint8Array(await file.arrayBuffer()), { ... });
 *   // result.zip is the ZIP bytes; result.songs has metadata
 *
 * Node.js usage:
 *   import { readFileSync } from 'node:fs';
 *   const result = await extractToZip(readFileSync('./song.con'), { ... });
 */
export async function extractToZip(
  input: Uint8Array | Uint8Array[],
  options?: Partial<ExtractionOptions>,
): Promise<ZipExtractionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const inputs = Array.isArray(input) ? input : [input];

  const allFiles: Record<string, Uint8Array> = {};
  const allSongs: SongData[] = [];
  const allErrors: string[] = [];
  const allLogs: string[] = [];
  const totalCounts = {
    dta: 0,
    midi: 0,
    mogg: 0,
    png: 0,
    milo: 0,
    thumbnail: 0,
  };
  let anySuccess = false;

  for (const pkg of inputs) {
    const { files, meta } = await extractPackageToMap(pkg, opts);
    Object.assign(allFiles, files);
    allSongs.push(...meta.songs);
    allErrors.push(...meta.errors);
    allLogs.push(...meta.logs);
    if (meta.success) anySuccess = true;
    totalCounts.dta += meta.filesExtracted.dta;
    totalCounts.midi += meta.filesExtracted.midi;
    totalCounts.mogg += meta.filesExtracted.mogg;
    totalCounts.png += meta.filesExtracted.png;
    totalCounts.milo += meta.filesExtracted.milo;
    totalCounts.thumbnail += meta.filesExtracted.thumbnail;
  }

  // Build ZIP
  opts.onProgress?.("Building ZIP", 85);
  let zipData: Uint8Array;
  if (Object.keys(allFiles).length > 0) {
    const entries = Object.entries(allFiles).map(([name, input]) => ({
      name,
      input,
    }));
    const blob = await downloadZip(entries).blob();
    zipData = new Uint8Array(await blob.arrayBuffer());
  } else {
    zipData = new Uint8Array(0);
  }
  opts.onProgress?.("ZIP built", 95);

  return {
    success: anySuccess,
    songsExtracted: allSongs.length,
    filesExtracted: totalCounts,
    songs: allSongs,
    errors: allErrors,
    logs: allLogs,
    zip: zipData,
  };
}

/**
 * Extract one or more named STFS package files into a ZIP archive.
 * Returns per-song success entries and per-file error entries.
 *
 * Usage:
 *   const result = await extractFiles([
 *     { fileName: 'song1.con', data: new Uint8Array(await file.arrayBuffer()) },
 *     { fileName: 'song2.con', data: new Uint8Array(await file2.arrayBuffer()) },
 *   ]);
 *   result.zipFile  // Uint8Array ZIP of all extracted files
 *   result.success  // [{ file_name, song_name, artist_name, guitar_diff, ... }]
 *   result.error    // [{ file_name, log }]
 */
export async function extractFiles(
  input:
    | { fileName: string; data: Uint8Array }
    | Array<{ fileName: string; data: Uint8Array }>,
  options?: Partial<ExtractionOptions>,
): Promise<ExtractFilesResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const inputs = Array.isArray(input) ? input : [input];

  const allFileMap: Record<string, Uint8Array> = {};
  const success: ExtractFilesResult["success"] = [];
  const error: ExtractFilesResult["error"] = [];

  for (const { fileName, data } of inputs) {
    const { files, meta } = await extractPackageToMap(data, opts);

    if (meta.songs.length > 0) {
      // At least the DTA was parsed — record per-song success entries
      Object.assign(allFileMap, files);
      for (const song of meta.songs) {
        success.push({
          file_name: fileName,
          song_name: song.name,
          artist_name: song.artist,
          guitar_diff: rankToTier(song.guitarDiff, "guitar"),
          bass_diff: rankToTier(song.bassDiff, "bass"),
          drums_diff: rankToTier(song.drumsDiff, "drums"),
          keys_diff: rankToTier(song.keysDiff, "keys"),
          vocals_diff: rankToTier(song.vocalsDiff, "vocals"),
        });
      }
    }

    if (meta.errors.length > 0) {
      error.push({ file_name: fileName, log: meta.errors.join("; ") });
    }
  }

  opts.onProgress?.("Building ZIP", 85);
  let zipFile: Uint8Array;
  if (Object.keys(allFileMap).length > 0) {
    const entries = Object.entries(allFileMap).map(([name, input]) => ({
      name,
      input,
    }));
    const blob = await downloadZip(entries).blob();
    zipFile = new Uint8Array(await blob.arrayBuffer());
  } else {
    zipFile = new Uint8Array(0);
  }
  opts.onProgress?.("ZIP built", 95);

  return { zipFile, success, error };
}
