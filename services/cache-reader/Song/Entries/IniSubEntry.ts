import { FixedArrayStream } from "../../IO/FixedArray";
import { CacheReadStrings } from "../Cache/CacheReadStrings";
import { SongEntry } from "./SongEntry";

// Matches ChartFormat in YARG.Core; the cache stores it as a byte index into CHART_FILE_TYPES
export enum ChartFormat {
  Mid = 0,
  Midi = 1,
  Chart = 2,
  UltraStar = 3,
}

export const CHART_FILE_TYPES: { Filename: string; Format: ChartFormat }[] = [
  { Filename: "notes.mid", Format: ChartFormat.Mid },
  { Filename: "notes.midi", Format: ChartFormat.Midi },
  { Filename: "notes.chart", Format: ChartFormat.Chart },
  { Filename: "notes.txt", Format: ChartFormat.UltraStar },
];

export function chartFormatFromIndex(index: number): ChartFormat {
  const chart = CHART_FILE_TYPES[index];
  if (!chart) {
    throw new Error(`Invalid chart format ${index} in cache!`);
  }
  return chart.Format;
}

export function joinCachePath(baseDirectory: string, relative: string): string {
  return [baseDirectory, relative].join("/").replace(/\/+/g, "/");
}

// Shared base of song.ini folders and .sng files (IniSubEntry in YARG.Core)
export abstract class IniSubEntry extends SongEntry {
  public Background: string = "";
  public Video: string = "";
  public Cover: string = "";

  protected Deserialize(
    stream: FixedArrayStream,
    strings: CacheReadStrings,
  ): void {
    super.Deserialize(stream, strings);
    this.Background = stream.ReadString();
    this.Video = stream.ReadString();
    this.Cover = stream.ReadString();
  }
}
