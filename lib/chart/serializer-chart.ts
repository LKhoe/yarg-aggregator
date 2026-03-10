import type { ChartData, Phrase, Track } from "./types";

const INSTRUMENT_SECTION_NAMES: Record<string, Record<string, string>> = {
  Single: {
    Easy: "EasySingle",
    Medium: "MediumSingle",
    Hard: "HardSingle",
    Expert: "ExpertSingle",
  },
  DoubleBass: {
    Easy: "EasyDoubleBass",
    Medium: "MediumDoubleBass",
    Hard: "HardDoubleBass",
    Expert: "ExpertDoubleBass",
  },
  Drums: {
    Easy: "EasyDrums",
    Medium: "MediumDrums",
    Hard: "HardDrums",
    Expert: "ExpertDrums",
  },
  Keyboard: {
    Easy: "EasyKeyboard",
    Medium: "MediumKeyboard",
    Hard: "HardKeyboard",
    Expert: "ExpertKeyboard",
  },
  Vocals: {
    Easy: "EasyVocals",
    Medium: "MediumVocals",
    Hard: "HardVocals",
    Expert: "ExpertVocals",
  },
};

const PHRASE_TYPE_TO_INT: Record<Phrase["type"], number> = {
  starPower: 2,
  bre: 64,
  tremolo: 65,
  trill: 66,
};

function indent(line: string): string {
  return `  ${line}`;
}

function serializeSongSection(chart: ChartData): string {
  const m = chart.metadata;
  const lines = [
    `[Song]`,
    `{`,
    indent(`Name = "${m.name}"`),
    indent(`Artist = "${m.artist}"`),
    indent(`Album = "${m.album}"`),
    indent(`Year = "${m.year}"`),
    indent(`Charter = "${m.charter}"`),
    indent(`Resolution = ${m.resolution}`),
    indent(`Offset = ${m.offset}`),
    indent(`Genre = "${m.genre}"`),
    `}`,
  ];
  return lines.join("\n");
}

function serializeSyncTrack(chart: ChartData): string {
  const lines: string[] = ["[SyncTrack]", "{"];

  // Combine and sort all events by tick
  type RawEvent =
    | { tick: number; kind: "bpm"; bpm: number }
    | { tick: number; kind: "ts"; numerator: number; denominator: number };
  const events: RawEvent[] = [
    ...chart.syncTrack.bpmEvents.map(
      (e) => ({ tick: e.tick, kind: "bpm" as const, bpm: e.bpm })
    ),
    ...chart.syncTrack.timeSignatures.map((e) => ({
      tick: e.tick,
      kind: "ts" as const,
      numerator: e.numerator,
      denominator: e.denominator,
    })),
  ];
  events.sort((a, b) => a.tick - b.tick);

  for (const ev of events) {
    if (ev.kind === "bpm") {
      lines.push(indent(`${ev.tick} = B ${Math.round(ev.bpm * 1000)}`));
    } else {
      const denomLog2 = Math.round(Math.log2(ev.denominator));
      lines.push(indent(`${ev.tick} = TS ${ev.numerator} ${denomLog2}`));
    }
  }

  lines.push("}");
  return lines.join("\n");
}

function serializeEvents(chart: ChartData): string {
  const lines = ["[Events]", "{"];
  for (const ev of chart.events) {
    lines.push(indent(`${ev.tick} = E "${ev.text}"`));
  }
  lines.push("}");
  return lines.join("\n");
}

function serializeTrack(sectionName: string, track: Track): string {
  const lines = [`[${sectionName}]`, "{"];

  // Combine notes and phrases, sort by tick
  type RawEntry =
    | { tick: number; kind: "note"; fret: number; length: number }
    | { tick: number; kind: "phrase"; phraseType: number; length: number };
  const entries: RawEntry[] = [
    ...track.notes.map((n) => ({
      tick: n.tick,
      kind: "note" as const,
      fret: n.fret,
      length: n.length,
    })),
    ...track.phrases.map((p) => ({
      tick: p.tick,
      kind: "phrase" as const,
      phraseType: PHRASE_TYPE_TO_INT[p.type],
      length: p.length,
    })),
  ];
  entries.sort((a, b) => a.tick - b.tick);

  for (const entry of entries) {
    if (entry.kind === "note") {
      lines.push(indent(`${entry.tick} = N ${entry.fret} ${entry.length}`));
    } else {
      lines.push(
        indent(`${entry.tick} = S ${entry.phraseType} ${entry.length}`)
      );
    }
  }

  lines.push("}");
  return lines.join("\n");
}

export function serializeChart(chart: ChartData): string {
  const sections: string[] = [
    serializeSongSection(chart),
    serializeSyncTrack(chart),
    serializeEvents(chart),
  ];

  for (const [key, track] of Object.entries(chart.tracks)) {
    if (!track) continue;
    const sectionName =
      INSTRUMENT_SECTION_NAMES[track.instrument]?.[track.difficulty];
    if (!sectionName) continue;
    sections.push(serializeTrack(sectionName, track));
  }

  return sections.join("\n\n");
}

export function downloadChart(chart: ChartData, filename = "notes.chart"): void {
  const text = serializeChart(chart);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
