export type Difficulty = "Easy" | "Medium" | "Hard" | "Expert";
export type Instrument =
  | "Single"
  | "DoubleBass"
  | "Drums"
  | "Keyboard"
  | "Vocals"
  | "Harmony1"
  | "Harmony2"
  | "Harmony3";
export type TrackKey = `${Difficulty}${Instrument}`;

export interface NoteFlags {
  forceHopo?: boolean;
  forceStrum?: boolean;
  tap?: boolean;
  // Open note (no fret held) — guitar/bass only
  open?: boolean;
  // Pro Drums flags
  cymbal?: boolean;   // true = cymbal, false/undefined = tom (yellow/blue/green pads)
  accent?: boolean;   // strong hit
  ghost?: boolean;    // soft/ghost hit
  doubleKick?: boolean; // Expert+ double bass kick
}

// 5-lane drum mode (Guitar Hero World Tour style) vs 4-lane (Rock Band)
export type DrumMode = "4lane" | "5lane";

export interface Section {
  id: string;
  tick: number;
  name: string;
  type: "section" | "solo";
}

export interface LyricEvent {
  id: string;
  tick: number | null; // null = unassigned
  text: string;
}

export interface BpmEvent {
  tick: number;
  bpm: number;
  anchor?: boolean; // Anchored BPM — locks this beat to a specific time
}

export interface ChartData {
  metadata: {
    name: string;
    artist: string;
    album: string;
    year: string;
    charter: string;
    resolution: number;
    offset: number;
    genre: string;
  };
  syncTrack: {
    bpmEvents: BpmEvent[];
    timeSignatures: { tick: number; numerator: number; denominator: number }[];
  };
  events: { tick: number; text: string }[];
  sections: Section[];
  lyrics: LyricEvent[];
  tracks: Partial<Record<TrackKey, Track>>;
}

export interface Track {
  difficulty: Difficulty;
  instrument: Instrument;
  notes: Note[];
  phrases: Phrase[];
}

export interface Note {
  id: string;
  tick: number;
  fret: number; // 0-4 (5=open for guitar/bass); drums: 0=kick, 1=red, 2=yellow, 3=blue, 4=green, 5=orange(5-lane)
  length: number;
  flags?: NoteFlags;
}

export interface Phrase {
  id: string;
  tick: number;
  length: number;
  type: "starPower" | "bre" | "tremolo" | "trill";
}

export const FRET_COLORS: Record<number, string> = {
  0: "#22c55e", // green
  1: "#ef4444", // red
  2: "#eab308", // yellow
  3: "#3b82f6", // blue
  4: "#f97316", // orange
  5: "#a855f7", // purple (open note)
  6: "#ffffff", // white (tap)
};

export const DRUM_COLORS: Record<number, string> = {
  0: "#f97316", // kick - orange
  1: "#ef4444", // red pad
  2: "#eab308", // yellow pad/cymbal
  3: "#3b82f6", // blue pad/cymbal
  4: "#22c55e", // green pad/cymbal
  5: "#f97316", // orange (5-lane)
};

// Cymbal colors (lighter variant for pro drums)
export const DRUM_CYMBAL_COLORS: Record<number, string> = {
  2: "#fde047", // yellow cymbal (brighter)
  3: "#60a5fa", // blue cymbal (brighter)
  4: "#4ade80", // green cymbal (brighter)
};

export const INSTRUMENT_LABELS: Record<Instrument, string> = {
  Single: "Guitar",
  DoubleBass: "Bass",
  Drums: "Drums",
  Keyboard: "Keys",
  Vocals: "Vocals",
  Harmony1: "Harmony 1",
  Harmony2: "Harmony 2",
  Harmony3: "Harmony 3",
};

export const DIFFICULTY_ORDER: Difficulty[] = [
  "Easy",
  "Medium",
  "Hard",
  "Expert",
];
export const INSTRUMENT_ORDER: Instrument[] = [
  "Single",
  "DoubleBass",
  "Drums",
  "Keyboard",
  "Vocals",
  "Harmony1",
  "Harmony2",
  "Harmony3",
];

export function makeTrackKey(
  difficulty: Difficulty,
  instrument: Instrument
): TrackKey {
  return `${difficulty}${instrument}` as TrackKey;
}

export function parseTrackKey(
  key: TrackKey
): { difficulty: Difficulty; instrument: Instrument } | null {
  for (const diff of DIFFICULTY_ORDER) {
    for (const inst of INSTRUMENT_ORDER) {
      if (key === `${diff}${inst}`) {
        return { difficulty: diff, instrument: inst };
      }
    }
  }
  return null;
}
