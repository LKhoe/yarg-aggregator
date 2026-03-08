import {
  type ExtractFilesResult,
  FileType,
  NamingStyle,
  SpaceHandling,
  OutputLayout,
} from "./types";
import { extractFiles } from "./extraction/file-extractor";

export default async function batchExtract(
  input:
    | { fileName: string; data: Uint8Array }
    | Array<{ fileName: string; data: Uint8Array }>,
  onProgress?: (message: string, value: number) => void,
): Promise<ExtractFilesResult> {
  return extractFiles(input, {
    fileTypes: [
      FileType.DTA,
      FileType.MIDI,
      FileType.MOGG,
      FileType.PNG,
      FileType.MILO,
    ],
    namingStyle: NamingStyle.ArtistSong, // "Artist - Song"
    spaceHandling: SpaceHandling.Keep, // keep spaces in filenames
    outputLayout: OutputLayout.Flat, // All files in a flat directory
    decryptMogg: true, // decrypt MOGG after extracting
    onProgress,
  });
}
