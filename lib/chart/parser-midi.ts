import { Midi } from "@tonejs/midi";
import { parseMidi as parseMidiRaw } from "midi-file";
import { v4 as uuidv4 } from "uuid";
import type {
  ChartData,
  Difficulty,
  Instrument,
  LyricEvent,
  Note,
  Phrase,
  Track,
  TrackKey,
} from "./types";
import { makeTrackKey } from "./types";

// MIDI track name → Instrument
const TRACK_NAME_MAP: Record<string, Instrument> = {
  "PART GUITAR": "Single",
  "PART BASS": "DoubleBass",
  "PART DRUMS": "Drums",
  "PART KEYS": "Keyboard",
  "PART VOCALS": "Vocals",
  // aliases
  "PART RHYTHM": "DoubleBass",
};

// Each difficulty has a base note pitch for 5-fret instruments
// Expert: 96-100, Hard: 84-88, Medium: 72-76, Easy: 60-64
const DIFFICULTY_PITCH_RANGES: {
  difficulty: Difficulty;
  base: number;
  frets: number;
}[] = [
  { difficulty: "Expert", base: 96, frets: 5 },
  { difficulty: "Hard", base: 84, frets: 5 },
  { difficulty: "Medium", base: 72, frets: 5 },
  { difficulty: "Easy", base: 60, frets: 5 },
];

// Drum pitch map (Expert difficulty base pitches)
const DRUM_PITCH_MAP: Record<number, { difficulty: Difficulty; fret: number }[]> = {};
(function buildDrumMap() {
  // Drums use:
  // Expert: kick=96, red=97, yellow=98, blue=99, green=100
  // Hard:   kick=84, red=85, yellow=86, blue=87, green=88
  // Medium: kick=72, red=73, yellow=74, blue=75, green=76
  // Easy:   kick=60, red=61, yellow=62, blue=63, green=64
  const diffs: Difficulty[] = ["Expert", "Hard", "Medium", "Easy"];
  const bases = [96, 84, 72, 60];
  for (let i = 0; i < diffs.length; i++) {
    for (let fret = 0; fret <= 4; fret++) {
      const pitch = bases[i] + fret;
      if (!DRUM_PITCH_MAP[pitch]) DRUM_PITCH_MAP[pitch] = [];
      DRUM_PITCH_MAP[pitch].push({ difficulty: diffs[i], fret });
    }
  }
})();

function pitchToNote(
  pitch: number,
  isDrums: boolean
): { difficulty: Difficulty; fret: number } | null {
  if (isDrums) {
    const matches = DRUM_PITCH_MAP[pitch];
    return matches?.[0] ?? null;
  }
  for (const range of DIFFICULTY_PITCH_RANGES) {
    if (pitch >= range.base && pitch < range.base + range.frets) {
      return { difficulty: range.difficulty, fret: pitch - range.base };
    }
  }
  return null;
}

export function parseMidi(buffer: ArrayBuffer): ChartData {
  const midi = new Midi(buffer);

  const resolution = midi.header.ppq;

  // Build BPM events from tempo map
  const bpmEvents: { tick: number; bpm: number }[] = midi.header.tempos.map(
    (t) => ({
      tick: Math.round(t.ticks),
      bpm: t.bpm,
    })
  );

  if (bpmEvents.length === 0) {
    bpmEvents.push({ tick: 0, bpm: 120 });
  }

  // Build time signatures
  const timeSignatures: {
    tick: number;
    numerator: number;
    denominator: number;
  }[] = midi.header.timeSignatures.map((ts) => ({
    tick: Math.round(ts.ticks),
    numerator: ts.timeSignature[0],
    denominator: ts.timeSignature[1],
  }));

  if (timeSignatures.length === 0) {
    timeSignatures.push({ tick: 0, numerator: 4, denominator: 4 });
  }

  // Extract lyric meta events from raw MIDI PART VOCALS track
  const lyrics: LyricEvent[] = [];
  try {
    const rawMidi = parseMidiRaw(new Uint8Array(buffer));
    for (const rawTrack of rawMidi.tracks) {
      const nameEvent = rawTrack.find((e) => e.type === "trackName");
      if (!nameEvent || !("text" in nameEvent)) continue;
      if ((nameEvent as { text: string }).text.toUpperCase() !== "PART VOCALS") continue;
      let absTick = 0;
      for (const event of rawTrack) {
        absTick += event.deltaTime;
        if (event.type === "lyrics" && "text" in event) {
          lyrics.push({
            id: uuidv4(),
            tick: absTick,
            text: (event as { text: string }).text,
          });
        }
      }
      break;
    }
  } catch {
    // Ignore raw parse errors — lyric extraction is best-effort
  }

  const chart: ChartData = {
    metadata: {
      name: "",
      artist: "",
      album: "",
      year: "",
      charter: "",
      resolution,
      offset: 0,
      genre: "",
    },
    syncTrack: { bpmEvents, timeSignatures },
    events: [],
    sections: [],
    lyrics,
    tracks: {},
  };

  // Process each MIDI track
  for (const track of midi.tracks) {
    const name = track.name.toUpperCase();
    const instrument = TRACK_NAME_MAP[name];
    if (!instrument) continue;

    const isDrums = instrument === "Drums";

    // Group notes by difficulty
    const tracksByDiff: Partial<
      Record<Difficulty, { notes: Note[]; phrases: Phrase[] }>
    > = {};

    for (const midiNote of track.notes) {
      const tick = Math.round(midiNote.ticks);
      const durationTicks = Math.round(midiNote.durationTicks);
      const pitch = midiNote.midi;

      // Vocals: handle separately — fret values ARE raw MIDI pitches
      if (instrument === "Vocals") {
        if (pitch === 116) {
          // Star power phrase for ExpertVocals only
          if (!tracksByDiff["Expert"]) tracksByDiff["Expert"] = { notes: [], phrases: [] };
          tracksByDiff["Expert"]!.phrases.push({ id: uuidv4(), tick, length: durationTicks, type: "starPower" });
          continue;
        }
        const isVocalPitch = (pitch >= 36 && pitch <= 83) || pitch === 96 || pitch === 97;
        if (!isVocalPitch) continue;
        if (!tracksByDiff["Expert"]) tracksByDiff["Expert"] = { notes: [], phrases: [] };
        tracksByDiff["Expert"]!.notes.push({ id: uuidv4(), tick, fret: pitch, length: durationTicks });
        continue;
      }

      // Star power: pitch 116
      if (pitch === 116) {
        // Add to all difficulties as a phrase
        for (const diff of ["Easy", "Medium", "Hard", "Expert"] as Difficulty[]) {
          if (!tracksByDiff[diff]) {
            tracksByDiff[diff] = { notes: [], phrases: [] };
          }
          tracksByDiff[diff]!.phrases.push({
            id: uuidv4(),
            tick,
            length: durationTicks,
            type: "starPower",
          });
        }
        continue;
      }

      const mapped = pitchToNote(pitch, isDrums);
      if (!mapped) continue;

      const { difficulty, fret } = mapped;
      if (!tracksByDiff[difficulty]) {
        tracksByDiff[difficulty] = { notes: [], phrases: [] };
      }

      tracksByDiff[difficulty]!.notes.push({
        id: uuidv4(),
        tick,
        fret,
        length: durationTicks,
      });
    }

    // Store tracks into chart
    for (const [diff, data] of Object.entries(tracksByDiff) as [
      Difficulty,
      { notes: Note[]; phrases: Phrase[] },
    ][]) {
      if (data.notes.length === 0 && data.phrases.length === 0) continue;
      const key: TrackKey = makeTrackKey(diff, instrument);
      data.notes.sort((a, b) => a.tick - b.tick);
      chart.tracks[key] = {
        difficulty: diff,
        instrument,
        notes: data.notes,
        phrases: data.phrases,
      };
    }
  }

  return chart;
}
