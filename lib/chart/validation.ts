import type { ChartData, TrackKey, Instrument } from "./types";
import { parseTrackKey } from "./types";

export interface ValidationWarning {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  trackKey?: TrackKey;
  tick?: number;
  noteIds?: string[];
}

const MAX_FRETS: Record<Instrument, number> = {
  Single: 5,
  DoubleBass: 5,
  Drums: 5,
  Keyboard: 5,
  Vocals: 98,
  Harmony1: 98,
  Harmony2: 98,
  Harmony3: 98,
};

let warnId = 0;
function warn(
  severity: ValidationWarning["severity"],
  message: string,
  opts?: { trackKey?: TrackKey; tick?: number; noteIds?: string[] },
): ValidationWarning {
  return { id: `v${++warnId}`, severity, message, ...opts };
}

export function validateChart(chart: ChartData): ValidationWarning[] {
  warnId = 0;
  const warnings: ValidationWarning[] = [];

  // ── Global checks ──

  // BPM at tick 0
  if (
    chart.syncTrack.bpmEvents.length === 0 ||
    chart.syncTrack.bpmEvents[0].tick !== 0
  ) {
    warnings.push(warn("error", "Missing BPM event at tick 0"));
  }

  // Sections
  if (!chart.sections || chart.sections.length === 0) {
    warnings.push(warn("info", "No sections defined — consider adding sections for navigation"));
  }

  // Empty tracks
  for (const [key, track] of Object.entries(chart.tracks)) {
    if (!track) continue;
    if (track.notes.length === 0) {
      warnings.push(
        warn("warning", `Track ${key} has no notes`, { trackKey: key as TrackKey }),
      );
    }
  }

  // ── Per-track checks ──

  for (const [key, track] of Object.entries(chart.tracks)) {
    if (!track) continue;
    const trackKey = key as TrackKey;
    const parsed = parseTrackKey(trackKey);
    if (!parsed) continue;
    const maxFrets = MAX_FRETS[parsed.instrument] ?? 5;

    // Check notes are sorted
    for (let i = 1; i < track.notes.length; i++) {
      if (track.notes[i].tick < track.notes[i - 1].tick) {
        warnings.push(
          warn("error", `Notes are not sorted by tick in ${key}`, { trackKey, tick: track.notes[i].tick }),
        );
        break; // one warning per track
      }
    }

    // Group notes by tick for chord checks
    const notesByTick = new Map<number, typeof track.notes>();
    for (const note of track.notes) {
      const existing = notesByTick.get(note.tick);
      if (existing) existing.push(note);
      else notesByTick.set(note.tick, [note]);
    }

    for (const [tick, notes] of notesByTick) {
      // Overlapping notes: same tick + same fret
      const fretSeen = new Set<number>();
      for (const note of notes) {
        if (fretSeen.has(note.fret)) {
          warnings.push(
            warn("error", `Overlapping notes at tick ${tick}, fret ${note.fret}`, {
              trackKey,
              tick,
              noteIds: notes.filter((n) => n.fret === note.fret).map((n) => n.id),
            }),
          );
          break;
        }
        fretSeen.add(note.fret);
      }

      // Impossible chords
      if (parsed.instrument !== "Vocals" && notes.length > maxFrets) {
        warnings.push(
          warn("error", `Impossible chord at tick ${tick}: ${notes.length} notes (max ${maxFrets})`, {
            trackKey,
            tick,
            noteIds: notes.map((n) => n.id),
          }),
        );
      }
    }

    // Notes outside range
    for (const note of track.notes) {
      if (parsed.instrument === "Vocals") {
        if (note.fret < 36 || (note.fret > 83 && note.fret < 96) || note.fret > 97) {
          warnings.push(
            warn("warning", `Note at tick ${note.tick} has out-of-range pitch ${note.fret}`, {
              trackKey,
              tick: note.tick,
              noteIds: [note.id],
            }),
          );
        }
      } else if (parsed.instrument === "Drums") {
        if (note.fret < 0 || note.fret > 4) {
          warnings.push(
            warn("warning", `Drum note at tick ${note.tick} has invalid lane ${note.fret}`, {
              trackKey,
              tick: note.tick,
              noteIds: [note.id],
            }),
          );
        }
      } else {
        if (note.fret < 0 || note.fret >= maxFrets) {
          warnings.push(
            warn("warning", `Note at tick ${note.tick} has out-of-range fret ${note.fret}`, {
              trackKey,
              tick: note.tick,
              noteIds: [note.id],
            }),
          );
        }
      }
    }

    // Orphan phrases: phrases with no notes inside
    for (const phrase of track.phrases) {
      const phraseEnd = phrase.tick + phrase.length;
      const hasNotes = track.notes.some(
        (n) => n.tick >= phrase.tick && n.tick < phraseEnd,
      );
      if (!hasNotes) {
        warnings.push(
          warn("warning", `${phrase.type} phrase at tick ${phrase.tick} contains no notes`, {
            trackKey,
            tick: phrase.tick,
          }),
        );
      }
    }
  }

  return warnings;
}
