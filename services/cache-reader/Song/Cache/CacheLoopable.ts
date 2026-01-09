import { FixedArrayStream } from '../../IO/FixedArray';

export class CacheLoopable implements Iterable<{ Slice: FixedArrayStream, Index: number }> {
  private stream: FixedArrayStream;
  public Count: number;

  constructor(stream: FixedArrayStream, count?: number) {
    this.stream = stream;
    this.Count = count ?? stream.ReadInt32();
  }

  *[Symbol.iterator](): Iterator<{ Slice: FixedArrayStream, Index: number }> {
    for (let i = 0; i < this.Count; i++) {
      const length = this.stream.ReadInt32();
      const slice = this.stream.Slice(length);
      yield { Slice: slice, Index: i };
    }
  }
}
