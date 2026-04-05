import type { TempoPoint } from "./tempo-utils";
import type { Note } from "./types";

/**
 * MetronomeScheduler uses the Web Audio API to schedule click sounds
 * on beats during chart playback. Uses lookahead scheduling to ensure
 * precise timing even when the main thread is busy.
 */
export class MetronomeScheduler {
  private audioCtx: AudioContext;
  private tempoMap: TempoPoint[];
  private timeSignatures: { tick: number; numerator: number; denominator: number }[];
  private resolution: number;
  private playbackSpeed: number;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startAudioTime = 0;
  private startTick = 0;
  private nextBeatTick = 0;
  private scheduledUpTo = 0; // audio time we've scheduled up to
  private volume = 0.3;

  // Lookahead: schedule 150ms ahead, check every 25ms
  private static readonly LOOKAHEAD_MS = 150;
  private static readonly INTERVAL_MS = 25;

  constructor(
    audioCtx: AudioContext,
    tempoMap: TempoPoint[],
    timeSignatures: { tick: number; numerator: number; denominator: number }[],
    resolution: number,
  ) {
    this.audioCtx = audioCtx;
    this.tempoMap = tempoMap;
    this.timeSignatures = [...timeSignatures].sort((a, b) => a.tick - b.tick);
    this.resolution = resolution;
    this.playbackSpeed = 1;
  }

  start(startTick: number, playbackSpeed: number): void {
    this.stop();
    this.playbackSpeed = playbackSpeed;
    this.startTick = startTick;
    this.startAudioTime = this.audioCtx.currentTime;
    this.scheduledUpTo = this.audioCtx.currentTime;

    // Find the next beat boundary at or after startTick
    const beatTicks = this.getBeatTicks();
    this.nextBeatTick = Math.ceil(startTick / beatTicks) * beatTicks;

    this.intervalId = setInterval(() => this.schedule(), MetronomeScheduler.INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = speed;
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  updateTempoMap(tempoMap: TempoPoint[], timeSignatures: { tick: number; numerator: number; denominator: number }[]): void {
    this.tempoMap = tempoMap;
    this.timeSignatures = [...timeSignatures].sort((a, b) => a.tick - b.tick);
  }

  private getBeatTicks(): number {
    // Quarter note = resolution ticks
    return this.resolution;
  }

  private getTimeSignatureAt(tick: number): { numerator: number; denominator: number } {
    let ts = { numerator: 4, denominator: 4 };
    for (const sig of this.timeSignatures) {
      if (sig.tick <= tick) ts = sig;
      else break;
    }
    return ts;
  }

  private isDownbeat(beatTick: number): boolean {
    const ts = this.getTimeSignatureAt(beatTick);
    // A measure is numerator * (4/denominator) quarter notes long
    const measureTicks = ts.numerator * this.resolution * (4 / ts.denominator);
    if (measureTicks <= 0) return true;

    // Find the start of the measure containing this beat
    // Simple approach: check if beat falls on a measure boundary
    const remainder = beatTick % measureTicks;
    return Math.abs(remainder) < 1;
  }

  private tickToAudioTime(tick: number): number {
    // Convert tick to seconds using tempo map, then adjust for playback speed
    let segment = this.tempoMap[0];
    for (const point of this.tempoMap) {
      if (point.tick <= tick) segment = point;
      else break;
    }
    const seconds = segment.timeSeconds + (tick - segment.tick) / segment.ticksPerSecond;

    const startSeconds = (() => {
      let seg = this.tempoMap[0];
      for (const point of this.tempoMap) {
        if (point.tick <= this.startTick) seg = point;
        else break;
      }
      return seg.timeSeconds + (this.startTick - seg.tick) / seg.ticksPerSecond;
    })();

    const elapsedSeconds = (seconds - startSeconds) / this.playbackSpeed;
    return this.startAudioTime + elapsedSeconds;
  }

  private schedule(): void {
    const lookAheadTime = this.audioCtx.currentTime + MetronomeScheduler.LOOKAHEAD_MS / 1000;

    while (true) {
      const beatAudioTime = this.tickToAudioTime(this.nextBeatTick);
      if (beatAudioTime > lookAheadTime) break;

      // Only schedule future clicks
      if (beatAudioTime >= this.audioCtx.currentTime - 0.01) {
        this.playClick(beatAudioTime, this.isDownbeat(this.nextBeatTick));
      }

      // Advance to next beat
      this.nextBeatTick += this.getBeatTicks();
    }
  }

  private playClick(time: number, isDownbeat: boolean): void {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.value = isDownbeat ? 1000 : 800;
    osc.type = "sine";

    const duration = isDownbeat ? 0.03 : 0.02;
    const vol = this.volume * (isDownbeat ? 1.0 : 0.6);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.start(time);
    osc.stop(time + duration + 0.01);
  }
}

/**
 * ClapScheduler plays short noise-burst "clap" sounds whenever the
 * playhead crosses a note position. Uses the same lookahead approach
 * as MetronomeScheduler.
 */
export class ClapScheduler {
  private audioCtx: AudioContext;
  private tempoMap: TempoPoint[];
  private resolution: number;
  private playbackSpeed: number;
  private notes: Note[];

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startAudioTime = 0;
  private startTick = 0;
  private nextNoteIdx = 0;
  private volume = 0.25;

  private static readonly LOOKAHEAD_MS = 150;
  private static readonly INTERVAL_MS = 25;

  constructor(
    audioCtx: AudioContext,
    tempoMap: TempoPoint[],
    notes: Note[],
    resolution: number,
  ) {
    this.audioCtx = audioCtx;
    this.tempoMap = tempoMap;
    this.notes = [...notes].sort((a, b) => a.tick - b.tick);
    this.resolution = resolution;
    this.playbackSpeed = 1;
  }

  start(startTick: number, playbackSpeed: number): void {
    this.stop();
    this.playbackSpeed = playbackSpeed;
    this.startTick = startTick;
    this.startAudioTime = this.audioCtx.currentTime;

    // Find the first note at or after startTick
    this.nextNoteIdx = 0;
    for (let i = 0; i < this.notes.length; i++) {
      if (this.notes[i].tick >= startTick) {
        this.nextNoteIdx = i;
        break;
      }
      this.nextNoteIdx = this.notes.length;
    }

    this.intervalId = setInterval(() => this.schedule(), ClapScheduler.INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = speed;
  }

  private tickToAudioTime(tick: number): number {
    let segment = this.tempoMap[0];
    for (const point of this.tempoMap) {
      if (point.tick <= tick) segment = point;
      else break;
    }
    const seconds = segment.timeSeconds + (tick - segment.tick) / segment.ticksPerSecond;
    const startSeg = (() => {
      let seg = this.tempoMap[0];
      for (const p of this.tempoMap) {
        if (p.tick <= this.startTick) seg = p;
        else break;
      }
      return seg;
    })();
    const startSeconds = startSeg.timeSeconds + (this.startTick - startSeg.tick) / startSeg.ticksPerSecond;
    return this.startAudioTime + (seconds - startSeconds) / this.playbackSpeed;
  }

  private schedule(): void {
    const lookAheadTime = this.audioCtx.currentTime + ClapScheduler.LOOKAHEAD_MS / 1000;

    // Deduplicate: only play one clap per tick (chords)
    let lastScheduledTick = -1;

    while (this.nextNoteIdx < this.notes.length) {
      const note = this.notes[this.nextNoteIdx];
      const audioTime = this.tickToAudioTime(note.tick);
      if (audioTime > lookAheadTime) break;

      if (audioTime >= this.audioCtx.currentTime - 0.01 && note.tick !== lastScheduledTick) {
        this.playClap(audioTime);
        lastScheduledTick = note.tick;
      }
      this.nextNoteIdx++;
    }
  }

  private playClap(time: number): void {
    // White noise burst for clap sound
    const bufferSize = this.audioCtx.sampleRate * 0.04;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;

    const bandpass = this.audioCtx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 2000;
    bandpass.Q.value = 0.7;

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(this.volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.audioCtx.destination);

    source.start(time);
    source.stop(time + 0.05);
  }
}
