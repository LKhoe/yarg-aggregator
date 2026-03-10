import type { ChartData } from "./types";
import { buildTempoMap, secondsToTick } from "./tempo-utils";

export interface WaveformData {
  /** Peak absolute amplitude per sample, normalized 0–1. */
  peaks: Float32Array;
  /** How many chart ticks each element in `peaks` covers. */
  ticksPerSample: number;
}

/**
 * Derive a tick-indexed waveform from a decoded AudioBuffer.
 *
 * Audio samples are mapped to chart ticks using the song's tempo map so that
 * the waveform automatically stretches / compresses at BPM changes — matching
 * exactly what the user hears relative to note positions.
 *
 * offset (from chart metadata) shifts the audio relative to the chart:
 *   chartTime = audioTime - offset
 */
export function computeWaveform(
  audioBuffer: AudioBuffer,
  chart: ChartData,
): WaveformData {
  const ticksPerSample = 4; // ~1/48th note at res=192; fine enough for note-level alignment

  const tempoMap  = buildTempoMap(chart);
  const sampleRate  = audioBuffer.sampleRate;
  const length      = audioBuffer.length;
  const numChannels = audioBuffer.numberOfChannels;
  const offset      = chart.metadata.offset; // seconds

  // Cache raw PCM arrays (avoids repeated getChannelData calls inside the loop)
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  // Maximum chart-time covered by this audio
  const maxChartSec = Math.max(0, audioBuffer.duration - offset);
  const maxTick     = secondsToTick(maxChartSec, tempoMap);
  const numBuckets  = Math.ceil(maxTick / ticksPerSample) + 4;

  // Accumulate peak |amplitude| per tick-bucket
  const peakPerBucket = new Float32Array(numBuckets);

  // Stride so we never iterate more than ~300 000 samples (fast on any device)
  const stride = Math.max(1, Math.floor(length / 300_000));

  for (let i = 0; i < length; i += stride) {
    const chartSec = i / sampleRate - offset;
    if (chartSec < 0) continue;

    const tick   = secondsToTick(chartSec, tempoMap);
    const bucket = Math.floor(tick / ticksPerSample);
    if (bucket < 0 || bucket >= numBuckets) continue;

    // Mono mix
    let val = 0;
    for (let c = 0; c < numChannels; c++) val += channels[c][i];
    val /= numChannels;

    const abs = val < 0 ? -val : val;
    if (abs > peakPerBucket[bucket]) peakPerBucket[bucket] = abs;
  }

  // ── Smoothing pass (5-tap triangular kernel) so transients aren't spiky dots
  const smoothed = new Float32Array(numBuckets);
  for (let i = 0; i < numBuckets; i++) {
    let sum = 0, weight = 0;
    for (let k = -2; k <= 2; k++) {
      const j = i + k;
      if (j < 0 || j >= numBuckets) continue;
      const w = 3 - Math.abs(k); // weights: 1 2 3 2 1
      sum    += peakPerBucket[j] * w;
      weight += w;
    }
    smoothed[i] = weight > 0 ? sum / weight : 0;
  }

  // ── Normalize to 0–1
  let maxPeak = 0;
  for (let i = 0; i < numBuckets; i++) {
    if (smoothed[i] > maxPeak) maxPeak = smoothed[i];
  }
  if (maxPeak > 0) {
    for (let i = 0; i < numBuckets; i++) smoothed[i] /= maxPeak;
  }

  return { peaks: smoothed, ticksPerSample };
}

/** Look up the normalized peak amplitude at a given chart tick. */
export function getWaveformPeak(wf: WaveformData, tick: number): number {
  if (tick < 0) return 0;
  const idx = Math.floor(tick / wf.ticksPerSample);
  if (idx < 0 || idx >= wf.peaks.length) return 0;
  return wf.peaks[idx];
}
