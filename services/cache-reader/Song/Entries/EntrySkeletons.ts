import { FixedArrayStream } from '../../IO/FixedArray';
import { CacheReadStrings } from '../Cache/CacheReadStrings';
import { AbridgedFileInfo } from '../../IO/AbridgedFileInfo';
import { SongEntry } from './SongEntry';
import * as path from 'path';

export { SongEntry };

// Enums and Constants needed
export enum EntryType {
  Ini,
  Sng,
  RBCON,
  RBCON_Upgrade,
  RBCON_Update
}

export class SngEntry extends SongEntry {
  public static TryDeserialize(directory: string, stream: FixedArrayStream, strings: CacheReadStrings): SngEntry | null {
    return null;
  }

  public static ForceDeserialize(directory: string, stream: FixedArrayStream, strings: CacheReadStrings): SngEntry {
    return new SngEntry();
  }
}

export class CONFileListing {
  // Placeholder properties if used
  public PathIndex: number = 0;
  public Name: string = "";
  public BlockOffset: number = 0;
  public Shift: number = 0;
}

export class QuickCONMods {
  public UpdateDirectoryAndDtaLastWrite?: AbridgedFileInfo;
  public UpdateMidi?: bigint;
  public Upgrade?: any;
}

export class RBIntensities {
  public Band: number = -1;
  public FiveFretGuitar: number = -1;
  public FiveFretBass: number = -1;
  public FiveFretRhythm: number = -1;
  public FiveFretCoop: number = -1;
  public Keys: number = -1;
  public FourLaneDrums: number = -1;
  public ProDrums: number = -1;
  public ProGuitar: number = -1;
  public ProBass: number = -1;
  public ProKeys: number = -1;
  public LeadVocals: number = -1;
  public HarmonyVocals: number = -1;

  public static Read(stream: FixedArrayStream): RBIntensities {
    const intensities = new RBIntensities();
    intensities.Band = stream.ReadInt16AsLittleEndian();
    intensities.FiveFretGuitar = stream.ReadInt16AsLittleEndian();
    intensities.FiveFretBass = stream.ReadInt16AsLittleEndian();
    intensities.FiveFretRhythm = stream.ReadInt16AsLittleEndian();
    intensities.FiveFretCoop = stream.ReadInt16AsLittleEndian();
    intensities.Keys = stream.ReadInt16AsLittleEndian();
    intensities.FourLaneDrums = stream.ReadInt16AsLittleEndian();
    intensities.ProDrums = stream.ReadInt16AsLittleEndian();
    intensities.ProGuitar = stream.ReadInt16AsLittleEndian();
    intensities.ProBass = stream.ReadInt16AsLittleEndian();
    intensities.ProKeys = stream.ReadInt16AsLittleEndian();
    intensities.LeadVocals = stream.ReadInt16AsLittleEndian();
    intensities.HarmonyVocals = stream.ReadInt16AsLittleEndian();
    return intensities;
  }
}

export class RBCONEntry extends SongEntry {
  // RB fields
  public _subName: string = "";
  public _yearAsNumber: number = 0;
  public _rbIntensities: RBIntensities = new RBIntensities();

  // Metadata fields (simplified for skeleton)
  public _rbMetadata: any = {};

  public Deserialize(stream: FixedArrayStream, strings: CacheReadStrings): void {
    super.Deserialize(stream, strings);
    this._yearAsNumber = stream.ReadInt32AsLittleEndian();

    this._rbIntensities = RBIntensities.Read(stream);

    this._rbMetadata.VocalGender = stream.ReadByte();
    this._rbMetadata.SongTonality = stream.ReadByte();
    this._rbMetadata.MidiEncoding = stream.ReadByte();

    this._rbMetadata.AnimTempo = stream.ReadUInt32AsLittleEndian();
    this._rbMetadata.VocalSongScrollSpeed = stream.ReadUInt32AsLittleEndian();
    this._rbMetadata.VocalTonicNote = stream.ReadUInt32AsLittleEndian();
    this._rbMetadata.TuningOffsetCents = stream.ReadInt32AsLittleEndian();
    this._rbMetadata.VenueVersion = stream.ReadUInt32AsLittleEndian();

    this._rbMetadata.SongID = stream.ReadString();
    this._rbMetadata.VocalPercussionBank = stream.ReadString();
    this._rbMetadata.DrumBank = stream.ReadString();

    // Skipped arrays...
  }

  public UpdateInfo(updateDir: any, updateMidi: any, upgrade: any) { }
}

export class PackedRBCONEntry extends RBCONEntry {
  private _midiListing?: CONFileListing;
  private _moggListing?: CONFileListing;
  private _miloListing?: CONFileListing;
  private _imgListing?: CONFileListing;
  private _psuedoDirectory: string = "";

  constructor(root: any, name: string) {
    super();
    // Base logic
  }

  public static ForceDeserialize(listings: CONFileListing[] | null, root: AbridgedFileInfo, name: string, stream: FixedArrayStream, strings: CacheReadStrings): RBCONEntry {
    const entry = new PackedRBCONEntry(root, name);
    entry._subName = stream.ReadString();

    entry.Deserialize(stream, strings);

    entry._psuedoDirectory = path.join(root.FullName, `songs/${entry._subName}`);

    if (listings) {
      const location = `songs/${entry._subName}/${entry._subName}`;
      // Listings search logic placeholder
      // listings.FindListing(location + ".mid", out entry._midiListing);
      // listings.FindListing(location + ".mogg", out entry._moggListing);

      const genPath = `songs/${entry._subName}/gen/${entry._subName}`;
      // listings.FindListing(genPath + ".milo_xbox", out entry._miloListing);
      // listings.FindListing(genPath + "_keep.png_xbox", out entry._imgListing);
    }

    return entry;
  }
}

export class UnpackedRBCONEntry extends RBCONEntry {
  public _midiLastWrite: bigint = BigInt(0);

  constructor(root: any, name: string) {
    super();
  }

  public static ForceDeserialize(root: any, name: string, stream: FixedArrayStream, strings: CacheReadStrings): RBCONEntry {
    const entry = new UnpackedRBCONEntry(root, name);
    entry._subName = stream.ReadString();
    entry._midiLastWrite = stream.ReadInt64AsLittleEndian();

    entry.Deserialize(stream, strings);

    return entry;
  }
}

export class UnpackedRBProUpgrade {
  public LastWriteTime: bigint;
  constructor(name: string, midiLastWrite: bigint, root: AbridgedFileInfo) {
    this.LastWriteTime = midiLastWrite;
  }
}

export class PackedRBProUpgrade {
  public static readonly UPGRADES_DIRECTORY = "upgrades/";
  public static readonly UPGRADES_MIDI_EXT = ".mid";

  public LastWriteTime: Date;
  constructor(listing: any, root: AbridgedFileInfo) {
    this.LastWriteTime = AbridgedFileInfo.DateTimeFromBinary(BigInt(root.LastWriteTime.getTime()));
  }
}
