/**
 * Read-only binary buffer reader with position tracking and big-endian support.
 * Port of DJsIO (read-only subset) from C#.
 */
export class BinaryReader {
  private buf: Uint8Array;
  private view: DataView;
  private pos: number = 0;
  public isBigEndian: boolean;

  constructor(input: Uint8Array, bigEndian: boolean = true) {
    this.buf = input;
    this.view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    this.isBigEndian = bigEndian;
  }

  static fromBuffer(buf: Uint8Array, bigEndian: boolean = true): BinaryReader {
    return new BinaryReader(buf, bigEndian);
  }

  get position(): number {
    return this.pos;
  }

  set position(value: number) {
    this.pos = value;
  }

  get length(): number {
    return this.buf.length;
  }

  get buffer(): Uint8Array {
    return this.buf;
  }

  readBytes(count: number): Uint8Array {
    if (this.pos >= this.buf.length) {
      throw new Error("Position past end of buffer");
    }
    if (count === 0) return new Uint8Array(0);
    const result = this.buf.slice(this.pos, this.pos + count);
    this.pos += count;
    return result;
  }

  readByte(): number {
    const val = this.buf[this.pos];
    this.pos += 1;
    return val;
  }

  readInt16(bigEndian?: boolean): number {
    const be = bigEndian ?? this.isBigEndian;
    const val = this.view.getInt16(this.pos, !be);
    this.pos += 2;
    return val;
  }

  readUInt16(bigEndian?: boolean): number {
    const be = bigEndian ?? this.isBigEndian;
    const val = this.view.getUint16(this.pos, !be);
    this.pos += 2;
    return val;
  }

  readUInt24(bigEndian?: boolean): number {
    const be = bigEndian ?? this.isBigEndian;
    const data = this.readBytes(3);
    if (be) {
      return (data[0] << 16) | (data[1] << 8) | data[2];
    }
    return (data[2] << 16) | (data[1] << 8) | data[0];
  }

  readInt32(bigEndian?: boolean): number {
    const be = bigEndian ?? this.isBigEndian;
    const val = this.view.getInt32(this.pos, !be);
    this.pos += 4;
    return val;
  }

  readUInt32(bigEndian?: boolean): number {
    const be = bigEndian ?? this.isBigEndian;
    const val = this.view.getUint32(this.pos, !be);
    this.pos += 4;
    return val;
  }

  readInt64(bigEndian?: boolean): bigint {
    const be = bigEndian ?? this.isBigEndian;
    const val = this.view.getBigInt64(this.pos, !be);
    this.pos += 8;
    return val;
  }

  readUInt40(bigEndian?: boolean): number {
    const be = bigEndian ?? this.isBigEndian;
    const data = this.readBytes(5);
    if (be) {
      return (
        data[0] * 0x100000000 +
        ((data[1] << 24) | (data[2] << 16) | (data[3] << 8) | data[4])
      );
    }
    return (
      data[4] * 0x100000000 +
      ((data[3] << 24) | (data[2] << 16) | (data[1] << 8) | data[0])
    );
  }

  readStringASCII(length: number): string {
    const bytes = this.readBytes(length);
    let end = bytes.length;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        end = i;
        break;
      }
    }
    return new TextDecoder("latin1").decode(bytes.subarray(0, end));
  }

  readStringUnicodeBE(charCount: number): string {
    const bytes = this.readBytes(charCount * 2);
    const swapped = new Uint8Array(charCount * 2);
    for (let i = 0; i < charCount * 2; i += 2) {
      swapped[i] = bytes[i + 1];
      swapped[i + 1] = bytes[i];
    }
    return new TextDecoder("utf-16le").decode(swapped).replace(/\0/g, "");
  }

  /**
   * Read a Unicode string (big-endian UTF-16) of the given character count.
   * Mirrors DJsIO.ReadString(StringForm.Unicode, size) with BigEndian=true.
   */
  readStringUnicode(charCount: number, bigEndian?: boolean): string {
    const be = bigEndian ?? this.isBigEndian;
    const byteCount = charCount * 2;
    const bytes = this.readBytes(byteCount);

    if (be) {
      const swapped = new Uint8Array(byteCount);
      for (let i = 0; i < byteCount; i += 2) {
        swapped[i] = bytes[i + 1];
        swapped[i + 1] = bytes[i];
      }
      return new TextDecoder("utf-16le").decode(swapped).replace(/\0/g, "");
    }
    return new TextDecoder("utf-16le").decode(bytes).replace(/\0/g, "");
  }
}
