import type { Note, Track } from "./types";

/**
 * Shift all notes by a tick delta.
 */
export function shiftNotes(notes: Note[], deltaTick: number): Note[] {
  return notes.map((n) => ({
    ...n,
    tick: Math.max(0, n.tick + deltaTick),
  }));
}

/**
 * Scale note timing around an anchor point.
 * factor = 2 means double the spacing, 0.5 means half.
 */
export function scaleNotes(notes: Note[], factor: number, anchorTick: number): Note[] {
  return notes.map((n) => ({
    ...n,
    tick: Math.max(0, Math.round(anchorTick + (n.tick - anchorTick) * factor)),
    length: Math.max(0, Math.round(n.length * factor)),
  }));
}

/**
 * Quantize notes to the nearest grid position.
 */
export function quantizeNotes(notes: Note[], gridTicks: number): Note[] {
  if (gridTicks <= 0) return notes;
  return notes.map((n) => ({
    ...n,
    tick: Math.round(n.tick / gridTicks) * gridTicks,
  }));
}

/**
 * Selection criteria for filtering notes.
 */
export interface SelectionCriteria {
  frets?: number[];
  tickRange?: { min: number; max: number };
  hasFlag?: "forceHopo" | "forceStrum" | "tap";
  hasSustain?: boolean;
  minChordSize?: number;
}

/**
 * Filter notes matching criteria, return their IDs.
 */
export function filterByType(track: Track, criteria: SelectionCriteria): string[] {
  // Build tick groups for chord detection
  const tickGroups = new Map<number, Note[]>();
  if (criteria.minChordSize) {
    for (const n of track.notes) {
      const group = tickGroups.get(n.tick);
      if (group) group.push(n);
      else tickGroups.set(n.tick, [n]);
    }
  }

  return track.notes
    .filter((n) => {
      if (criteria.frets && !criteria.frets.includes(n.fret)) return false;
      if (criteria.tickRange) {
        if (n.tick < criteria.tickRange.min || n.tick > criteria.tickRange.max) return false;
      }
      if (criteria.hasFlag) {
        if (!n.flags?.[criteria.hasFlag]) return false;
      }
      if (criteria.hasSustain !== undefined) {
        const isSustain = n.length > 0;
        if (criteria.hasSustain !== isSustain) return false;
      }
      if (criteria.minChordSize) {
        const group = tickGroups.get(n.tick);
        if (!group || group.length < criteria.minChordSize) return false;
      }
      return true;
    })
    .map((n) => n.id);
}
