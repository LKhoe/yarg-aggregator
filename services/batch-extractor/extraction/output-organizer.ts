import { OutputLayout, FileType } from "../types";

function joinPath(...parts: string[]): string {
  return parts.filter((p) => p !== "").join("/");
}

/**
 * Determine the output directory path for a given file type and layout.
 * Port of directory organization from BatchExtractor.cs.
 */
export function getOutputDir(
  baseDir: string,
  layout: OutputLayout,
  fileType: FileType,
  rename: string,
  internalName: string,
): string {
  switch (layout) {
    case OutputLayout.ByType: {
      const subdir = getTypeSubdir(fileType);
      return joinPath(baseDir, subdir);
    }

    case OutputLayout.YARG:
      return joinPath(baseDir, "_YARG", rename, "songs");

    case OutputLayout.Flat:
    default:
      return baseDir;
  }
}

/**
 * Get the full output file path (virtual ZIP entry name).
 */
export function getOutputPath(
  baseDir: string,
  layout: OutputLayout,
  fileType: FileType,
  rename: string,
  internalName: string,
  extension: string,
  keepSuffix: boolean,
  removeKeep: boolean,
): string {
  const dir = getOutputDir(baseDir, layout, fileType, rename, internalName);

  if (layout === OutputLayout.YARG) {
    const isSubLevel = fileType === FileType.PNG || fileType === FileType.MILO;
    const subDir = isSubLevel
      ? joinPath(dir, internalName, "gen")
      : joinPath(dir, internalName);
    const suffix = keepSuffix ? "_keep" : "";
    return joinPath(subDir, `${internalName}${suffix}.${extension}`);
  }

  const suffix = keepSuffix && !removeKeep ? "_keep" : "";
  return joinPath(dir, `${rename}${suffix}.${extension}`);
}

function getTypeSubdir(fileType: FileType): string {
  switch (fileType) {
    case FileType.DTA:
      return "dta_files";
    case FileType.MIDI:
      return "midi_files";
    case FileType.MOGG:
      return "mogg_files";
    case FileType.PNG:
      return "png_xbox_files";
    case FileType.MILO:
      return "milo_xbox_files";
    case FileType.Thumbnail:
      return "thumbnails";
    default:
      return "";
  }
}
