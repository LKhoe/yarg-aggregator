import type { ChartData } from "./types";

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
