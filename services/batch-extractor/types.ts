/**
 * All shared interfaces and enums for the ts-extractor.
 */

/** Parsed song metadata from a DTA file. */
export interface SongData {
  songId: number;
  songIdString: string;
  shortName: string;
  internalName: string;
  filePath: string;
  midiFile: string;

  name: string;
  overrideName: string;
  artist: string;
  album: string;
  source: string;
  gender: string;
  genre: string;
  rawGenre: string;
  subGenre: string;
  rawSubGenre: string;
  chartAuthor: string;
  publisher: string;

  percussionBank: string;
  drumBank: string;
  proBassTuning: string;
  proGuitarTuning: string;

  attenuationValues: string;
  originalAttenuationValues: string;
  panningValues: string;
  instrumentSolos: string;
  encoding: string;
  languages: string;
  songLink: string;

  // Difficulties (0-6 typically, 0 = not charted)
  drumsDiff: number;
  bassDiff: number;
  guitarDiff: number;
  keysDiff: number;
  vocalsDiff: number;
  proBassDiff: number;
  proGuitarDiff: number;
  proKeysDiff: number;
  bandDiff: number;

  // Channels
  channelsDrums: number;
  channelsBass: number;
  channelsGuitar: number;
  channelsKeys: number;
  channelsVocals: number;
  channelsCrowd: number;
  channelsTotal: number;
  channelsDrumsStart: number;
  channelsBassStart: number;
  channelsGuitarStart: number;
  channelsKeysStart: number;
  channelsVocalsStart: number;
  channelsCrowdStart: number;

  vocalParts: number;
  trackNumber: number;
  rating: number;
  gameVersion: number;
  scrollSpeed: number;
  hopoThreshold: number;
  tonicNote: number;
  tonality: number;

  muteVolume: number;
  muteVolumeVocals: number;
  tuningCents: number;
  animTempo: number;
  guidePitch: number;

  length: number;
  previewStart: number;
  previewEnd: number;

  yearReleased: number;
  yearRecorded: number;

  // Flags
  master: boolean;
  doubleBass: boolean;
  karaoke: boolean;
  multitrack: boolean;
  diyStems: boolean;
  partialMultitrack: boolean;
  unpitchedVocals: boolean;
  convert: boolean;
  expertOnly: boolean;
  rhythmKeys: boolean;
  rhythmBass: boolean;
  disableProKeys: boolean;
  rb3Version: boolean;
  catemh: boolean;
  hasSongIDError: boolean;

  dtaLines: string[];
  dtaIndex: number;
}

/** File types that can be extracted */
export enum FileType {
  DTA = "dta",
  MIDI = "mid",
  MOGG = "mogg",
  PNG = "png_xbox",
  MILO = "milo_xbox",
  Thumbnail = "thumbnail",
}

/** Naming style for extracted files */
export enum NamingStyle {
  ArtistSong = "artist-song",
  ArtistTheSong = "artist-the-song",
  SongArtist = "song-artist",
  SongArtistThe = "song-artist-the",
  SongID = "song-id",
}

/** How to handle spaces in file names */
export enum SpaceHandling {
  Keep = "keep",
  Remove = "remove",
  Underscore = "underscore",
}

/** Output directory organization */
export enum OutputLayout {
  /** Organize by file type (dta_files/, midi_files/, etc.) */
  ByType = "by-type",
  /** YARG exCON layout */
  YARG = "yarg",
  /** All files in a flat directory */
  Flat = "flat",
}

/** Options for extraction */
export interface ExtractionOptions {
  fileTypes: FileType[];
  namingStyle: NamingStyle;
  spaceHandling: SpaceHandling;
  outputLayout: OutputLayout;
  /** Append "_songs" to DTA filenames */
  appendSongsToFiles: boolean;
  /** Remove "_keep" from PNG_XBOX filenames */
  removeKeepFromPNG: boolean;
  /** Decrypt MOGG files after extraction */
  decryptMogg: boolean;
  /** Callback for custom MOGG decryption (versions other than 0x0B) */
  moggDecryptCallback?: (
    moggData: Uint8Array,
    version: number,
  ) => Promise<Uint8Array | null> | Uint8Array | null;
  /** Progress callback */
  onProgress?: (message: string, value: number) => void;
}

/** Result of an extraction operation */
export interface ExtractionResult {
  success: boolean;
  songsExtracted: number;
  filesExtracted: {
    dta: number;
    midi: number;
    mogg: number;
    png: number;
    milo: number;
    thumbnail: number;
  };
  songs: SongData[];
  errors: string[];
  logs: string[];
}

/** Result of extractToZip — includes all ExtractionResult fields plus the ZIP bytes */
export interface ZipExtractionResult extends ExtractionResult {
  zip: Uint8Array;
}

/** Per-song entry in ExtractFilesResult.success */
export interface ExtractFileSuccess {
  file_name: string;
  song_name: string;
  artist_name: string;
  guitar_diff: number;
  bass_diff: number;
  drums_diff: number;
  keys_diff: number;
  vocals_diff: number;
}

/** Per-file entry in ExtractFilesResult.error */
export interface ExtractFileError {
  file_name: string;
  log: string;
}

/** Result of extractFiles() */
export interface ExtractFilesResult {
  zipFile: Uint8Array;
  success: ExtractFileSuccess[];
  error: ExtractFileError[];
}

/** Create a default SongData with all fields initialized */
export function createDefaultSongData(): SongData {
  return {
    songId: 0,
    songIdString: "",
    shortName: "",
    internalName: "",
    filePath: "",
    midiFile: "",
    name: "",
    overrideName: "",
    artist: "",
    album: "",
    source: "",
    gender: "N/A",
    genre: "",
    rawGenre: "",
    subGenre: "",
    rawSubGenre: "",
    chartAuthor: "",
    publisher: "",
    percussionBank: "",
    drumBank: "",
    proBassTuning: "",
    proGuitarTuning: "",
    attenuationValues: "",
    originalAttenuationValues: "",
    panningValues: "",
    instrumentSolos: "",
    encoding: "",
    languages: "",
    songLink: "",
    drumsDiff: 0,
    bassDiff: 0,
    guitarDiff: 0,
    keysDiff: 0,
    vocalsDiff: 0,
    proBassDiff: 0,
    proGuitarDiff: 0,
    proKeysDiff: 0,
    bandDiff: 0,
    channelsDrums: 0,
    channelsBass: 0,
    channelsGuitar: 0,
    channelsKeys: 0,
    channelsVocals: 0,
    channelsCrowd: 0,
    channelsTotal: 0,
    channelsDrumsStart: 0,
    channelsBassStart: 0,
    channelsGuitarStart: 0,
    channelsKeysStart: 0,
    channelsVocalsStart: 0,
    channelsCrowdStart: 0,
    vocalParts: 0,
    trackNumber: 0,
    rating: 4,
    gameVersion: -1,
    scrollSpeed: 2300,
    hopoThreshold: 170,
    tonicNote: -1,
    tonality: 0,
    muteVolume: -96,
    muteVolumeVocals: -12,
    tuningCents: 0,
    animTempo: 0,
    guidePitch: -3.0,
    length: 0,
    previewStart: 0,
    previewEnd: 0,
    yearReleased: 0,
    yearRecorded: 0,
    master: false,
    doubleBass: false,
    karaoke: false,
    multitrack: false,
    diyStems: false,
    partialMultitrack: false,
    unpitchedVocals: false,
    convert: false,
    expertOnly: false,
    rhythmKeys: false,
    rhythmBass: false,
    disableProKeys: false,
    rb3Version: false,
    catemh: false,
    hasSongIDError: false,
    dtaLines: [],
    dtaIndex: 0,
  };
}
