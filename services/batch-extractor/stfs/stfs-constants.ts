/** STFS package magic bytes */
export enum PackageMagic {
  /** Console signed */
  CON = 0x434f4e20,
  /** Xbox Live Server Signed */
  LIVE = 0x4c495645,
  /** Xbox Distribution Signed */
  PIRS = 0x50495253,
  /** Unknown Magic */
  Unknown = 0xfffffff,
}

/** STFS structure type */
export enum STFSType {
  Type0 = 0,
  Type1 = 1,
}

/** Hash table tree level */
export enum TreeLevel {
  L0 = 0,
  L1 = 1,
  L2 = 2,
  LT = 3,
}

/** Xbox Package type */
export enum PackageType {
  None = 0,
  SavedGame = 1,
  MarketPlace = 2,
  Publisher = 3,
  IPTV_DVR = 0xffd,
  Xbox360Title = 0x1000,
  IPTV_PauseBuffer = 0x2000,
  XNACommunity = 0x3000,
  HDDInstalledGame = 0x4000,
  OriginalXboxGame = 0x5000,
  SocialTitle = 0x6000,
  GamesOnDemand = 0x7000,
  SystemPacks = 0x8000,
  AvatarItem = 0x9000,
  Profile = 0x10000,
  GamerPicture = 0x20000,
  ThematicSkin = 0x30000,
  Cache = 0x40000,
  StorageDownload = 0x50000,
  XboxSavedGame = 0x60000,
  XboxDownload = 0x70000,
  GameDemo = 0x80000,
  Video = 0x90000,
  GameTitle = 0xa0000,
  Installer = 0xb0000,
  GameTrailer = 0xc0000,
  Arcade = 0xd0000,
  XNA = 0xe0000,
  LicenseStore = 0xf0000,
  Movie = 0x100000,
  TV = 0x200000,
  MusicVideo = 0x300000,
  GameVideo = 0x400000,
  PodcastVideo = 0x500000,
  ViralVideo = 0x600000,
}

export const BLOCK_SIZE = 0x1000;
export const STFS_END = 0xffffff;
export const BLOCK_LEVEL: readonly [number, number] = [0xaa, 0x70e4];
export const MAX_BLOCK_0x4AF768 = 0x4af768;

/** Valid package magic values */
export const VALID_MAGICS = new Set<number>([
  PackageMagic.CON,
  PackageMagic.LIVE,
  PackageMagic.PIRS,
]);
