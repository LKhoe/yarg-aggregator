import type { ChartData } from "./types";
import { buildTempoMap, secondsToTick } from "./tempo-utils";

export interface SpectrogramData {
  /**
   * Per tick-bucket: interleaved [r, g, b] bytes (0–255).
   * Red   = bass energy   (0–300 Hz)
   * Green = mid energy    (300–3000 Hz)
   * Blue  = treble energy (3000 Hz+)
   */
  rgb: Uint8ClampedArray;
  ticksPerSample: number;
  numBuckets: number;
}

// ─── Radix-2 in-place FFT ────────────────────────────────────────────────────

function fft(re: Float32Array, im: Float32Array): void {
  const N = re.length;
  // Bit-reverse permutation
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  // Cooley-Tukey butterfly
  for (let len = 2; len <= N; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < (len >> 1); k++) {
        const j = i + k + (len >> 1);
        const tRe = curRe * re[j] - curIm * im[j];
        const tIm = curRe * im[j] + curIm * re[j];
        re[j] = re[i + k] - tRe;
        im[j] = im[i + k] - tIm;
        re[i + k] += tRe;
        im[i + k] += tIm;
        const t = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = t;
      }
    }
  }
}

// ─── Main computation ────────────────────────────────────────────────────────

/**
 * Compute a 3-band spectrogram from a decoded AudioBuffer.
 *
 * The output RGB values represent:
 *   R = bass (0–300 Hz), G = mids (300–3000 Hz), B = treble (3000 Hz+)
 *
 * Time axis is tick-indexed (same resolution and offset handling as WaveformData)
 * so the two visualizations stay in sync with note positions.
 */
export function computeSpectrogram(
  audioBuffer: AudioBuffer,
  chart: ChartData,
): SpectrogramData {
  const FFT_SIZE = 512;
  const ticksPerSample = 4; // match waveform temporal resolution

  const tempoMap   = buildTempoMap(chart);
  const sampleRate = audioBuffer.sampleRate;
  const length     = audioBuffer.length;
  const numChannels = audioBuffer.numberOfChannels;
  const offset     = chart.metadata.offset;

  // ── Mono mix ──────────────────────────────────────────────────────────────
  const mono = new Float32Array(length);
  for (let c = 0; c < numChannels; c++) {
    const ch = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += ch[i];
  }
  if (numChannels > 1) {
    for (let i = 0; i < length; i++) mono[i] /= numChannels;
  }

  // ── Output buckets ────────────────────────────────────────────────────────
  const maxChartSec = Math.max(0, audioBuffer.duration - offset);
  const maxTick     = secondsToTick(maxChartSec, tempoMap);
  const numBuckets  = Math.ceil(maxTick / ticksPerSample) + 4;

  const lowBand  = new Float32Array(numBuckets);
  const midBand  = new Float32Array(numBuckets);
  const highBand = new Float32Array(numBuckets);

  // ── Hann window ───────────────────────────────────────────────────────────
  const hannWindow = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
  }

  // ── Frequency bin → band boundaries ──────────────────────────────────────
  const nyquist = sampleRate / 2;
  const lowBin  = Math.max(1, Math.floor(300  / nyquist * (FFT_SIZE >> 1)));
  const midBin  = Math.max(lowBin + 1, Math.floor(3000 / nyquist * (FFT_SIZE >> 1)));

  // ── Hop size: process at most ~20 000 frames for any song length ──────────
  const hopSamples = Math.max(FFT_SIZE >> 1, Math.floor(length / 20_000));

  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);

  for (let start = 0; start + FFT_SIZE <= length; start += hopSamples) {
    const centerSample = start + (FFT_SIZE >> 1);
    const chartSec     = centerSample / sampleRate - offset;
    if (chartSec < 0) continue;

    const tick   = secondsToTick(chartSec, tempoMap);
    const bucket = Math.floor(tick / ticksPerSample);
    if (bucket < 0 || bucket >= numBuckets) continue;

    // Fill + window
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = mono[start + i] * hannWindow[i];
      im[i] = 0;
    }

    fft(re, im);

    // Accumulate power per band (keep max per bucket across overlapping frames)
    let low = 0, mid = 0, high = 0;
    for (let k = 1; k < (FFT_SIZE >> 1); k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      if      (k <= lowBin) low  += p;
      else if (k <= midBin) mid  += p;
      else                  high += p;
    }

    if (low  > lowBand[bucket])  lowBand[bucket]  = low;
    if (mid  > midBand[bucket])  midBand[bucket]  = mid;
    if (high > highBand[bucket]) highBand[bucket] = high;
  }

  // ── Log-compress ──────────────────────────────────────────────────────────
  for (let i = 0; i < numBuckets; i++) {
    lowBand[i]  = Math.log1p(lowBand[i]);
    midBand[i]  = Math.log1p(midBand[i]);
    highBand[i] = Math.log1p(highBand[i]);
  }

  // ── Normalise each band independently ────────────────────────────────────
  const normalise = (arr: Float32Array) => {
    let max = 0;
    for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
    if (max > 0) for (let i = 0; i < arr.length; i++) arr[i] /= max;
  };
  normalise(lowBand);
  normalise(midBand);
  normalise(highBand);

  // ── Pack into RGB ─────────────────────────────────────────────────────────
  const rgb = new Uint8ClampedArray(numBuckets * 3);
  for (let i = 0; i < numBuckets; i++) {
    rgb[i * 3]     = Math.round(lowBand[i]  * 255); // R = bass
    rgb[i * 3 + 1] = Math.round(midBand[i]  * 255); // G = mids
    rgb[i * 3 + 2] = Math.round(highBand[i] * 255); // B = treble
  }

  return { rgb, ticksPerSample, numBuckets };
}

/** Look up the [r, g, b] values at a given chart tick. */
export function getSpectrogramRgb(
  data: SpectrogramData,
  tick: number,
): [number, number, number] {
  if (tick < 0) return [0, 0, 0];
  const bucket = Math.floor(tick / data.ticksPerSample);
  if (bucket < 0 || bucket >= data.numBuckets) return [0, 0, 0];
  const i = bucket * 3;
  return [data.rgb[i], data.rgb[i + 1], data.rgb[i + 2]];
}
