import type { ChartData } from "./types";

type TimeSignature = ChartData["syncTrack"]["timeSignatures"][number];

export interface TempoPoint {
  tick: number;
  timeSeconds: number;
  bpm: number;
  ticksPerSecond: number;
}

/**
 * Build a sorted tempo map from BPM events. Each entry records the
 * absolute time in seconds at which that tempo becomes active.
 */
export function buildTempoMap(chart: ChartData): TempoPoint[] {
  const resolution = chart.metadata.resolution || 192;
  const events = [...chart.syncTrack.bpmEvents].sort((a, b) => a.tick - b.tick);

  if (events.length === 0) {
    const defaultBpm = 120;
    return [
      {
        tick: 0,
        timeSeconds: 0,
        bpm: defaultBpm,
        ticksPerSecond: (defaultBpm / 60) * resolution,
      },
    ];
  }

  const map: TempoPoint[] = [];
  let cumulativeTime = 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const prevBpm = i === 0 ? 120 : events[i - 1].bpm;
    const prevTick = i === 0 ? 0 : events[i - 1].tick;
    const prevTicksPerSecond = (prevBpm / 60) * resolution;

    if (i > 0) {
      cumulativeTime += (ev.tick - prevTick) / prevTicksPerSecond;
    }

    const ticksPerSecond = (ev.bpm / 60) * resolution;
    map.push({
      tick: ev.tick,
      timeSeconds: cumulativeTime,
      bpm: ev.bpm,
      ticksPerSecond,
    });
  }

  return map;
}

/**
 * Convert a chart tick position to seconds using the tempo map.
 */
export function tickToSeconds(tick: number, tempoMap: TempoPoint[]): number {
  let segment = tempoMap[0];
  for (const point of tempoMap) {
    if (point.tick <= tick) segment = point;
    else break;
  }
  return segment.timeSeconds + (tick - segment.tick) / segment.ticksPerSecond;
}

/**
 * Convert seconds to chart ticks using the tempo map.
 */
export function secondsToTick(seconds: number, tempoMap: TempoPoint[]): number {
  let segment = tempoMap[0];
  for (const point of tempoMap) {
    if (point.timeSeconds <= seconds) segment = point;
    else break;
  }
  return (
    segment.tick + (seconds - segment.timeSeconds) * segment.ticksPerSecond
  );
}

/**
 * Get BPM at a given tick (for display and audio sync).
 */
export function getBpmAtTick(tick: number, tempoMap: TempoPoint[]): number {
  let bpm = tempoMap[0]?.bpm ?? 120;
  for (const point of tempoMap) {
    if (point.tick <= tick) bpm = point.bpm;
    else break;
  }
  return bpm;
}

/**
 * Calculate grid snap size in ticks given resolution and snap division.
 * snapDivision: 4 = quarter note, 8 = eighth, 16 = sixteenth, 32 = thirty-second
 */
export function snapDivisionToTicks(
  resolution: number,
  snapDivision: number
): number {
  return Math.max(1, Math.round((resolution * 4) / snapDivision));
}

/**
 * Snap a tick value to the nearest grid line.
 */
export function snapToGrid(tick: number, gridTicks: number): number {
  return Math.round(tick / gridTicks) * gridTicks;
}

/**
 * Get total duration of a chart in ticks.
 */
export function getChartDurationTicks(chart: ChartData): number {
  let maxTick = 0;
  for (const track of Object.values(chart.tracks)) {
    if (!track) continue;
    for (const note of track.notes) {
      maxTick = Math.max(maxTick, note.tick + note.length);
    }
  }
  // Add a 4-bar tail
  return maxTick + chart.metadata.resolution * 4 * 4;
}

/**
 * 1-based measure and beat at a tick, following time signature changes.
 * A change that falls mid-measure starts a new measure (as in game charts).
 */
export function getMeasureBeat(
  tick: number,
  timeSignatures: TimeSignature[],
  resolution: number
): { measure: number; beat: number } {
  const sigs = [...timeSignatures].sort((a, b) => a.tick - b.tick);
  let sig: TimeSignature = { tick: 0, numerator: 4, denominator: 4 };
  let measuresBefore = 0;
  for (const next of sigs) {
    if (next.tick > tick) break;
    if (next.tick > sig.tick) {
      const measureTicks = (resolution * 4 * sig.numerator) / sig.denominator;
      measuresBefore += Math.ceil((next.tick - sig.tick) / measureTicks - 1e-6);
    }
    sig = next;
  }
  const beatTicks = (resolution * 4) / sig.denominator;
  const measureTicks = beatTicks * sig.numerator;
  const rel = Math.max(0, tick - sig.tick);
  const measure = Math.floor(rel / measureTicks + 1e-6);
  const beat = Math.floor((rel - measure * measureTicks) / beatTicks + 1e-6);
  return { measure: measuresBefore + measure + 1, beat: Math.min(sig.numerator, beat + 1) };
}

/** Seconds as m:ss.cc */
export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(2).padStart(5, "0")}`;
}

/** Position for display: "measure.beat · m:ss.cc" */
export function formatPosition(
  tick: number,
  tempoMap: TempoPoint[],
  timeSignatures: TimeSignature[],
  resolution: number
): string {
  const { measure, beat } = getMeasureBeat(tick, timeSignatures, resolution);
  return `${measure}.${beat} · ${formatClock(tickToSeconds(Math.max(0, tick), tempoMap))}`;
}
