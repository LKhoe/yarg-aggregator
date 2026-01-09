import { FixedArray, FixedArrayStream } from '../../IO/FixedArray';
import { CacheReadStrings } from './CacheReadStrings';
import { CacheLoopable } from './CacheLoopable';
import { AbridgedFileInfo } from '../../IO/AbridgedFileInfo';
import {
  SongEntry,
  SngEntry,
  QuickCONMods,
  PackedRBCONEntry,
  UnpackedRBCONEntry,
  PackedRBProUpgrade,
  UnpackedRBProUpgrade
} from '../Entries/EntrySkeletons';
import { UnpackedIniEntry } from '../Entries/UnpackedIniEntry';

export class ScanProgressTracker {
  public Stage: number = 0;
  public Count: number = 0;
  public NumScannedDirectories: number = 0;
  public BadSongCount: number = 0;
}

export class CacheHandler {
  private static readonly CACHE_VERSION = 25031401; // 25_03_14_01
  private static _progress: ScanProgressTracker = new ScanProgressTracker();

  public cacheEntries: SongEntry[] = [];
  public cacheCONModifications: Map<string, QuickCONMods> = new Map();

  public static get Progress(): ScanProgressTracker {
    return this._progress;
  }

  public static async QuickScan(handler: CacheHandler, cacheLocation: File, fullDirectoryPlaylists: boolean): Promise<boolean> {
    try {
      const cacheFile = await CacheHandler.LoadCacheToMemory(cacheLocation, fullDirectoryPlaylists);
      if (cacheFile != null) {
        // _progress.Stage = ScanStage.LoadingCache;
        handler.Deserialize_Quick(cacheFile);
      }
    } catch (ex) {
      console.error("Error occurred during quick cache file read!", ex);
    }

    if (handler.cacheEntries.length === 0) {
      return false;
    }

    return true;
  }

  private static async LoadCacheToMemory(cacheLocation: File, fullDirectoryPlaylists: boolean): Promise<FixedArray | null> {
    // File object - check if it exists and has content
    if (cacheLocation.size === 0) {
      console.log("Cache file is empty");
      return null;
    }

    // For File object, read as ArrayBuffer and convert to Buffer
    const arrayBuffer = await cacheLocation.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check version
    // We need to read the first 4 bytes as int
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const version = view.getInt32(0, true);

    if (version !== CacheHandler.CACHE_VERSION) {
      console.log("Cache outdated");
      return null;
    }

    const fullDirFlag = view.getUint8(4) !== 0;
    if (fullDirFlag !== fullDirectoryPlaylists) {
      console.log("FullDirectoryFlag flipped");
      return null;
    }

    // Skip first 5 bytes
    const data = buffer.subarray(5);
    return new FixedArray(data);
  }

  public Deserialize_Quick(data: FixedArray): void {
    const stream = data.ToValueStream();
    const strings = new CacheReadStrings(stream);

    for (const node of new CacheLoopable(stream)) {
      this.QuickReadUpdateDirectory(node.Slice);
    }

    for (const node of new CacheLoopable(stream)) {
      this.QuickReadUpgradeDirectory(node.Slice);
    }

    for (const node of new CacheLoopable(stream)) {
      this.QuickReadUpgradeCON(node.Slice);
    }

    for (const node of new CacheLoopable(stream)) {
      this.QuickReadIniDirectory(node.Slice, strings);
    }

    for (const node of new CacheLoopable(stream)) {
      this.QuickReadCONGroup(node.Slice, strings);
    }
  }

  private QuickReadUpdateDirectory(stream: FixedArrayStream): void {
    // Implementation matching CacheHandler.cs
    const root = AbridgedFileInfo.FromStream(stream);
    const count = stream.ReadInt32AsLittleEndian();
    for (let i = 0; i < count; i++) {
      const name = stream.ReadString();
      let midiLastWrite: bigint | undefined = undefined;
      if (stream.ReadBoolean()) {
        midiLastWrite = stream.ReadInt64AsLittleEndian();
      }

      const mods = this.GetQuickCONMods(name);
      // Lock handled by JS single thread
      if (!mods.UpdateDirectoryAndDtaLastWrite || mods.UpdateDirectoryAndDtaLastWrite.LastWriteTime < root.LastWriteTime) {
        mods.UpdateDirectoryAndDtaLastWrite = root;
        mods.UpdateMidi = midiLastWrite;
      }
    }
  }

  private QuickReadUpgradeDirectory(stream: FixedArrayStream): void {
    const root = AbridgedFileInfo.FromStream(stream);
    const count = stream.ReadInt32AsLittleEndian();
    for (let i = 0; i < count; i++) {
      const name = stream.ReadString();
      const midiLastWrite = stream.ReadInt64AsLittleEndian();

      const mods = this.GetQuickCONMods(name);
      if (!mods.Upgrade || mods.Upgrade.LastWriteTime < midiLastWrite) {
        mods.Upgrade = new UnpackedRBProUpgrade(name, midiLastWrite, root);
      }
    }
  }

  private QuickReadUpgradeCON(stream: FixedArrayStream): void {
    const root = AbridgedFileInfo.FromStream(stream);
    const listings = this.GetCacheCONListings(root.FullName);
    const count = stream.ReadInt32AsLittleEndian();
    for (let i = 0; i < count; i++) {
      const name = stream.ReadString();
      // listings find etc.
      // Simplified logic:
      const mods = this.GetQuickCONMods(name);
      if (!mods.Upgrade || mods.Upgrade.LastWriteTime < root.LastWriteTime) {
        mods.Upgrade = new PackedRBProUpgrade(null, root);
      }
    }
  }

  private QuickReadIniDirectory(stream: FixedArrayStream, strings: CacheReadStrings): void {
    const directory = stream.ReadString();
    const loop1 = new CacheLoopable(stream);
    for (const node of loop1) {
      const entry = UnpackedIniEntry.ForceDeserialize(directory, node.Slice, strings);
      this.AddEntry(entry);
    }
    const loop2 = new CacheLoopable(stream);
    for (const node of loop2) {
      this.AddEntry(SngEntry.ForceDeserialize(directory, node.Slice, strings));
    }
  }

  private QuickReadCONGroup(stream: FixedArrayStream, strings: CacheReadStrings): void {
    const root = AbridgedFileInfo.FromStream(stream);
    const packed = stream.ReadBoolean();

    let listings: any[] | null = null;
    if (packed) {
      listings = this.GetCacheCONListings(root.FullName);
    }

    
    const loop = new CacheLoopable(stream);
    for (const node of loop) {
      const name = node.Slice.ReadString();
      const index = node.Slice.ReadByte();
      
      const entry = packed
        ? PackedRBCONEntry.ForceDeserialize(listings, root, name, node.Slice, strings)
        : UnpackedRBCONEntry.ForceDeserialize(root, name, node.Slice, strings);

      const mods = this.cacheCONModifications.get(name);
      if (mods) {
        entry.UpdateInfo(mods.UpdateDirectoryAndDtaLastWrite, mods.UpdateMidi, mods.Upgrade);
      }
      this.AddEntry(entry);
    }
  }

  private AddEntry(entry: SongEntry): void {
    this.cacheEntries.push(entry);
    CacheHandler._progress.Count++;
  }

  private GetQuickCONMods(name: string): QuickCONMods {
    let mods = this.cacheCONModifications.get(name);
    if (!mods) {
      mods = new QuickCONMods();
      this.cacheCONModifications.set(name, mods);
    }
    return mods;
  }

  private GetCacheCONListings(filename: string): any[] | null {
    // Placeholder
    return null;
  }
}
