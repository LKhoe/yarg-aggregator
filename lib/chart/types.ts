export type Difficulty = "Easy" | "Medium" | "Hard" | "Expert";
export type Instrument =
  | "Single"
  | "DoubleBass"
  | "Drums"
  | "Keyboard"
  | "Vocals";
export type TrackKey = `${Difficulty}${Instrument}`;

export interface NoteFlags {
  forceHopo?: boolean;
  forceStrum?: boolean;
  tap?: boolean;
}

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
    bpmEvents: { tick: number; bpm: number }[];
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
  fret: number; // 0-6; for drums: 0=kick, 1=red, 2=yellow, 3=blue, 4=green
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
  5: "#a855f7", // purple (open/special)
  6: "#ffffff", // white (tap)
};

export const DRUM_COLORS: Record<number, string> = {
  0: "#f97316", // kick - orange
  1: "#ef4444", // red pad
  2: "#eab308", // yellow pad
  3: "#3b82f6", // blue pad
  4: "#22c55e", // green pad
};

export const INSTRUMENT_LABELS: Record<Instrument, string> = {
  Single: "Guitar",
  DoubleBass: "Bass",
  Drums: "Drums",
  Keyboard: "Keys",
  Vocals: "Vocals",
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
