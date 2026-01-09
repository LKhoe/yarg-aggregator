import { FixedArrayStream } from '../../IO/FixedArray';
import { CacheLoopable } from './CacheLoopable';

export class CacheReadStrings {
  public static readonly NUM_CATEGORIES = 8;
  private categories: string[][] = new Array(CacheReadStrings.NUM_CATEGORIES);

  constructor(stream: FixedArrayStream) {
    const loopable = new CacheLoopable(stream, CacheReadStrings.NUM_CATEGORIES);

    for (const { Slice, Index } of loopable) {
      const count = Slice.ReadInt32();
      const strings = new Array<string>(count);
      for (let i = 0; i < count; i++) {
        strings[i] = Slice.ReadString();
      }
      this.categories[Index] = strings;
    }
  }

  public get Titles(): string[] { return this.categories[0]; }
  public get Artists(): string[] { return this.categories[1]; }
  public get Albums(): string[] { return this.categories[2]; }
  public get Genres(): string[] { return this.categories[3]; }
  public get Years(): string[] { return this.categories[4]; }
  public get Charters(): string[] { return this.categories[5]; }
  public get Playlists(): string[] { return this.categories[6]; }
  public get Sources(): string[] { return this.categories[7]; }
}
