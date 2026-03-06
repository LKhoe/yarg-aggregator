import {
  STFSType,
  TreeLevel,
  STFS_END,
  BLOCK_LEVEL,
  MAX_BLOCK_0x4AF768,
} from "./stfs-constants";
import { BlockRecord } from "./block-record";
import { BinaryReader } from "./binary-reader";

/**
 * STFS descriptor — block address math for navigating the STFS virtual filesystem.
 * Port of STFSDescriptor.cs.
 */
export class STFSDescriptor {
  xStruct: Uint8Array;
  readonly spaceBetween: [number, number, number];
  private readonly baseByte: number;
  blockCount: number;
  topRecord: BlockRecord;
  shift: number = 0;

  get directoryBlockCount(): number {
    return (this.xStruct[1] << 8) | this.xStruct[0];
  }

  get directoryBlock(): number {
    return (this.xStruct[4] << 16) | (this.xStruct[3] << 8) | this.xStruct[2];
  }

  get thisType(): STFSType {
    return this.shift as STFSType;
  }

  get baseBlock(): number {
    return this.baseByte << 0xc;
  }

  /**
   * Construct from an STFS package IO (reading from the file).
   * Port of STFSDescriptor(STFSPackage xPackage).
   */
  constructor(io: BinaryReader) {
    this.spaceBetween = [0, 0, 0];

    io.position = 0x340;
    io.isBigEndian = true;
    const blockInfo = io.readInt32();
    this.baseByte = (((blockInfo + 0xfff) & 0xf000) >>> 0xc) & 0xff;

    io.position = 0x379;
    if (io.readByte() !== 0x24)
      throw new Error("Invalid STFS type: struct size");
    if (io.readByte() !== 0) throw new Error("Invalid STFS type: reserved");

    const idx = io.readByte() & 3;
    this.xStruct = new Uint8Array(io.readBytes(5));

    io.position = 0x395;
    this.blockCount = io.readUInt32();
    const oldBlocks = io.readUInt32();

    // Determine Type0 vs Type1
    switch (this.baseByte) {
      case 0xb:
        if (idx === 1) {
          this.setStructure(STFSType.Type0);
        } else {
          throw new Error("Invalid STFS type");
        }
        break;
      case 0xa:
        if (idx === 0 || idx === 2) {
          this.setStructure(STFSType.Type1);
        } else {
          throw new Error("Invalid STFS type");
        }
        break;
      default:
        throw new Error("Invalid STFS type");
    }

    if (this.blockCount > this.spaceBetween[2]) {
      throw new Error("Max block count exceeded");
    }

    this.topRecord = new BlockRecord(
      ((((idx >>> 1) & 1) << 30) | (oldBlocks << 15)) >>> 0,
    );

    // Adjust real block count by checking data offsets against file length
    for (let i = this.blockCount - 1; ; i--) {
      this.blockCount = i + 1;
      if (this.generateDataOffset(i) < io.length) break;
      if (i === 0) break;
    }
  }

  private setStructure(type: STFSType): void {
    switch (type) {
      case STFSType.Type0:
        this.spaceBetween[0] = 0xab;
        this.spaceBetween[1] = 0x718f;
        this.spaceBetween[2] = 0xfe7da;
        this.shift = 0;
        break;
      case STFSType.Type1:
        this.spaceBetween[0] = 0xac;
        this.spaceBetween[1] = 0x723a;
        this.spaceBetween[2] = 0xfd00b;
        this.shift = 1;
        break;
    }
  }

  /**
   * Given a data block index, compute the actual block number
   * accounting for interleaved hash table blocks.
   */
  generateDataBlock(block: number): number {
    if (block >= MAX_BLOCK_0x4AF768) return STFS_END;

    let num = ((Math.floor(block / BLOCK_LEVEL[0]) + 1) << this.shift) + block;
    if (block < BLOCK_LEVEL[0]) return num;

    num += (Math.floor(block / BLOCK_LEVEL[1]) + 1) << this.shift;
    if (block < BLOCK_LEVEL[1]) return num;

    return num + (1 << this.shift);
  }

  /**
   * Given a data block index and tree level, compute the hash table block number.
   */
  generateHashBlock(block: number, tree: TreeLevel): number {
    if (block >= MAX_BLOCK_0x4AF768) return STFS_END;

    switch (tree) {
      case TreeLevel.L0: {
        let num = Math.floor(block / BLOCK_LEVEL[0]) * this.spaceBetween[0];
        if (block < BLOCK_LEVEL[0]) return num;
        num += (Math.floor(block / BLOCK_LEVEL[1]) + 1) << this.shift;
        if (block >= BLOCK_LEVEL[1]) num += 1 << this.shift;
        return num;
      }
      case TreeLevel.L1: {
        if (block < BLOCK_LEVEL[1]) return this.spaceBetween[0];
        return (
          this.spaceBetween[1] * Math.floor(block / BLOCK_LEVEL[1]) +
          (1 << this.shift)
        );
      }
      case TreeLevel.L2:
        return this.spaceBetween[1];
      default:
        return STFS_END;
    }
  }

  /**
   * Compute the byte offset within the file of the hash entry for the given block.
   */
  generateHashOffset(block: number, tree: TreeLevel): number {
    if (block >= MAX_BLOCK_0x4AF768) return STFS_END;

    const hashBlockNum = this.generateHashBlock(block, tree);
    let offset = this.blockToOffset(hashBlockNum);

    switch (tree) {
      case TreeLevel.L0:
        offset += 0x18 * (block % BLOCK_LEVEL[0]);
        break;
      case TreeLevel.L1:
        offset += 0x18 * (Math.floor(block / BLOCK_LEVEL[0]) % BLOCK_LEVEL[0]);
        break;
      case TreeLevel.L2:
        offset += 0x18 * (Math.floor(block / BLOCK_LEVEL[1]) % BLOCK_LEVEL[0]);
        break;
    }
    return offset;
  }

  /**
   * Compute the byte offset within the file of the given data block.
   */
  generateDataOffset(block: number): number {
    if (block >= MAX_BLOCK_0x4AF768) return STFS_END;
    return this.blockToOffset(this.generateDataBlock(block));
  }

  /**
   * Convert a block number to a byte offset using the base block offset.
   */
  blockToOffset(block: number): number {
    return block * 0x1000 + this.baseBlock;
  }

  /**
   * Compute the byte offset of the base of a hash table.
   */
  generateBaseOffset(block: number, tree: TreeLevel): number {
    return this.blockToOffset(this.generateHashBlock(block, tree));
  }
}
