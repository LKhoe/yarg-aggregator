import { FixedArrayStream } from '../../IO/FixedArray';
import { CacheReadStrings } from '../Cache/CacheReadStrings';
import { AvailableParts } from './AvailableParts';

export interface SongMetadata {
  Name: string;
  Artist: string;
  Album: string;
  Genre: string;
  Year: string;
  Charter: string;
  Playlist: string;
  Source: string;
  IsMaster: boolean;
  VideoLoop: boolean;
  AlbumTrack: number;
  PlaylistTrack: number;
  SongLength: bigint;
  SongOffset: bigint;
  SongRating: number;
  PreviewStart: bigint;
  PreviewEnd: bigint;
  VideoStart: bigint;
  VideoEnd: bigint;
  LoadingPhrase: string;
  LinkBandcamp: string;
  LinkBluesky: string;
  LinkFacebook: string;
  LinkInstagram: string;
  LinkNewgrounds: string;
  LinkSoundcloud: string;
  LinkSpotify: string;
  LinkTiktok: string;
  LinkTwitter: string;
  LinkOther: string;
  LinkYoutube: string;
  Location: string;
  // Credits
  CreditAlbumArtDesignedBy: string;
  CreditArrangedBy: string;
  CreditComposedBy: string;
  CreditCourtesyOf: string;
  CreditEngineeredBy: string;
  CreditLicense: string;
  CreditMasteredBy: string;
  CreditMixedBy: string;
  CreditOther: string;
  CreditPerformedBy: string;
  CreditProducedBy: string;
  CreditPublishedBy: string;
  CreditWrittenBy: string;
  // Charter info
  CharterBass: string;
  CharterDrums: string;
  CharterEliteDrums: string;
  CharterGuitar: string;
  CharterKeys: string;
  CharterLowerDiff: string;
  CharterProBass: string;
  CharterProKeys: string;
  CharterProGuitar: string;
  CharterVenue: string;
  CharterVocals: string;
}

export abstract class SongEntry {
  public _metadata: SongMetadata = {
    Name: "", Artist: "", Album: "", Genre: "", Year: "", Charter: "", Playlist: "", Source: "",
    IsMaster: false, VideoLoop: false, AlbumTrack: 0, PlaylistTrack: 0,
    SongLength: BigInt(0), SongOffset: BigInt(0), SongRating: 0,
    PreviewStart: BigInt(0), PreviewEnd: BigInt(0), VideoStart: BigInt(0), VideoEnd: BigInt(0),
    LoadingPhrase: "", LinkBandcamp: "", LinkBluesky: "", LinkFacebook: "", LinkInstagram: "",
    LinkNewgrounds: "", LinkSoundcloud: "", LinkSpotify: "", LinkTiktok: "", LinkTwitter: "",
    LinkOther: "", LinkYoutube: "", Location: "",
    CreditAlbumArtDesignedBy: "", CreditArrangedBy: "", CreditComposedBy: "", CreditCourtesyOf: "",
    CreditEngineeredBy: "", CreditLicense: "", CreditMasteredBy: "", CreditMixedBy: "", CreditOther: "",
    CreditPerformedBy: "", CreditProducedBy: "", CreditPublishedBy: "", CreditWrittenBy: "",
    CharterBass: "", CharterDrums: "", CharterEliteDrums: "", CharterGuitar: "", CharterKeys: "",
    CharterLowerDiff: "", CharterProBass: "", CharterProKeys: "", CharterProGuitar: "", CharterVenue: "", CharterVocals: ""
  };

  public _parts: AvailableParts = new AvailableParts();
  public _hash: Uint8Array = new Uint8Array(0);

  // Calculated sizes
  private static readonly HASH_SIZE = 20;
  private static readonly AVAILABLE_PARTS_SIZE = 42;

  protected Deserialize(stream: FixedArrayStream, strings: CacheReadStrings): void {
    const hashStream = stream.Slice(SongEntry.HASH_SIZE);
    this._hash = hashStream.ToBuffer(); // Need to implement ToBuffer or just use internal buffer

    const partsStream = stream.Slice(SongEntry.AVAILABLE_PARTS_SIZE);
    this._parts = AvailableParts.FromBytes(partsStream.ToBuffer());

    this._metadata.Name = strings.Titles[stream.ReadInt32AsLittleEndian()]; // Assuming generic Read<int> is 4 bytes LE
    this._metadata.Artist = strings.Artists[stream.ReadInt32AsLittleEndian()];
    this._metadata.Album = strings.Albums[stream.ReadInt32AsLittleEndian()];
    this._metadata.Genre = strings.Genres[stream.ReadInt32AsLittleEndian()];
    this._metadata.Year = strings.Years[stream.ReadInt32AsLittleEndian()];
    this._metadata.Charter = strings.Charters[stream.ReadInt32AsLittleEndian()];
    this._metadata.Playlist = strings.Playlists[stream.ReadInt32AsLittleEndian()];
    this._metadata.Source = strings.Sources[stream.ReadInt32AsLittleEndian()];

    this._metadata.IsMaster = stream.ReadBoolean();
    this._metadata.VideoLoop = stream.ReadBoolean();

    this._metadata.AlbumTrack = stream.ReadInt32AsLittleEndian();
    this._metadata.PlaylistTrack = stream.ReadInt32AsLittleEndian();

    this._metadata.SongLength = stream.ReadInt64AsLittleEndian();
    this._metadata.SongOffset = stream.ReadInt64AsLittleEndian();
    // SongRating is uint, assuming 4 bytes
    this._metadata.SongRating = stream.ReadUInt32AsLittleEndian();

    this._metadata.PreviewStart = stream.ReadInt64AsLittleEndian();
    this._metadata.PreviewEnd = stream.ReadInt64AsLittleEndian();

    this._metadata.VideoStart = stream.ReadInt64AsLittleEndian();
    this._metadata.VideoEnd = stream.ReadInt64AsLittleEndian();

    this._metadata.LoadingPhrase = stream.ReadString();

    this._metadata.LinkBandcamp = stream.ReadString();
    this._metadata.LinkBluesky = stream.ReadString();
    this._metadata.LinkFacebook = stream.ReadString();
    this._metadata.LinkInstagram = stream.ReadString();
    this._metadata.LinkNewgrounds = stream.ReadString();
    this._metadata.LinkSoundcloud = stream.ReadString();
    this._metadata.LinkSpotify = stream.ReadString();
    this._metadata.LinkTiktok = stream.ReadString();
    this._metadata.LinkTwitter = stream.ReadString();
    this._metadata.LinkOther = stream.ReadString();
    this._metadata.LinkYoutube = stream.ReadString();

    this._metadata.Location = stream.ReadString();

    this._metadata.CreditAlbumArtDesignedBy = stream.ReadString();
    this._metadata.CreditArrangedBy = stream.ReadString();
    this._metadata.CreditComposedBy = stream.ReadString();
    this._metadata.CreditCourtesyOf = stream.ReadString();
    this._metadata.CreditEngineeredBy = stream.ReadString();
    this._metadata.CreditLicense = stream.ReadString();
    this._metadata.CreditMasteredBy = stream.ReadString();
    this._metadata.CreditMixedBy = stream.ReadString();
    this._metadata.CreditOther = stream.ReadString();
    this._metadata.CreditPerformedBy = stream.ReadString();
    this._metadata.CreditProducedBy = stream.ReadString();
    this._metadata.CreditPublishedBy = stream.ReadString();
    this._metadata.CreditWrittenBy = stream.ReadString();

    this._metadata.CharterBass = stream.ReadString();
    this._metadata.CharterDrums = stream.ReadString();
    this._metadata.CharterEliteDrums = stream.ReadString();
    this._metadata.CharterGuitar = stream.ReadString();
    this._metadata.CharterKeys = stream.ReadString();
    this._metadata.CharterLowerDiff = stream.ReadString();
    this._metadata.CharterProBass = stream.ReadString();

    //this._metadata.CharterProKeys = stream.ReadString();
    // Commented out in C# too
    // _metadata.CharterProGuitar = stream.ReadString();
    // _metadata.CharterVenue = stream.ReadString();
    // _metadata.CharterVocals = stream.ReadString();

    // Commented out in C# too
    // _settings.HopoThreshold
    // ...

    // No hash recalc or setting sort strings needed for just reading.
  }

  public toString(): string {
    return `${this._metadata.Artist} - ${this._metadata.Name}`;
  }
}
