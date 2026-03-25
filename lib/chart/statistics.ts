import type { Track } from "./types";
import type { TempoPoint } from "./tempo-utils";
import { tickToSeconds } from "./tempo-utils";

export interface NpsDataPoint {
  tick: number;
  nps: number;
}

export interface TrackStats {
  totalNotes: number;
  totalSustains: number;
  avgNps: number;
  peakNps: number;
  peakNpsTick: number;
  chordCount: number;
  hopoCount: number;
  tapCount: number;
  durationSeconds: number;
}

/**
 * Compute notes-per-second at regular intervals (every measure by default).
 * Window size = 1 measure for smoothing.
 */
export function computeNPS(
  track: Track,
  tempoMap: TempoPoint[],
  resolution: number,
  windowTicks?: number,
): NpsDataPoint[] {
  if (track.notes.length === 0) return [];

  const step = windowTicks ?? resolution * 4; // 1 measure (4 quarter notes)
  const maxTick = track.notes[track.notes.length - 1].tick + step;
  const result: NpsDataPoint[] = [];

  for (let tick = 0; tick < maxTick; tick += step) {
    const windowStart = tick;
    const windowEnd = tick + step;

    let count = 0;
    for (const note of track.notes) {
      if (note.tick >= windowStart && note.tick < windowEnd) count++;
      if (note.tick >= windowEnd) break;
    }

    const startSec = tickToSeconds(windowStart, tempoMap);
    const endSec = tickToSeconds(windowEnd, tempoMap);
    const durationSec = endSec - startSec;
    const nps = durationSec > 0 ? count / durationSec : 0;

    result.push({ tick, nps });
  }

  return result;
}

/**
 * Count chords by size: map from chord size (1,2,3,4,5) to count.
 */
export function computeChordDistribution(track: Track): Map<number, number> {
  const dist = new Map<number, number>();
  const tickGroups = new Map<number, number>();

  for (const note of track.notes) {
    tickGroups.set(note.tick, (tickGroups.get(note.tick) ?? 0) + 1);
  }

  for (const count of tickGroups.values()) {
    dist.set(count, (dist.get(count) ?? 0) + 1);
  }

  return dist;
}

/**
 * Compute a moving-window density profile (notes per beat, normalized).
 */
export function computeDensityProfile(
  track: Track,
  resolution: number,
): { tick: number; density: number }[] {
  if (track.notes.length === 0) return [];

  const windowTicks = resolution * 4; // 1 measure
  const step = resolution; // quarter note steps
  const maxTick = track.notes[track.notes.length - 1].tick + windowTicks;
  const result: { tick: number; density: number }[] = [];
  let maxDensity = 0;

  for (let tick = 0; tick < maxTick; tick += step) {
    let count = 0;
    for (const note of track.notes) {
      if (note.tick >= tick && note.tick < tick + windowTicks) count++;
      if (note.tick >= tick + windowTicks) break;
    }
    result.push({ tick, density: count });
    if (count > maxDensity) maxDensity = count;
  }

  // Normalize
  if (maxDensity > 0) {
    for (const point of result) {
      point.density /= maxDensity;
    }
  }

  return result;
}

/**
 * Compute summary statistics for a track.
 */
export function computeTrackSummary(
  track: Track,
  tempoMap: TempoPoint[],
  resolution: number,
): TrackStats {
  const notes = track.notes;
  if (notes.length === 0) {
    return {
      totalNotes: 0,
      totalSustains: 0,
      avgNps: 0,
      peakNps: 0,
      peakNpsTick: 0,
      chordCount: 0,
      hopoCount: 0,
      tapCount: 0,
      durationSeconds: 0,
    };
  }

  const firstTick = notes[0].tick;
  const lastTick = notes[notes.length - 1].tick;
  const durationSeconds = tickToSeconds(lastTick, tempoMap) - tickToSeconds(firstTick, tempoMap);

  let totalSustains = 0;
  let hopoCount = 0;
  let tapCount = 0;
  for (const note of notes) {
    if (note.length > 0) totalSustains++;
    if (note.flags?.forceHopo) hopoCount++;
    if (note.flags?.tap) tapCount++;
  }

  // Chord count (ticks with > 1 note)
  const tickCounts = new Map<number, number>();
  for (const note of notes) {
    tickCounts.set(note.tick, (tickCounts.get(note.tick) ?? 0) + 1);
  }
  let chordCount = 0;
  for (const count of tickCounts.values()) {
    if (count > 1) chordCount++;
  }

  const npsData = computeNPS(track, tempoMap, resolution);
  let peakNps = 0;
  let peakNpsTick = 0;
  let totalNps = 0;
  for (const point of npsData) {
    totalNps += point.nps;
    if (point.nps > peakNps) {
      peakNps = point.nps;
      peakNpsTick = point.tick;
    }
  }

  return {
    totalNotes: notes.length,
    totalSustains,
    avgNps: npsData.length > 0 ? totalNps / npsData.length : 0,
    peakNps,
    peakNpsTick,
    chordCount,
    hopoCount,
    tapCount,
    durationSeconds,
  };
}

/**
 * Compute a density heatmap as a Float32Array (normalized 0-1 per measure).
 * Index i = measure i.
 */
export function computeDensityHeatmap(
  track: Track,
  resolution: number,
): Float32Array {
  if (track.notes.length === 0) return new Float32Array(0);

  const measureTicks = resolution * 4;
  const maxTick = track.notes[track.notes.length - 1].tick;
  const numMeasures = Math.ceil(maxTick / measureTicks) + 1;
  const heatmap = new Float32Array(numMeasures);
  let max = 0;

  for (const note of track.notes) {
    const idx = Math.floor(note.tick / measureTicks);
    if (idx >= 0 && idx < numMeasures) {
      heatmap[idx]++;
      if (heatmap[idx] > max) max = heatmap[idx];
    }
  }

  if (max > 0) {
    for (let i = 0; i < numMeasures; i++) {
      heatmap[i] /= max;
    }
  }

  return heatmap;
}
