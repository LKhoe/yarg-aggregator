import { v4 as uuidv4 } from "uuid";
import type { Track, Difficulty, Note } from "./types";
import type { TempoPoint } from "./tempo-utils";
import { tickToSeconds } from "./tempo-utils";

/**
 * Auto-generate a lower difficulty from a source track.
 *
 * Strategy:
 * 1. Chord reduction: limit max simultaneous notes
 * 2. Density reduction: remove off-beat notes to meet NPS targets
 * 3. Flag cleanup: strip HOPOs/taps on easier difficulties
 * 4. Phrases preserved from source
 */
export function autoReduceDifficulty(
  sourceTrack: Track,
  targetDifficulty: Difficulty,
  tempoMap: TempoPoint[],
  resolution: number,
): Track {
  const config = DIFFICULTY_CONFIG[targetDifficulty];
  if (!config) return cloneTrack(sourceTrack, targetDifficulty);

  let notes = [...sourceTrack.notes];

  // Step 1: Chord reduction
  notes = reduceChords(notes, config.maxChordSize);

  // Step 2: Density reduction (keep notes on strong beats)
  notes = reduceDensity(notes, config.keepRatio, resolution);

  // Step 3: Flag cleanup
  notes = cleanFlags(notes, config);

  // Re-ID all notes and sort
  const newNotes: Note[] = notes.map((n) => ({
    ...n,
    id: uuidv4(),
    flags: n.flags && Object.keys(n.flags).length > 0 ? { ...n.flags } : undefined,
  }));
  newNotes.sort((a, b) => a.tick - b.tick);

  return {
    difficulty: targetDifficulty,
    instrument: sourceTrack.instrument,
    notes: newNotes,
    phrases: sourceTrack.phrases.map((p) => ({ ...p, id: uuidv4() })),
  };
}

interface DiffConfig {
  maxChordSize: number;
  keepRatio: number;
  removeHopo: boolean;
  removeTap: boolean;
}

const DIFFICULTY_CONFIG: Partial<Record<Difficulty, DiffConfig>> = {
  Hard: {
    maxChordSize: 3,
    keepRatio: 0.8,
    removeHopo: false,
    removeTap: false,
  },
  Medium: {
    maxChordSize: 2,
    keepRatio: 0.5,
    removeHopo: false,
    removeTap: true,
  },
  Easy: {
    maxChordSize: 1,
    keepRatio: 0.25,
    removeHopo: true,
    removeTap: true,
  },
};

function cloneTrack(track: Track, difficulty: Difficulty): Track {
  return {
    difficulty,
    instrument: track.instrument,
    notes: track.notes.map((n) => ({ ...n, id: uuidv4() })),
    phrases: track.phrases.map((p) => ({ ...p, id: uuidv4() })),
  };
}

/**
 * Reduce chords to at most maxSize notes per tick.
 * Keep the lowest frets (most accessible) when trimming.
 */
function reduceChords(notes: Note[], maxSize: number): Note[] {
  if (maxSize >= 5) return notes;

  const byTick = new Map<number, Note[]>();
  for (const n of notes) {
    const arr = byTick.get(n.tick);
    if (arr) arr.push(n);
    else byTick.set(n.tick, [n]);
  }

  const kept = new Set<string>();
  for (const group of byTick.values()) {
    if (group.length <= maxSize) {
      for (const n of group) kept.add(n.id);
    } else {
      // Sort by fret and keep lowest N
      const sorted = [...group].sort((a, b) => a.fret - b.fret);
      for (let i = 0; i < maxSize; i++) kept.add(sorted[i].id);
    }
  }

  return notes.filter((n) => kept.has(n.id));
}

/**
 * Remove notes to achieve a target density ratio.
 * Prioritize keeping notes on strong beats (downbeats > half-beats > quarter > eighth).
 */
function reduceDensity(notes: Note[], keepRatio: number, resolution: number): Note[] {
  if (keepRatio >= 1 || notes.length === 0) return notes;

  const targetCount = Math.max(1, Math.round(notes.length * keepRatio));
  if (notes.length <= targetCount) return notes;

  // Assign priority to each note based on beat strength
  const scored = notes.map((n) => ({
    note: n,
    priority: beatStrength(n.tick, resolution),
  }));

  // Sort by priority (highest first), then by tick for stability
  scored.sort((a, b) => b.priority - a.priority || a.note.tick - b.note.tick);

  // Keep the top N
  const kept = new Set<string>();
  for (let i = 0; i < targetCount; i++) {
    kept.add(scored[i].note.id);
  }

  return notes.filter((n) => kept.has(n.id));
}

/**
 * Calculate beat strength for a tick position.
 * Higher = stronger beat, should be kept.
 */
function beatStrength(tick: number, resolution: number): number {
  if (tick % (resolution * 4) === 0) return 8; // Measure start
  if (tick % (resolution * 2) === 0) return 7; // Half note
  if (tick % resolution === 0) return 6;        // Quarter note
  if (tick % (resolution / 2) === 0) return 4;  // Eighth note
  if (tick % (resolution / 4) === 0) return 2;  // Sixteenth note
  return 1;                                      // Everything else
}

function cleanFlags(notes: Note[], config: DiffConfig): Note[] {
  return notes.map((n) => {
    if (!n.flags) return n;
    const flags = { ...n.flags };
    if (config.removeHopo) delete flags.forceHopo;
    if (config.removeTap) delete flags.tap;
    const hasFlags = Object.keys(flags).length > 0;
    return { ...n, flags: hasFlags ? flags : undefined };
  });
}
