import { FixedArrayStream } from "../../IO/FixedArray";
import { CacheReadStrings } from "../Cache/CacheReadStrings";
import { AbridgedFileInfo } from "../../IO/AbridgedFileInfo";
import {
  ChartFormat,
  IniSubEntry,
  chartFormatFromIndex,
  joinCachePath,
} from "./IniSubEntry";

// A song packed in a single .sng file (SngEntry in YARG.Core)
export class SngEntry extends IniSubEntry {
  public Location: string;
  public LastWrite: Date;
  public Version: number;
  public Format: ChartFormat;

  constructor(
    location: string,
    lastWrite: Date,
    version: number,
    format: ChartFormat,
  ) {
    super();
    this.Location = location;
    this.LastWrite = lastWrite;
    this.Version = version;
    this.Format = format;
  }

  public static ForceDeserialize(
    baseDirectory: string,
    stream: FixedArrayStream,
    strings: CacheReadStrings,
  ): SngEntry {
    const location = joinCachePath(baseDirectory, stream.ReadString());
    const lastWrite = AbridgedFileInfo.DateTimeFromBinary(
      stream.ReadInt64AsLittleEndian(),
    );
    const version = stream.ReadUInt32AsLittleEndian();
    const format = chartFormatFromIndex(stream.ReadByte());

    const entry = new SngEntry(location, lastWrite, version, format);
    entry.Deserialize(stream, strings);
    return entry;
  }
}
