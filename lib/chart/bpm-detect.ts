/**
 * BPM detection using onset envelope and autocorrelation.
 */

export interface BpmResult {
  bpm: number;
  confidence: number;
}

/**
 * Detect BPM from an AudioBuffer using energy-based onset detection
 * and autocorrelation for periodicity.
 */
export function detectBPM(audioBuffer: AudioBuffer): BpmResult {
  // Mix to mono
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const mono = new Float32Array(length);

  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const channel = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += channel[i];
    }
  }
  const numChannels = audioBuffer.numberOfChannels;
  for (let i = 0; i < length; i++) {
    mono[i] /= numChannels;
  }

  // Compute energy envelope in windows
  const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
  const hopSize = Math.floor(windowSize / 2);
  const numFrames = Math.floor((length - windowSize) / hopSize);
  const envelope = new Float32Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let energy = 0;
    for (let i = 0; i < windowSize; i++) {
      energy += mono[start + i] * mono[start + i];
    }
    envelope[f] = Math.sqrt(energy / windowSize);
  }

  // Onset strength: half-wave rectified first derivative
  const onset = new Float32Array(numFrames);
  for (let f = 1; f < numFrames; f++) {
    onset[f] = Math.max(0, envelope[f] - envelope[f - 1]);
  }

  // Autocorrelation of onset signal
  // Search for BPM between 60 and 200
  const minBPM = 60;
  const maxBPM = 200;
  const framesPerSecond = sampleRate / hopSize;
  const minLag = Math.floor((60 / maxBPM) * framesPerSecond);
  const maxLag = Math.floor((60 / minBPM) * framesPerSecond);

  // Limit analysis to first 30 seconds for performance
  const analysisFrames = Math.min(onset.length, Math.floor(30 * framesPerSecond));

  let bestLag = minLag;
  let bestCorr = -Infinity;
  const correlations = new Float32Array(maxLag - minLag + 1);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let count = 0;
    for (let f = 0; f < analysisFrames - lag; f++) {
      corr += onset[f] * onset[f + lag];
      count++;
    }
    if (count > 0) corr /= count;
    correlations[lag - minLag] = corr;

    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  // Convert lag to BPM
  const secondsPerBeat = bestLag / framesPerSecond;
  let bpm = 60 / secondsPerBeat;

  // Normalize to common BPM range (prefer 90-180)
  while (bpm < 80) bpm *= 2;
  while (bpm > 200) bpm /= 2;

  // Calculate confidence (ratio of best to mean correlation)
  let meanCorr = 0;
  for (let i = 0; i < correlations.length; i++) {
    meanCorr += correlations[i];
  }
  meanCorr /= correlations.length;
  const confidence = meanCorr > 0 ? Math.min(1, bestCorr / (meanCorr * 3)) : 0;

  return {
    bpm: Math.round(bpm * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
  };
}

/**
 * Calculate BPM from tap intervals.
 * Discards outliers (taps > 2x median interval).
 */
export function bpmFromTaps(timestamps: number[]): number | null {
  if (timestamps.length < 3) return null;

  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }

  // Sort for median
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Filter outliers
  const valid = intervals.filter((iv) => iv < median * 2 && iv > median * 0.5);
  if (valid.length === 0) return null;

  const avgInterval = valid.reduce((a, b) => a + b, 0) / valid.length;
  return Math.round((60000 / avgInterval) * 10) / 10;
}
