import { PackageMagic, PackageType } from "./stfs-constants";
import { BinaryReader } from "./binary-reader";

/**
 * STFS package header metadata.
 * Port of HeaderData from STFSPackage.cs.
 */
export interface HeaderData {
  magic: PackageMagic;
  packageType: PackageType;
  metaDataVersion: number;
  contentSize: bigint;
  mediaID: number;
  version: number;
  versionBase: number;
  titleID: number;
  platform: number;
  executableType: number;
  discNumber: number;
  discInSet: number;
  saveGameID: number;
  saveConsoleID: number;
  profileID: bigint;
  dataFileCount: number;
  dataFileSize: bigint;
  reserved: bigint;
  seriesID: Uint8Array;
  seasonID: Uint8Array;
  seasonNumber: number;
  episodeNumber: number;
  deviceID: Uint8Array;
  titles: string[];
  descriptions: string[];
  publisher: string;
  titlePackage: string;
  transferLock: number;
  packageImageBinary: Uint8Array;
  contentImageBinary: Uint8Array;
}

/**
 * Read STFS header metadata from a binary reader.
 * Port of HeaderData.read() from STFSPackage.cs:1183-1231.
 */
export function readHeader(
  io: BinaryReader,
  magicType: PackageMagic,
): HeaderData {
  io.isBigEndian = true;

  // Skip licenses (0x22C, 16 entries × 16 bytes each)
  io.position = 0x344;
  const packageType = io.readUInt32() as PackageType;
  const metaDataVersion = io.readUInt32();
  const contentSize = io.readInt64();
  const mediaID = io.readUInt32();
  const version = io.readUInt32();
  const versionBase = io.readUInt32();
  const titleID = io.readUInt32();
  const platform = io.readByte();
  const executableType = io.readByte();
  const discNumber = io.readByte();
  const discInSet = io.readByte();
  const saveGameID = io.readUInt32();
  const saveConsoleID = io.readUInt40();
  const profileID = io.readInt64();

  io.position = 0x39d;
  const dataFileCount = io.readUInt32();
  const dataFileSize = io.readInt64();
  const reserved = io.readInt64();
  const seriesID = io.readBytes(0x10);
  const seasonID = io.readBytes(0x10);
  const seasonNumber = io.readUInt16();
  const episodeNumber = io.readUInt16();

  // Skip 0x28 bytes
  io.position += 0x28;
  const deviceID = io.readBytes(0x14);

  // 9 display titles (Unicode, 0x80 chars each)
  const titles: string[] = [];
  for (let i = 0; i < 9; i++) {
    titles.push(io.readStringUnicode(0x80));
  }

  // 9 descriptions (Unicode, 0x80 chars each)
  const descriptions: string[] = [];
  for (let i = 0; i < 9; i++) {
    descriptions.push(io.readStringUnicode(0x80));
  }

  const publisher = io.readStringUnicode(0x40);
  const titlePackage = io.readStringUnicode(0x40);
  const transferLock = io.readByte();

  // Package Image
  const packageImageSize = io.readInt32();
  io.position = 0x171a;
  const packageImageBinary = io.readBytes(
    packageImageSize < 0x4000 ? packageImageSize : 0x4000,
  );

  // Content Image
  io.position = 0x1716;
  const contentImageSize = io.readInt32();
  io.position = 0x571a;
  const contentImageBinary = io.readBytes(
    contentImageSize < 0x4000 ? contentImageSize : 0x4000,
  );

  return {
    magic: magicType,
    packageType,
    metaDataVersion,
    contentSize,
    mediaID,
    version,
    versionBase,
    titleID,
    platform,
    executableType,
    discNumber,
    discInSet,
    saveGameID,
    saveConsoleID,
    profileID,
    dataFileCount,
    dataFileSize: BigInt(dataFileSize),
    reserved: BigInt(reserved),
    seriesID,
    seasonID,
    seasonNumber,
    episodeNumber,
    deviceID,
    titles,
    descriptions,
    publisher,
    titlePackage,
    transferLock,
    packageImageBinary,
    contentImageBinary,
  };
}
