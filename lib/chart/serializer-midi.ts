import { Midi } from "@tonejs/midi";
import type { ChartData, Difficulty, Instrument, Track } from "./types";

// Instrument → MIDI track name
const INSTRUMENT_TRACK_NAMES: Record<Instrument, string> = {
  Single: "PART GUITAR",
  DoubleBass: "PART BASS",
  Drums: "PART DRUMS",
  Keyboard: "PART KEYS",
  Vocals: "PART VOCALS",
};

// Difficulty → base MIDI pitch for 5-fret instruments
const DIFFICULTY_BASE_PITCH: Record<Difficulty, number> = {
  Easy: 60,
  Medium: 72,
  Hard: 84,
  Expert: 96,
};

interface TrackGroup {
  instrument: Instrument;
  difficulties: Partial<Record<Difficulty, Track>>;
}

export function serializeMidi(chart: ChartData): Uint8Array {
  const midi = new Midi();
  const firstBpm = chart.syncTrack.bpmEvents[0]?.bpm ?? 120;
  midi.header.setTempo(firstBpm);

  // Add tempo events
  for (const ev of chart.syncTrack.bpmEvents) {
    if (ev.tick === 0) {
      if (midi.header.tempos[0]) {
        midi.header.tempos[0].bpm = ev.bpm;
        midi.header.tempos[0].ticks = 0;
      }
    } else {
      midi.header.tempos.push({ ticks: ev.tick, bpm: ev.bpm });
    }
  }

  // Add time signatures
  for (const ts of chart.syncTrack.timeSignatures) {
    midi.header.timeSignatures.push({
      ticks: ts.tick,
      timeSignature: [ts.numerator, ts.denominator],
    });
  }

  // Group tracks by instrument
  const trackGroups: Partial<Record<Instrument, TrackGroup>> = {};

  for (const track of Object.values(chart.tracks)) {
    if (!track) continue;
    const { instrument, difficulty } = track;
    if (!trackGroups[instrument]) {
      trackGroups[instrument] = { instrument, difficulties: {} };
    }
    trackGroups[instrument]!.difficulties[difficulty] = track;
  }

  for (const group of Object.values(trackGroups)) {
    if (!group) continue;
    const midiTrack = midi.addTrack();
    midiTrack.name = INSTRUMENT_TRACK_NAMES[group.instrument];
    const isDrums = group.instrument === "Drums";

    const allNotes: { ticks: number; durationTicks: number; midi: number }[] = [];
    const starPowerRanges: { tick: number; length: number }[] = [];

    for (const [diff, track] of Object.entries(group.difficulties) as [
      Difficulty,
      Track,
    ][]) {
      if (!track) continue;
      const base = DIFFICULTY_BASE_PITCH[diff];
      for (const note of track.notes) {
        allNotes.push({
          ticks: note.tick,
          durationTicks: Math.max(1, note.length),
          midi: base + note.fret,
        });
      }
      for (const phrase of track.phrases) {
        if (phrase.type === "starPower") {
          const exists = starPowerRanges.some(
            (sp) => sp.tick === phrase.tick && sp.length === phrase.length
          );
          if (!exists) {
            starPowerRanges.push({ tick: phrase.tick, length: phrase.length });
          }
        }
      }
    }

    // Add star power notes at pitch 116
    for (const sp of starPowerRanges) {
      allNotes.push({ ticks: sp.tick, durationTicks: sp.length, midi: 116 });
    }

    allNotes.sort((a, b) => a.ticks - b.ticks);
    for (const n of allNotes) {
      midiTrack.addNote({
        ticks: n.ticks,
        durationTicks: n.durationTicks,
        midi: n.midi,
        velocity: 100 / 127,
      });
    }
  }

  return midi.toArray();
}

export function downloadMidi(chart: ChartData, filename = "notes.mid"): void {
  const bytes = serializeMidi(chart);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
