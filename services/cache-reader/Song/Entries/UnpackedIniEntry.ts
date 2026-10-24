import { FixedArrayStream } from "../../IO/FixedArray";
import { CacheReadStrings } from "../Cache/CacheReadStrings";
import { AbridgedFileInfo } from "../../IO/AbridgedFileInfo";
import {
  ChartFormat,
  IniSubEntry,
  chartFormatFromIndex,
  joinCachePath,
} from "./IniSubEntry";

export { ChartFormat };

export class UnpackedIniEntry extends IniSubEntry {
  public Directory: string;
  public ChartLastWrite: Date;
  public IniLastWrite?: Date;
  public Format: ChartFormat;

  constructor(
    directory: string,
    chartLastWrite: Date,
    iniLastWrite: Date | undefined,
    format: ChartFormat,
  ) {
    super();
    this.Directory = directory;
    this.ChartLastWrite = chartLastWrite;
    this.IniLastWrite = iniLastWrite || undefined;
    this.Format = format;
  }

  public static ForceDeserialize(
    baseDirectory: string,
    stream: FixedArrayStream,
    strings: CacheReadStrings,
  ): UnpackedIniEntry {
    const directory = joinCachePath(baseDirectory, stream.ReadString());
    const format = chartFormatFromIndex(stream.ReadByte());

    const chartLastWrite = AbridgedFileInfo.DateTimeFromBinary(
      stream.ReadInt64AsLittleEndian(),
    );

    let iniLastWrite: Date | undefined = undefined;
    if (stream.ReadBoolean()) {
      iniLastWrite = AbridgedFileInfo.DateTimeFromBinary(
        stream.ReadInt64AsLittleEndian(),
      );
    }

    const entry = new UnpackedIniEntry(
      directory,
      chartLastWrite,
      iniLastWrite,
      format,
    );
    entry.Deserialize(stream, strings);
    return entry;
  }
}
