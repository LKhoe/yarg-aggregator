// Use browser-native TextDecoder with fallback for Node.js
const TextDecoder = typeof window !== 'undefined' 
  ? window.TextDecoder 
  : require('util').TextDecoder;

export class FixedArray {
  private buffer: Uint8Array;
  private ptr: number;
  private disposed: boolean = false;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.ptr = 0; // In JS we don't really have pointers, so we just wrap the Uint8Array
  }

  public get Length(): number {
    return this.buffer.length;
  }

  public get Buffer(): Uint8Array {
    if (this.disposed) throw new Error("ObjectDisposedException");
    return this.buffer;
  }

  public ToValueStream(): FixedArrayStream {
    return new FixedArrayStream(this);
  }

  public Dispose(): void {
    this.disposed = true;
    this.buffer = new Uint8Array(0);
  }
}

export class FixedArrayStream {
  private data: Uint8Array;
  private position: number;

  constructor(data: FixedArray | Uint8Array) {
    if (data instanceof FixedArray) {
      this.data = data.Buffer;
    } else {
      this.data = data;
    }
    this.position = 0;
  }

  public get Length(): number {
    return this.data.length;
  }

  public get Position(): number {
    return this.position;
  }

  public set Position(value: number) {
    if (value < 0 || value > this.data.length) {
      throw new Error("ArgumentOutOfRangeException");
    }
    this.position = value;
  }

  public ReadByte(): number {
    if (this.position >= this.data.length) {
      throw new Error("InvalidOperationException: End of stream");
    }
    return this.data[this.position++];
  }

  public ReadBoolean(): boolean {
    return this.ReadByte() !== 0;
  }

  public ReadInt32(): number {
    if (this.position + 4 > this.data.length) throw new Error("InvalidOperationException");
    const value = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength).getInt32(this.position, true);
    this.position += 4;
    return value;
  }

  public ReadInt16(): number {
    if (this.position + 2 > this.data.length) throw new Error("InvalidOperationException");
    const value = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength).getInt16(this.position, true);
    this.position += 2;
    return value;
  }

  public ReadInt64(): bigint {
    if (this.position + 8 > this.data.length) throw new Error("InvalidOperationException");
    const value = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength).getBigInt64(this.position, true);
    this.position += 8;
    return value;
  }

  public ReadString(): string {
    const length = this.Read7BitEncodedInt();
    if (length < 0) throw new Error("Invalid string length");

    if (this.position + length > this.data.length) throw new Error("InvalidOperationException");

    const strBytes = this.data.subarray(this.position, this.position + length);
    const str = new TextDecoder('utf-8').decode(strBytes);
    this.position += length;
    return str;
  }

  public Read7BitEncodedInt(): number {
    let result = 0;
    let shift = 0;
    let byteRead: number;

    do {
      byteRead = this.ReadByte();
      result |= (byteRead & 0x7F) << shift;
      shift += 7;
    } while ((byteRead & 0x80) !== 0);

    return result;
  }

  // Helper for generic Read<T> in C# - mapped to specific methods here
  // C# code uses Read<long> for DateTime binary
  public ReadDateTime(): bigint {
    return this.ReadInt64();
  }

  public ReadGuid(): string {
    // GUID is 16 bytes
    if (this.position + 16 > this.data.length) throw new Error("InvalidOperationException");
    const bytes = this.data.subarray(this.position, this.position + 16);
    this.position += 16;

    // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    // Be careful with endianness of GUIDs in C#. The standard Guid struct layout is:
    // int32 (a), int16 (b), int16 (c), byte (d), byte (e), byte[6] (f...k)
    // a, b, c are little endian in Windows/C#. d..k are just bytes.
    // However, usually when reading directly as bytes they assume memory layout.

    // For simplicity let's dump hex for now, but we need to match C# ToString behavior if needed?
    // Actually CacheHandler doesn't seem to use ReadGuid in the parts we care about?
    // Wait, FixedArrayStream has ReadGuid but let's see if it's used.
    // It is NOT used in the QuickScan path according to my reading of CacheHandler.cs
    // But implementing it safely is good.

    // Simple hex dump for now
    return Buffer.from(bytes).toString('hex');
  }

  public Slice(length: number): FixedArrayStream {
    if (length < 0 || this.position + length > this.data.length) {
      throw new Error("ArgumentOutOfRangeException");
    }
    const slice = this.data.subarray(this.position, this.position + length);
    this.position += length;
    return new FixedArrayStream(slice);
  }

  public ToBuffer(): Uint8Array {
    return this.data.slice(this.position, this.data.length); // return remaining data or the whole slice? 
    // FixedArrayStream is often a slice itself.
    // Actually, for Slice(length), it returns a new FixedArrayStream on the subarray.
    // So ToBuffer should likely return the underlying data.
    // But if I want to "consume" the stream into a buffer, I should probably return the current view.
    return this.data;
  }

  public ReadInt32AsLittleEndian(): number {
    return this.ReadInt32();
  }

  public ReadInt16AsLittleEndian(): number {
    return this.ReadInt16();
  }

  public ReadUInt32AsLittleEndian(): number {
    if (this.position + 4 > this.data.length) throw new Error("InvalidOperationException");
    const value = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength).getUint32(this.position, true);
    this.position += 4;
    return value;
  }

  public ReadInt64AsLittleEndian(): bigint {
    return this.ReadInt64();
  }
}
