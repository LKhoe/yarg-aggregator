import { FixedArrayStream } from './FixedArray';

export class AbridgedFileInfo {
  public FullName: string;
  public LastWriteTime: Date;

  constructor(
    fileOrStream: FixedArrayStream | { FullName: string, LastWriteTime: Date },
    lastUpdatedTime?: Date
  ) {
   if (fileOrStream instanceof FixedArrayStream) {
      this.FullName = fileOrStream.ReadString();
      this.LastWriteTime = AbridgedFileInfo.DateTimeFromBinary(fileOrStream.ReadInt64());
    } else {
      this.FullName = fileOrStream.FullName;
      this.LastWriteTime = fileOrStream.LastWriteTime;
    }
  }

  public static FromStream(stream: FixedArrayStream): AbridgedFileInfo {
    return new AbridgedFileInfo(stream);
  }

  public static DateTimeFromBinary(binary: bigint): Date {
    // from C# to TS
    const ticks = binary & BigInt("0x3fffffffffffffff");
    const msSinceUnixEpoch =
      Number((ticks - BigInt("621355968000000000")) / BigInt("10000"));
    return new Date(msSinceUnixEpoch);
  }
}
