import { v4 as uuidv4 } from "uuid";
import type { LyricEvent } from "./types";
import type { TempoPoint } from "./tempo-utils";
import { secondsToTick } from "./tempo-utils";

/**
 * Split plain text into syllable/word LyricEvents with no tick assigned.
 */
export function parsePlainText(text: string): LyricEvent[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ id: uuidv4(), tick: null, text: word }));
}

/**
 * Parse LRC-format lyrics into LyricEvents with ticks derived from the tempo map.
 * Format: [mm:ss.xx] line text
 */
export function parseLrc(lrcText: string, tempoMap: TempoPoint[]): LyricEvent[] {
  const events: LyricEvent[] = [];
  for (const line of lrcText.split("\n")) {
    const match = line.match(/^\[(\d{1,2}):(\d{2})[.:](\d{2,3})\](.*)$/);
    if (!match) continue;
    const mm = parseInt(match[1], 10);
    const ss = parseInt(match[2], 10);
    const ms = parseInt(match[3].padEnd(3, "0"), 10);
    const seconds = mm * 60 + ss + ms / 1000;
    const tick = Math.round(secondsToTick(seconds, tempoMap));
    const words = match[4].trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      events.push({ id: uuidv4(), tick, text: word });
    }
  }
  return events;
}

/**
 * Assign unassigned lyrics to the nearest available note ticks.
 * Already-assigned lyrics are left unchanged.
 */
export function autoAssignSyllables(
  lyrics: LyricEvent[],
  sortedNotes: { tick: number }[]
): LyricEvent[] {
  if (sortedNotes.length === 0) return lyrics;
  let noteIdx = 0;
  return lyrics.map((lyric) => {
    if (lyric.tick !== null) return lyric;
    const note = sortedNotes[noteIdx % sortedNotes.length];
    noteIdx++;
    return { ...lyric, tick: note.tick };
  });
}

/**
 * Return the index of the lyric syllable closest to currentTick
 * (within a look-back window so it stays on the last syllable between lines).
 */
export function getActiveLyricIndex(lyrics: LyricEvent[], currentTick: number): number {
  let bestIdx = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < lyrics.length; i++) {
    const t = lyrics[i].tick;
    if (t === null) continue;
    const diff = currentTick - t;
    // Prefer syllables that started recently (within 2 beats at 192 res = 384 ticks)
    // and not in the future (diff >= 0), with slight tolerance
    const score = diff >= -96 ? -(Math.abs(diff)) : -Infinity;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}
