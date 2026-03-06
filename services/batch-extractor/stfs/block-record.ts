import { TreeLevel, STFS_END } from "./stfs-constants";

/**
 * Block record parsed from hash table entries.
 * Port of BlockRecord from STFSDescriptor.cs.
 *
 * The 4-byte flags field encodes:
 *   - Status (bits 31-30): HashStatus
 *   - NextBlock (bits 23-0): next block index in chain
 * For hash table records:
 *   - Indicator (bits 31-30)
 *   - BlocksFree (bits 29-15)
 *   - Index = Indicator & 1
 */
export class BlockRecord {
  private flags: Uint8Array;
  thisBlock: number = 0;
  thisLevel: TreeLevel = TreeLevel.L0;

  constructor(flagsOrValue?: number) {
    if (flagsOrValue !== undefined) {
      this.flags = new Uint8Array(4);
      this.flagsValue = flagsOrValue;
    } else {
      this.flags = new Uint8Array(4);
    }
  }

  static fromStatusAndNext(status: number, nextBlock: number): BlockRecord {
    const rec = new BlockRecord();
    rec.flagsValue = ((status & 3) << 30) | (nextBlock & 0xffffff);
    return rec;
  }

  get flagsValue(): number {
    return (
      ((this.flags[0] << 24) |
        (this.flags[1] << 16) |
        (this.flags[2] << 8) |
        this.flags[3]) >>>
      0
    );
  }

  set flagsValue(value: number) {
    this.flags[0] = (value >>> 24) & 0xff;
    this.flags[1] = (value >>> 16) & 0xff;
    this.flags[2] = (value >>> 8) & 0xff;
    this.flags[3] = value & 0xff;
  }

  /** Hash status (bits 31-30): 0=Unused, 1=Old, 2=New, 3=Reused */
  get status(): number {
    return this.flags[0] >>> 6;
  }

  set status(value: number) {
    this.flags[0] = (value & 3) << 6;
  }

  /** Next block in the chain (bits 23-0) */
  get nextBlock(): number {
    return ((this.flags[1] << 16) | (this.flags[2] << 8) | this.flags[3]) >>> 0;
  }

  set nextBlock(value: number) {
    const top = this.flags[0] << 24;
    this.flagsValue = (top | (value & 0xffffff)) >>> 0;
  }

  /** Indicator = top 2 bits (same as status, used for table context) */
  get indicator(): number {
    return this.flags[0] >>> 6;
  }

  set indicator(value: number) {
    this.flags[0] = (value & 3) << 6;
  }

  /** Table index = indicator & 1 */
  get index(): number {
    return this.indicator & 1;
  }

  /** Blocks free in a hash table entry (bits 29-15) */
  get blocksFree(): number {
    return (this.flagsValue >>> 15) & 0x7fff;
  }

  set blocksFree(value: number) {
    if (value < 0) value = 0;
    this.flagsValue = ((this.indicator << 30) | (value << 15)) >>> 0;
  }

  markOld(): void {
    this.status = 1; // HashStatus.Old
    this.nextBlock = STFS_END;
  }
}
