import type { ChartData } from "./types";

/**
 * Generate a Clone Hero compatible song.ini from chart metadata.
 */
export function generateSongIni(chart: ChartData): string {
  const m = chart.metadata;
  const lines: string[] = ["[song]"];

  const add = (key: string, value: string | number) => {
    if (value !== "" && value !== 0) {
      lines.push(`${key} = ${value}`);
    }
  };

  add("name", m.name);
  add("artist", m.artist);
  add("album", m.album);
  add("genre", m.genre);
  add("year", m.year);
  add("charter", m.charter);
  add("song_length", getSongLengthMs(chart));
  add("delay", Math.round(m.offset * 1000));

  // Detect which difficulties/instruments are charted
  const instruments = new Set<string>();
  for (const key of Object.keys(chart.tracks)) {
    if (key.includes("Single")) instruments.add("guitar");
    if (key.includes("DoubleBass")) instruments.add("bass");
    if (key.includes("Drums")) instruments.add("drums");
    if (key.includes("Keyboard")) instruments.add("keys");
    if (key.includes("Vocals") || key.includes("Harmony")) instruments.add("vocals");
  }

  // Difficulty tiers (approximate from note density)
  for (const inst of instruments) {
    add(`diff_${inst}`, -1); // -1 = auto-detect
  }

  add("preview_start_time", -1);
  add("icon", "");
  add("loading_phrase", "");

  return lines.join("\n") + "\n";
}

function getSongLengthMs(chart: ChartData): number {
  let maxTick = 0;
  for (const track of Object.values(chart.tracks)) {
    if (!track) continue;
    for (const note of track.notes) {
      const end = note.tick + note.length;
      if (end > maxTick) maxTick = end;
    }
  }

  if (maxTick === 0) return 0;

  const resolution = chart.metadata.resolution || 192;
  const bpmEvents = chart.syncTrack.bpmEvents;
  let time = 0;
  let prevTick = 0;
  let prevBpm = bpmEvents[0]?.bpm ?? 120;

  for (const ev of bpmEvents) {
    if (ev.tick > maxTick) break;
    time += ((ev.tick - prevTick) / resolution / prevBpm) * 60;
    prevTick = ev.tick;
    prevBpm = ev.bpm;
  }
  time += ((maxTick - prevTick) / resolution / prevBpm) * 60;

  return Math.round(time * 1000);
}
