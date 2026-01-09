import { FixedArrayStream } from '../../IO/FixedArray';
import { CacheReadStrings } from '../Cache/CacheReadStrings';
import { AbridgedFileInfo } from '../../IO/AbridgedFileInfo';
import { SongEntry } from './SongEntry';
import { path } from '../../utils/browser-utils';


export enum ChartFormat {
  Unknown = 0,
}

export class UnpackedIniEntry extends SongEntry {
  public Directory: string;
  public ChartLastWrite: Date;
  public IniLastWrite?: Date;
  public Format: ChartFormat;

  private static CHART_FILE_TYPES: { Filename: string, Format: number }[] = [
    { Filename: "notes.chart", Format: 1 },
    { Filename: "notes.mid", Format: 2 },
    { Filename: "song.chart", Format: 1 },
  ];

  constructor(directory: string, chartLastWrite: Date, iniLastWrite: Date | undefined, format: number) {
    super();
    this.Directory = directory;
    this.ChartLastWrite = chartLastWrite;
    this.IniLastWrite = iniLastWrite || undefined;
    this.Format = format;
  }

  public static ForceDeserialize(baseDirectory: string, stream: FixedArrayStream, strings: CacheReadStrings): UnpackedIniEntry {
    const subDir = stream.ReadString();
    const directory = path.join(baseDirectory, subDir);

    const chartTypeIndex = stream.ReadByte();
    const chart = UnpackedIniEntry.CHART_FILE_TYPES[chartTypeIndex];
    const format = chart.Format;

    const chartLastWrite = AbridgedFileInfo.DateTimeFromBinary(stream.ReadInt64AsLittleEndian());
    
    let iniLastWrite: Date | undefined = undefined;
    if (stream.ReadBoolean()) {
      iniLastWrite = AbridgedFileInfo.DateTimeFromBinary(stream.ReadInt64AsLittleEndian());
    }

    const entry = new UnpackedIniEntry(directory, chartLastWrite, iniLastWrite, format);
    entry.Deserialize(stream, strings);
    return entry;
  }

  // Override Deserialize if needed or rely on minimal valid read
  // public Deserialize(stream: FixedArrayStream, strings: CacheReadStrings): void {
  // base.Deserialize is called.
  // If UnpackedIniEntry has ADDITIONAL fields to read, they should be read here.
  // C# code showed: _year extraction etc.
  // But for QuickScan structure, we MUST consume the exact amount of bytes.
  // `UnpackedIniEntry` inherits `IniSubEntry`.
  // `IniSubEntry` deserializes base, then... checks comments?
  // In C# `IniSubEntry.Deserialize`:
  // `base.Deserialize(ref stream, strings);`
  // `// _background = stream.ReadString();` (commented out)
  // `(_parsedYear, _yearAsNumber) = ParseYear(_metadata.Year);`
  // So effectively, `UnpackedIniEntry` deserialization logic IS `SongEntry` deserialization logic for the stream part.
  // So default inheritance is fine.
  // }
}
