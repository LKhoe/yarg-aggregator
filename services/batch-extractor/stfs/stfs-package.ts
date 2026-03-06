import { BinaryReader } from "./binary-reader";
import { BlockRecord } from "./block-record";
import { STFSDescriptor } from "./stfs-descriptor";
import { readHeader, type HeaderData } from "./stfs-header";
import { parseItemEntry, getEntryPath, type ItemEntry } from "./item-entry";
import {
  PackageMagic,
  PackageType,
  STFSType,
  TreeLevel,
  VALID_MAGICS,
  STFS_END,
  BLOCK_LEVEL,
} from "./stfs-constants";

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

/**
 * Read-only STFS package parser.
 * Port of STFSPackage from STFSPackage.cs — extraction only, no writing.
 */
export class STFSPackage {
  readonly io: BinaryReader;
  readonly header: HeaderData;
  readonly stfsStruct: STFSDescriptor;
  readonly files: ItemEntry[];
  readonly folders: ItemEntry[];
  private fileBlocks: BlockRecord[];

  constructor(input: Uint8Array) {
    this.io = BinaryReader.fromBuffer(input, true);

    // Validate magic
    this.io.position = 0;
    const magicVal = this.io.readUInt32();
    if (!VALID_MAGICS.has(magicVal)) {
      throw new Error(
        `Invalid STFS package: unknown magic 0x${magicVal.toString(16)}`,
      );
    }
    const magic = magicVal as PackageMagic;

    // Parse header
    this.header = readHeader(this.io, magic);

    // Reject installed game packages
    const rejectedTypes = new Set([
      PackageType.HDDInstalledGame,
      PackageType.OriginalXboxGame,
      PackageType.GamesOnDemand,
      PackageType.SocialTitle,
    ]);
    if (rejectedTypes.has(this.header.packageType)) {
      throw new Error("Package is an installed game, cannot parse as STFS");
    }

    // Parse STFS descriptor
    this.stfsStruct = new STFSDescriptor(this.io);

    // Read directory blocks
    this.fileBlocks = this.getBlocks(
      this.stfsStruct.directoryBlockCount,
      this.stfsStruct.directoryBlock,
    );

    // Parse file listing
    this.files = [];
    this.folders = [];
    let entryID = 0;

    for (const block of this.fileBlocks) {
      const blockOffset = this.stfsStruct.generateDataOffset(block.thisBlock);
      for (let i = 0; i < 0x40; i++) {
        const entryOffset = blockOffset + 0x40 * i;
        this.io.position = entryOffset;

        if (this.io.readByte() === 0) continue;

        this.io.position = entryOffset;
        const entryData = this.io.readBytes(0x40);
        const entry = parseItemEntry(entryData, entryOffset, entryID);

        if (entry && !entry.isDeleted) {
          if (entry.isFolder) {
            this.folders.push(entry);
          } else {
            this.files.push(entry);
          }
          entryID++;
        }
      }
    }
  }

  /**
   * Follow the block chain for a file, starting at startBlock.
   * Port of STFSPackage.GetBlocks().
   */
  getBlocks(count: number, startBlock: number): BlockRecord[] {
    const blockList: BlockRecord[] = [];
    let block = this.getRecord(startBlock, TreeLevel.L0);

    if (block.thisBlock >= this.stfsStruct.blockCount) {
      throw new Error("Invalid block pointer");
    }

    for (let i = 0; i < count; i++) {
      // Check for duplicate (loop detection)
      if (blockList.some((b) => b.thisBlock === block.thisBlock)) break;
      blockList.push(block);

      if (block.nextBlock === STFS_END) break;
      if (block.nextBlock >= this.stfsStruct.blockCount) {
        throw new Error("Invalid block pointer");
      }

      block = this.getRecord(block.nextBlock, TreeLevel.L0);
    }

    return blockList;
  }

  /**
   * Read a block record from the hash table.
   * Port of STFSPackage.GetRecord().
   */
  private getRecord(block: number, level: TreeLevel): BlockRecord {
    if (level === TreeLevel.LT) return this.stfsStruct.topRecord;

    let current = this.stfsStruct.topRecord;
    const canSwitch = this.stfsStruct.thisType === STFSType.Type1;

    if (this.stfsStruct.blockCount > BLOCK_LEVEL[1]) {
      let pos = this.stfsStruct.generateHashOffset(block, TreeLevel.L2) + 0x14;
      if (canSwitch) pos += current.index << 0xc;
      this.io.position = pos;
      current = new BlockRecord(this.io.readUInt32());
      if (level === TreeLevel.L2) {
        current.thisBlock = block;
        current.thisLevel = TreeLevel.L2;
        return current;
      }
    } else if (level === TreeLevel.L2) {
      return this.stfsStruct.topRecord;
    }

    if (this.stfsStruct.blockCount > BLOCK_LEVEL[0]) {
      let pos = this.stfsStruct.generateHashOffset(block, TreeLevel.L1) + 0x14;
      if (canSwitch) pos += current.index << 0xc;
      this.io.position = pos;
      current = new BlockRecord(this.io.readUInt32());
      if (level === TreeLevel.L1) {
        current.thisBlock = block;
        current.thisLevel = TreeLevel.L1;
        return current;
      }
    } else if (level === TreeLevel.L1) {
      return this.stfsStruct.topRecord;
    }

    let pos = this.stfsStruct.generateHashOffset(block, TreeLevel.L0) + 0x14;
    if (canSwitch) pos += current.index << 0xc;
    this.io.position = pos;
    current = new BlockRecord(this.io.readUInt32());
    current.thisBlock = block;
    current.thisLevel = TreeLevel.L0;
    return current;
  }

  /**
   * Find a file entry by its virtual path (e.g., "songs/songs.dta").
   */
  getFile(path: string): ItemEntry | null {
    const normalizedPath = path.replace(/\\/g, "/");
    for (const file of this.files) {
      const filePath = getEntryPath(file, this.folders);
      if (filePath === normalizedPath) return file;
    }
    return null;
  }

  /**
   * Extract a file's contents as a Uint8Array by following its block chain.
   * Port of FileEntry.Extract() (byte[] version).
   */
  extractFile(entry: ItemEntry): Uint8Array {
    if (entry.isFolder) {
      throw new Error("Cannot extract a folder");
    }

    const blocks = this.getBlocks(entry.blockCount, entry.startBlock);
    const chunks: Uint8Array[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const offset = this.stfsStruct.generateDataOffset(blocks[i].thisBlock);
      this.io.position = offset;

      if (i < blocks.length - 1) {
        chunks.push(this.io.readBytes(0x1000));
      } else {
        // Last block: read only the remainder
        const remainder = ((entry.size - 1) % 0x1000) + 1;
        chunks.push(this.io.readBytes(remainder));
      }
    }

    return concatUint8Arrays(chunks);
  }

  /**
   * Extract the first N bytes of a file.
   */
  extractFilePartial(entry: ItemEntry, maxBytes: number): Uint8Array {
    if (entry.isFolder) throw new Error("Cannot extract a folder");

    const blocks = this.getBlocks(entry.blockCount, entry.startBlock);
    const chunks: Uint8Array[] = [];
    let bytesRead = 0;

    for (let i = 0; i < blocks.length && bytesRead < maxBytes; i++) {
      const offset = this.stfsStruct.generateDataOffset(blocks[i].thisBlock);
      this.io.position = offset;

      const isLast = i === blocks.length - 1;
      const blockSize = isLast ? ((entry.size - 1) % 0x1000) + 1 : 0x1000;
      const toRead = Math.min(blockSize, maxBytes - bytesRead);

      chunks.push(this.io.readBytes(toRead));
      bytesRead += toRead;
    }

    return concatUint8Arrays(chunks);
  }

  /**
   * List all files with their full virtual paths.
   */
  listFiles(): string[] {
    return this.files.map((f) => getEntryPath(f, this.folders));
  }

  /**
   * List all folders with their full virtual paths.
   */
  listFolders(): string[] {
    return this.folders.map((f) => getEntryPath(f, this.folders));
  }
}
