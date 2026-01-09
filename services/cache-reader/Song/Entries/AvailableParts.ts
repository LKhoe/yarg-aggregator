export enum DifficultyMask {
  None = 0,
  Easy = 1 << 0,
  Medium = 1 << 1,
  Hard = 1 << 2,
  Expert = 1 << 3,
  ExpertPlus = 1 << 4,
}

export class PartValues {
  public SubTracks: number = 0;
  public Difficulties: DifficultyMask = DifficultyMask.None;
  public Intensity: number = -1;

  public static FromBytes(data: Uint8Array): PartValues {
    if (data.length < 2) throw new Error("Insufficient data for PartValues");

    // Layout: 
    // Byte 0: SubTracks (and explicitly overlaid Difficulties)
    // Byte 1: Intensity (sbyte)

    const pv = new PartValues();
    pv.SubTracks = data[0];
    pv.Difficulties = data[0] as DifficultyMask;

    // Intensity is sbyte (signed 8-bit)
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    pv.Intensity = view.getInt8(1);

    return pv;
  }
}

export class AvailableParts {
  public BandDifficulty: PartValues = new PartValues();
  public FiveFretGuitar: PartValues = new PartValues();
  public FiveFretBass: PartValues = new PartValues();
  public FiveFretRhythm: PartValues = new PartValues();
  public FiveFretCoopGuitar: PartValues = new PartValues();
  public Keys: PartValues = new PartValues();

  public SixFretGuitar: PartValues = new PartValues();
  public SixFretBass: PartValues = new PartValues();
  public SixFretRhythm: PartValues = new PartValues();
  public SixFretCoopGuitar: PartValues = new PartValues();

  public FourLaneDrums: PartValues = new PartValues();
  public ProDrums: PartValues = new PartValues();
  public FiveLaneDrums: PartValues = new PartValues();

  public EliteDrums: PartValues = new PartValues();

  public ProGuitar_17Fret: PartValues = new PartValues();
  public ProGuitar_22Fret: PartValues = new PartValues();
  public ProBass_17Fret: PartValues = new PartValues();
  public ProBass_22Fret: PartValues = new PartValues();

  public ProKeys: PartValues = new PartValues();

  public LeadVocals: PartValues = new PartValues();
  public HarmonyVocals: PartValues = new PartValues();

  public static FromBytes(data: Uint8Array): AvailableParts {
    // Total size 42 bytes. 
    // 21 parts * 2 bytes each.
    const ap = new AvailableParts();
    let offset = 0;
    const next = () => {
      const pv = PartValues.FromBytes(data.subarray(offset, offset + 2));
      offset += 2;
      return pv;
    };

    ap.BandDifficulty = next();
    ap.FiveFretGuitar = next();
    ap.FiveFretBass = next();
    ap.FiveFretRhythm = next();
    ap.FiveFretCoopGuitar = next();
    ap.Keys = next();

    ap.SixFretGuitar = next();
    ap.SixFretBass = next();
    ap.SixFretRhythm = next();
    ap.SixFretCoopGuitar = next();

    ap.FourLaneDrums = next();
    ap.ProDrums = next();
    ap.FiveLaneDrums = next();

    ap.EliteDrums = next();

    ap.ProGuitar_17Fret = next();
    ap.ProGuitar_22Fret = next();
    ap.ProBass_17Fret = next();
    ap.ProBass_22Fret = next();

    ap.ProKeys = next();

    ap.LeadVocals = next();
    ap.HarmonyVocals = next();

    return ap;
  }
}
