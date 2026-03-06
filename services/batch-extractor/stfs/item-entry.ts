import { BinaryReader } from "./binary-reader";

/**
 * A virtual filesystem entry within an STFS package.
 * Each entry is 0x40 bytes in the directory listing.
 * Port of ItemEntry/FileEntry from STFSPackage.cs.
 */
export interface ItemEntry {
  name: string;
  isFolder: boolean;
  isDeleted: boolean;
  entryID: number;
  folderPointer: number;
  startBlock: number;
  blockCount: number;
  size: number;
  createdTime: number;
  accessedTime: number;
  directoryOffset: number;
}

/**
 * Parse a single 0x40-byte directory entry.
 */
export function parseItemEntry(
  data: Uint8Array,
  directOffset: number,
  entryID: number,
): ItemEntry | null {
  const io = BinaryReader.fromBuffer(data, true);

  // Read flags byte at offset 0x28
  io.position = 0x28;
  const flag = io.readByte();
  const nameLength = Math.min(flag & 0x3f, 0x28);
  const isFolder = ((flag >>> 7) & 1) === 1;

  if (nameLength === 0) {
    return null; // Deleted entry
  }

  // Read name from start
  io.position = 0;
  const name = io.readStringASCII(nameLength);

  // Read block/folder/size info
  io.position = 0x2f;
  const startBlock = io.readUInt24(false); // Little endian 3-byte
  const folderPointer = io.readUInt16(true); // Big endian
  const size = io.readInt32(true); // Big endian
  const blockCount = size > 0 ? Math.floor((size - 1) / 0x1000) + 1 : 0;
  const createdTime = io.readInt32(false); // Little endian FAT time
  const accessedTime = io.readInt32(false);

  return {
    name,
    isFolder,
    isDeleted: false,
    entryID,
    folderPointer,
    startBlock,
    blockCount,
    size,
    createdTime,
    accessedTime,
    directoryOffset: directOffset,
  };
}

/**
 * Build the full path of an entry by walking up the folder tree.
 */
export function getEntryPath(entry: ItemEntry, folders: ItemEntry[]): string {
  let path = entry.name;
  let currFolder = entry.folderPointer;

  while (currFolder !== 0xffff) {
    const parent = folders.find((f) => f.entryID === currFolder);
    if (!parent) return path;
    path = parent.name + "/" + path;
    currFolder = parent.folderPointer;
  }

  return path;
}
