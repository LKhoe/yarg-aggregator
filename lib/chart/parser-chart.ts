import { v4 as uuidv4 } from "uuid";
import type {
  ChartData,
  Difficulty,
  Instrument,
  Note,
  Phrase,
  Track,
  TrackKey,
} from "./types";
import { makeTrackKey } from "./types";

const SECTION_NAME_MAP: Record<string, { difficulty: Difficulty; instrument: Instrument }> = {
  // Guitar (Single)
  EasySingle: { difficulty: "Easy", instrument: "Single" },
  MediumSingle: { difficulty: "Medium", instrument: "Single" },
  HardSingle: { difficulty: "Hard", instrument: "Single" },
  ExpertSingle: { difficulty: "Expert", instrument: "Single" },
  // Bass (DoubleBass)
  EasyDoubleBass: { difficulty: "Easy", instrument: "DoubleBass" },
  MediumDoubleBass: { difficulty: "Medium", instrument: "DoubleBass" },
  HardDoubleBass: { difficulty: "Hard", instrument: "DoubleBass" },
  ExpertDoubleBass: { difficulty: "Expert", instrument: "DoubleBass" },
  // Drums
  EasyDrums: { difficulty: "Easy", instrument: "Drums" },
  MediumDrums: { difficulty: "Medium", instrument: "Drums" },
  HardDrums: { difficulty: "Hard", instrument: "Drums" },
  ExpertDrums: { difficulty: "Expert", instrument: "Drums" },
  // Keys
  EasyKeyboard: { difficulty: "Easy", instrument: "Keyboard" },
  MediumKeyboard: { difficulty: "Medium", instrument: "Keyboard" },
  HardKeyboard: { difficulty: "Hard", instrument: "Keyboard" },
  ExpertKeyboard: { difficulty: "Expert", instrument: "Keyboard" },
  // Vocals
  EasyVocals: { difficulty: "Easy", instrument: "Vocals" },
  MediumVocals: { difficulty: "Medium", instrument: "Vocals" },
  HardVocals: { difficulty: "Hard", instrument: "Vocals" },
  ExpertVocals: { difficulty: "Expert", instrument: "Vocals" },
};

function parseKeyValue(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.trim().match(/^(\w+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match) {
      result[match[1]] = match[2].trim();
    }
  }
  return result;
}

function parseSongSection(content: string): ChartData["metadata"] {
  const kv = parseKeyValue(content);
  return {
    name: kv["Name"] ?? "",
    artist: kv["Artist"] ?? "",
    album: kv["Album"] ?? "",
    year: kv["Year"] ?? "",
    charter: kv["Charter"] ?? "",
    resolution: parseInt(kv["Resolution"] ?? "192", 10),
    offset: parseFloat(kv["Offset"] ?? "0"),
    genre: kv["Genre"] ?? "",
  };
}

function parseSyncTrack(content: string): ChartData["syncTrack"] {
  const bpmEvents: { tick: number; bpm: number }[] = [];
  const timeSignatures: { tick: number; numerator: number; denominator: number }[] = [];

  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // BPM: "tick = B value"
    const bpmMatch = trimmed.match(/^(\d+)\s*=\s*B\s+(\d+)$/);
    if (bpmMatch) {
      bpmEvents.push({
        tick: parseInt(bpmMatch[1], 10),
        bpm: parseInt(bpmMatch[2], 10) / 1000,
      });
      continue;
    }
    // Time signature: "tick = TS numerator [denominator_log2]"
    const tsMatch = trimmed.match(/^(\d+)\s*=\s*TS\s+(\d+)(?:\s+(\d+))?$/);
    if (tsMatch) {
      const denomLog2 = tsMatch[3] ? parseInt(tsMatch[3], 10) : 2;
      timeSignatures.push({
        tick: parseInt(tsMatch[1], 10),
        numerator: parseInt(tsMatch[2], 10),
        denominator: Math.pow(2, denomLog2),
      });
    }
  }

  // Ensure there's at least a default BPM
  if (bpmEvents.length === 0) {
    bpmEvents.push({ tick: 0, bpm: 120 });
  }

  return { bpmEvents, timeSignatures };
}

function parseEvents(content: string): { tick: number; text: string }[] {
  const events: { tick: number; text: string }[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.trim().match(/^(\d+)\s*=\s*E\s+"([^"]*)"$/);
    if (match) {
      events.push({ tick: parseInt(match[1], 10), text: match[2] });
    }
  }
  return events;
}

const PHRASE_TYPE_MAP: Record<number, Phrase["type"]> = {
  2: "starPower",
  64: "bre",
  65: "tremolo",
  66: "trill",
};

function parseTrackSection(
  content: string,
  difficulty: Difficulty,
  instrument: Instrument
): Track {
  const notes: Note[] = [];
  const phrases: Phrase[] = [];

  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Note: "tick = N fret length"
    const noteMatch = trimmed.match(/^(\d+)\s*=\s*N\s+(\d+)\s+(\d+)$/);
    if (noteMatch) {
      notes.push({
        id: uuidv4(),
        tick: parseInt(noteMatch[1], 10),
        fret: parseInt(noteMatch[2], 10),
        length: parseInt(noteMatch[3], 10),
      });
      continue;
    }
    // Special phrase: "tick = S type length"
    const specialMatch = trimmed.match(/^(\d+)\s*=\s*S\s+(\d+)\s+(\d+)$/);
    if (specialMatch) {
      const phraseType = parseInt(specialMatch[2], 10);
      const type = PHRASE_TYPE_MAP[phraseType];
      if (type) {
        phrases.push({
          id: uuidv4(),
          tick: parseInt(specialMatch[1], 10),
          length: parseInt(specialMatch[3], 10),
          type,
        });
      }
    }
  }

  notes.sort((a, b) => a.tick - b.tick);
  return { difficulty, instrument, notes, phrases };
}

function extractSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = text.split("\n");
  let currentSection: string | null = null;
  let depth = 0;
  const buf: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (depth === 0) {
      const headerMatch = trimmed.match(/^\[(\w+)\]$/);
      if (headerMatch) {
        currentSection = headerMatch[1];
        buf.length = 0;
      } else if (trimmed === "{") {
        depth = 1;
      }
    } else if (trimmed === "}") {
      depth--;
      if (depth === 0 && currentSection) {
        sections[currentSection] = buf.join("\n");
        currentSection = null;
        buf.length = 0;
      }
    } else {
      buf.push(line);
    }
  }

  return sections;
}

export function parseChart(text: string): ChartData {
  const sections = extractSections(text);

  const chart: ChartData = {
    metadata: {
      name: "",
      artist: "",
      album: "",
      year: "",
      charter: "",
      resolution: 192,
      offset: 0,
      genre: "",
    },
    syncTrack: { bpmEvents: [], timeSignatures: [] },
    events: [],
    tracks: {},
  };

  for (const [sectionName, content] of Object.entries(sections)) {
    if (sectionName === "Song") {
      chart.metadata = parseSongSection(content);
    } else if (sectionName === "SyncTrack") {
      chart.syncTrack = parseSyncTrack(content);
    } else if (sectionName === "Events") {
      chart.events = parseEvents(content);
    } else if (SECTION_NAME_MAP[sectionName]) {
      const { difficulty, instrument } = SECTION_NAME_MAP[sectionName];
      const key: TrackKey = makeTrackKey(difficulty, instrument);
      chart.tracks[key] = parseTrackSection(content, difficulty, instrument);
    }
  }

  // Ensure at least one BPM event
  if (chart.syncTrack.bpmEvents.length === 0) {
    chart.syncTrack.bpmEvents.push({ tick: 0, bpm: 120 });
  }

  return chart;
}
