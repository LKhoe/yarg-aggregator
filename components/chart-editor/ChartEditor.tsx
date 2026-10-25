"use client";

import {
  useReducer,
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from "react";
import { v4 as uuidv4 } from "uuid";
import type { ChartData, Instrument, Note, Phrase, Section, TrackKey, DrumMode, BpmEvent } from "@/lib/chart/types";
import {
  makeTrackKey,
  parseTrackKey,
  DIFFICULTY_ORDER,
  INSTRUMENT_ORDER,
} from "@/lib/chart/types";
import type { Difficulty } from "@/lib/chart/types";
import { parseChart } from "@/lib/chart/parser-chart";
import { parseMidi } from "@/lib/chart/parser-midi";
import { computeWaveform, type WaveformData } from "@/lib/chart/waveform";
import { computeSpectrogram, type SpectrogramData } from "@/lib/chart/spectrogram";
import {
  buildTempoMap,
  getBpmAtTick,
  getChartDurationTicks,
  secondsToTick,
  snapDivisionToTicks,
  snapToGrid,
  tickToSeconds,
  formatPosition,
  type TempoPoint,
} from "@/lib/chart/tempo-utils";
import { FileUpload } from "./FileUpload";
import { Toolbar } from "./Toolbar";
import { TrackSelector } from "./TrackSelector";
import { TrackLane } from "./TrackLane";
import { VocalsLane } from "./VocalsLane";
import { PropertiesPanel } from "./PropertiesPanel";
import { LyricsPanel } from "./LyricsPanel";
import { ExportDialog } from "./ExportDialog";
import { ChartRuler } from "./ChartRuler";
import { TimelineBar } from "./TimelineBar";
import { ShortcutsPanel } from "./ShortcutsPanel";
import { SectionNav } from "./SectionNav";
import { ValidationPanel } from "./ValidationPanel";
import { StatisticsPanel } from "./StatisticsPanel";
import { AutoReduceDialog } from "./AutoReduceDialog";
import { BpmDetectDialog } from "./BpmDetectDialog";
import { GlobalView } from "./GlobalView";
import { NamePromptDialog } from "./NamePromptDialog";
import { MetadataDialog } from "./MetadataDialog";
import { classifySongFiles, collectDroppedFiles } from "./song-files";
import { parseSongIni } from "@/lib/chart/song-ini";
import { downloadChart } from "@/lib/chart/serializer-chart";
import { downloadMidi } from "@/lib/chart/serializer-midi";
import { toast } from "sonner";
import { MetronomeScheduler, ClapScheduler } from "@/lib/chart/metronome";
import { autoReduceDifficulty } from "@/lib/chart/auto-reduce";
import { computeDensityHeatmap } from "@/lib/chart/statistics";
import { Button } from "@/components/ui/button";
import { Download, Info, Save, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

// ───────────────────────── Stem model ────────────────────────────

interface AudioStem {
  label: string;
  buffer: AudioBuffer;
  waveform: WaveformData;
}

// Infer a canonical stem label from an audio filename
function inferStemLabel(filename: string): string {
  const base = filename.toLowerCase().replace(/\.[^.]+$/, "");
  if (base.startsWith("drums")) return "drums";
  if (base === "guitar" || base === "single") return "guitar";
  if (base === "bass" || base === "rhythm") return "bass";
  if (base === "keys" || base === "keyboard") return "keys";
  if (base === "vocals" || base === "vocal" || base === "voices") return "vocals";
  return base; // "song", "preview", or custom
}

// Stem priority per instrument (first match wins)
const INSTRUMENT_STEMS: Record<Instrument, string[]> = {
  Single:     ["guitar", "song"],
  DoubleBass: ["bass", "rhythm", "song"],
  Drums:      ["drums", "song"],
  Keyboard:   ["keys", "keyboard", "song"],
  Vocals:     ["vocals", "vocal", "song"],
  Harmony1:   ["vocals", "vocal", "song"],
  Harmony2:   ["vocals", "vocal", "song"],
  Harmony3:   ["vocals", "vocal", "song"],
};

// ───────────────────────── Edit actions ──────────────────────────

type EditAction =
  | { type: "ADD_NOTE"; track: TrackKey; note: Note }
  | { type: "DELETE_NOTES"; track: TrackKey; ids: string[] }
  | {
      type: "MOVE_NOTES";
      track: TrackKey;
      ids: string[];
      deltaTick: number;
      deltaFret: number;
    }
  | { type: "RESIZE_NOTE"; track: TrackKey; id: string; newLength: number }
  | { type: "UPDATE_NOTE"; track: TrackKey; note: Note }
  // Absolute positions (note drag: computed from the drag origin, so clamping is lossless)
  | { type: "SET_NOTE_POSITIONS"; track: TrackKey; positions: NotePosition[] }
  | { type: "SET_CHART"; chart: ChartData }
  // BPM / Tempo map
  | { type: "ADD_BPM"; tick: number; bpm: number }
  | { type: "DELETE_BPM"; tick: number }
  | { type: "ADD_TIME_SIGNATURE"; tick: number; numerator: number; denominator: number }
  | { type: "DELETE_TIME_SIGNATURE"; tick: number }
  // Ruler drags (the events at tick 0 stay put: the tempo map starts there)
  | { type: "MOVE_BPM"; from: number; to: number }
  | { type: "MOVE_TIME_SIGNATURE"; from: number; to: number }
  | { type: "MOVE_SECTION"; id: string; tick: number }
  // Phrases
  | { type: "ADD_PHRASE"; track: TrackKey; phrase: Phrase }
  | { type: "DELETE_PHRASE"; track: TrackKey; id: string }
  | { type: "RESIZE_PHRASE"; track: TrackKey; id: string; newLength: number }
  // Note flags
  | { type: "TOGGLE_NOTE_FLAG"; track: TrackKey; ids: string[]; flag: "forceHopo" | "forceStrum" | "tap" | "open" | "cymbal" | "accent" | "ghost" | "doubleKick" }
  // Anchored BPM
  | { type: "TOGGLE_BPM_ANCHOR"; tick: number }
  // Sections
  | { type: "ADD_SECTION"; section: Section }
  | { type: "RENAME_SECTION"; id: string; name: string }
  | { type: "DELETE_SECTION"; id: string }
  // Lyrics
  | { type: "SET_LYRICS"; lyrics: import("@/lib/chart/types").LyricEvent[] }
  // Copy/paste
  | { type: "PASTE_NOTES"; track: TrackKey; notes: Note[] }
  // Auto-reduce / track replacement / new empty track
  | { type: "SET_TRACK"; trackKey: TrackKey; track: import("@/lib/chart/types").Track }
  | { type: "SET_METADATA"; metadata: ChartData["metadata"] };

export interface NotePosition {
  id: string;
  tick: number;
  fret: number;
}

// Vocals use MIDI pitches (36–83, plus 96/97 percussion); everything else uses fret 0–4
function clampFret(instrument: Instrument, fret: number): number {
  const isVocals =
    instrument === "Vocals" || instrument === "Harmony1" || instrument === "Harmony2" || instrument === "Harmony3";
  if (!isVocals) return Math.max(0, Math.min(4, fret));
  return fret >= 84 ? Math.min(97, Math.max(96, fret)) : Math.max(36, Math.min(83, fret));
}

function emptyTrack(difficulty: Difficulty, instrument: Instrument): import("@/lib/chart/types").Track {
  return { difficulty, instrument, notes: [], phrases: [] };
}

// Next/previous grid line from `tick` (an off-grid tick moves to the nearest line in that direction)
function gridStep(tick: number, gridTicks: number, direction: 1 | -1): number {
  const index = tick / gridTicks;
  const next = direction === 1 ? Math.floor(index + 1e-6) + 1 : Math.ceil(index - 1e-6) - 1;
  return Math.max(0, next * gridTicks);
}

// Next/previous measure line from `tick`, following time signature changes
function measureStep(chart: ChartData, tick: number, direction: 1 | -1): number {
  const resolution = chart.metadata.resolution || 192;
  const sigs = [...chart.syncTrack.timeSignatures].sort((a, b) => a.tick - b.tick);
  // Going back from a signature change, measure with the signature before it
  const probe = direction === 1 ? tick : tick - 1;
  let sig = { tick: 0, numerator: 4, denominator: 4 };
  for (const s of sigs) {
    if (s.tick <= probe) sig = s;
    else break;
  }
  const measureTicks = (resolution * 4 * sig.numerator) / sig.denominator;
  const target = sig.tick + gridStep(tick - sig.tick, measureTicks, direction);
  if (direction === 1) {
    const nextSig = sigs.find((s) => s.tick > tick);
    if (nextSig && nextSig.tick < target) return nextSig.tick;
  }
  return Math.max(0, Math.round(target));
}

function applyAction(chart: ChartData, action: EditAction): ChartData {
  switch (action.type) {
    case "SET_CHART":
      return action.chart;

    case "ADD_NOTE": {
      const track = chart.tracks[action.track];
      if (!track) return chart;
      const notes = [...track.notes, action.note].sort(
        (a, b) => a.tick - b.tick
      );
      return {
        ...chart,
        tracks: { ...chart.tracks, [action.track]: { ...track, notes } },
      };
    }

    case "DELETE_NOTES": {
      const track = chart.tracks[action.track];
      if (!track) return chart;
      const idSet = new Set(action.ids);
      return {
        ...chart,
        tracks: {
          ...chart.tracks,
          [action.track]: {
            ...track,
            notes: track.notes.filter((n) => !idSet.has(n.id)),
          },
        },
      };
    }

    case "MOVE_NOTES": {
      const track = chart.tracks[action.track];
      if (!track) return chart;
      const idSet = new Set(action.ids);
      const notes = track.notes.map((n) => {
        if (!idSet.has(n.id)) return n;
        return {
          ...n,
          tick: Math.max(0, n.tick + action.deltaTick),
          fret: clampFret(track.instrument, n.fret + action.deltaFret),
        };
      });
      notes.sort((a, b) => a.tick - b.tick);
      return {
        ...chart,
        tracks: { ...chart.tracks, [action.track]: { ...track, notes } },
      };
    }

    case "SET_NOTE_POSITIONS": {
      const track = chart.tracks[action.track];
      if (!track) return chart;
      const byId = new Map(action.positions.map((p) => [p.id, p]));
      const notes = track.notes.map((n) => {
        const p = byId.get(n.id);
        if (!p) return n;
        return { ...n, tick: Math.max(0, p.tick), fret: clampFret(track.instrument, p.fret) };
      });
      notes.sort((a, b) => a.tick - b.tick);
      return {
        ...chart,
        tracks: { ...chart.tracks, [action.track]: { ...track, notes } },
      };
    }

    case "RESIZE_NOTE": {
      const track = chart.tracks[action.track];
      if (!track) return chart;
      return {
        ...chart,
        tracks: {
          ...chart.tracks,
          [action.track]: {
            ...track,
            notes: track.notes.map((n) =>
              n.id === action.id ? { ...n, length: Math.max(0, action.newLength) } : n
            ),
          },
        },
      };
    }

    case "UPDATE_NOTE": {
      const track = chart.tracks[action.track];
      if (!track) return chart;
      return {
        ...chart,
        tracks: {
          ...chart.tracks,
          [action.track]: {
            ...track,
            // Merge so fields the caller didn't send (flags) survive the edit
            notes: track.notes
              .map((n) => (n.id === action.note.id ? { ...n, ...action.note } : n))
              .sort((a, b) => a.tick - b.tick),
          },
        },
      };
    }

    case "ADD_BPM": {
      const events = chart.syncTrack.bpmEvents.filter((e) => e.tick !== action.tick);
      events.push({ tick: action.tick, bpm: action.bpm });
      events.sort((a, b) => a.tick - b.tick);
      return { ...chart, syncTrack: { ...chart.syncTrack, bpmEvents: events } };
    }

    case "DELETE_BPM": {
      const events = chart.syncTrack.bpmEvents.filter((e) => e.tick !== action.tick);
      // Always keep at least one BPM event at tick 0
      if (events.length === 0) events.push({ tick: 0, bpm: 120 });
      return { ...chart, syncTrack: { ...chart.syncTrack, bpmEvents: events } };
    }

    case "ADD_TIME_SIGNATURE": {
      const sigs = chart.syncTrack.timeSignatures.filter((e) => e.tick !== action.tick);
      sigs.push({ tick: action.tick, numerator: action.numerator, denominator: action.denominator });
      sigs.sort((a, b) => a.tick - b.tick);
      return { ...chart, syncTrack: { ...chart.syncTrack, timeSignatures: sigs } };
    }

    case "DELETE_TIME_SIGNATURE": {
      const sigs = chart.syncTrack.timeSignatures.filter((e) => e.tick !== action.tick);
      return { ...chart, syncTrack: { ...chart.syncTrack, timeSignatures: sigs } };
    }

    case "MOVE_BPM": {
      const moved = chart.syncTrack.bpmEvents.find((e) => e.tick === action.from);
      if (!moved || action.from === 0 || action.to <= 0 || action.to === action.from) return chart;
      const events = chart.syncTrack.bpmEvents.filter((e) => e.tick !== action.from && e.tick !== action.to);
      events.push({ ...moved, tick: action.to });
      events.sort((a, b) => a.tick - b.tick);
      return { ...chart, syncTrack: { ...chart.syncTrack, bpmEvents: events } };
    }

    case "MOVE_TIME_SIGNATURE": {
      const moved = chart.syncTrack.timeSignatures.find((e) => e.tick === action.from);
      if (!moved || action.from === 0 || action.to <= 0 || action.to === action.from) return chart;
      const sigs = chart.syncTrack.timeSignatures.filter((e) => e.tick !== action.from && e.tick !== action.to);
      sigs.push({ ...moved, tick: action.to });
      sigs.sort((a, b) => a.tick - b.tick);
      return { ...chart, syncTrack: { ...chart.syncTrack, timeSignatures: sigs } };
    }

    case "MOVE_SECTION": {
      const sections = (chart.sections ?? [])
        .map((s) => (s.id === action.id ? { ...s, tick: Math.max(0, action.tick) } : s))
        .sort((a, b) => a.tick - b.tick);
      return { ...chart, sections };
    }

    case "ADD_PHRASE": {
      const track = chart.tracks[action.track];
      if (!track) return chart;
      const phrases = [...track.phrases, action.phrase].sort((a, b) => a.tick - b.tick);
      return {
        ...chart,
        tracks: { ...chart.tracks, [action.track]: { ...track, phrases } },
      };
    }

    case "DELETE_PHRASE": {
      const track = chart.tracks[action.track];
      if (!track) return chart;
      return {
        ...chart,
        tracks: {
          ...chart.tracks,
          [action.track]: {
            ...track,
            phrases: track.phrases.filter((p) => p.id !== action.id),
          },
        },
      };
    }

    case "RESIZE_PHRASE": {
      const track = chart.tracks[action.track];
      if (!track) return chart;
      return {
        ...chart,
        tracks: {
          ...chart.tracks,
          [action.track]: {
            ...track,
            phrases: track.phrases.map((p) =>
              p.id === action.id ? { ...p, length: Math.max(0, action.newLength) } : p
            ),
          },
        },
      };
    }

    case "TOGGLE_NOTE_FLAG": {
      const track = chart.tracks[action.track];
      if (!track) return chart;
      const idSet = new Set(action.ids);
      const notes = track.notes.map((n) => {
        if (!idSet.has(n.id)) return n;
        const flags = { ...(n.flags ?? {}) };
        flags[action.flag] = !flags[action.flag];
        // Clean up false values
        if (!flags[action.flag]) delete flags[action.flag];
        return { ...n, flags: Object.keys(flags).length > 0 ? flags : undefined };
      });
      return {
        ...chart,
        tracks: { ...chart.tracks, [action.track]: { ...track, notes } },
      };
    }

    case "ADD_SECTION": {
      const sections = [...(chart.sections ?? []), action.section].sort((a, b) => a.tick - b.tick);
      return { ...chart, sections };
    }

    case "RENAME_SECTION": {
      const sections = (chart.sections ?? []).map((s) =>
        s.id === action.id ? { ...s, name: action.name } : s
      );
      return { ...chart, sections };
    }

    case "DELETE_SECTION": {
      const sections = (chart.sections ?? []).filter((s) => s.id !== action.id);
      return { ...chart, sections };
    }

    case "SET_LYRICS":
      return { ...chart, lyrics: action.lyrics };

    case "PASTE_NOTES": {
      const track = chart.tracks[action.track];
      if (!track) return chart;
      const notes = [...track.notes, ...action.notes].sort((a, b) => a.tick - b.tick);
      return {
        ...chart,
        tracks: { ...chart.tracks, [action.track]: { ...track, notes } },
      };
    }

    case "SET_METADATA":
      return { ...chart, metadata: action.metadata };

    case "SET_TRACK": {
      return {
        ...chart,
        tracks: { ...chart.tracks, [action.trackKey]: action.track },
      };
    }

    case "TOGGLE_BPM_ANCHOR": {
      const events = chart.syncTrack.bpmEvents.map((e) =>
        e.tick === action.tick ? { ...e, anchor: !e.anchor } : e
      );
      return { ...chart, syncTrack: { ...chart.syncTrack, bpmEvents: events } };
    }

    default:
      return chart;
  }
}

// ─────────────────────── History reducer ─────────────────────────

const HISTORY_LIMIT = 100;

interface HistoryState {
  past: ChartData[];
  present: ChartData;
  future: ChartData[];
  // Gesture of the last DO; consecutive DOs with the same key share one undo step
  coalesceKey: string | null;
}

type HistoryAction =
  // coalesceKey: id of a mouse gesture (drag, resize) that dispatches on every move
  | { type: "DO"; action: EditAction; coalesceKey?: string }
  | { type: "UNDO" }
  | { type: "REDO" };

const INITIAL_CHART: ChartData = {
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
  syncTrack: {
    bpmEvents: [{ tick: 0, bpm: 120 }],
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
  },
  events: [],
  sections: [],
  lyrics: [],
  tracks: {},
};

function historyReducer(
  state: HistoryState,
  action: HistoryAction
): HistoryState {
  switch (action.type) {
    case "DO": {
      const next = applyAction(state.present, action.action);
      if (next === state.present) return state;
      if (action.coalesceKey && action.coalesceKey === state.coalesceKey) {
        return { ...state, present: next, future: [] };
      }
      return {
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.present],
        present: next,
        future: [],
        coalesceKey: action.coalesceKey ?? null,
      };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future.slice(0, HISTORY_LIMIT - 1)],
        coalesceKey: null,
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.present],
        present: next,
        future: state.future.slice(1),
        coalesceKey: null,
      };
    }
    default:
      return state;
  }
}

// ─────────────────────── Main Component ──────────────────────────

export function ChartEditor() {
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: INITIAL_CHART,
    future: [],
    coalesceKey: null,
  });
  const chart = history.present;

  const [selectedTrack, setSelectedTrack] = useState<TrackKey | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    new Set()
  );
  const [zoom, setZoom] = useState(120);
  const [renderDistance, setRenderDistance] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [snapDivision, setSnapDivision] = useState(16);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [chartFileName, setChartFileName] = useState<string>();

  // Edit mode state (note / phrase / eraser)
  const [editMode, setEditMode] = useState<"note" | "phrase" | "eraser">("note");
  const [phraseType, setPhraseType] = useState<Phrase["type"]>("starPower");
  const phraseTypeRef = useRef(phraseType);
  phraseTypeRef.current = phraseType;

  // Drum mode (4-lane vs 5-lane)
  const [drumMode, setDrumMode] = useState<DrumMode>("4lane");

  // Bookmarks (10 slots, indexed 0-9)
  const [bookmarks, setBookmarks] = useState<(number | null)[]>(Array(10).fill(null));

  // Lefty-flip mode
  const [leftyFlip, setLeftyFlip] = useState(false);

  // Clap/hit sounds
  const [clapEnabled, setClapEnabled] = useState(false);
  const clapEnabledRef = useRef(false);
  clapEnabledRef.current = clapEnabled;

  // Pattern catalog
  const [catalogPatterns, setCatalogPatterns] = useState<{ name: string; notes: Note[] }[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("chart-editor-catalog");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showCatalog, setShowCatalog] = useState(false);

  // Piano tone preview for vocals
  const [pianoPreview, setPianoPreview] = useState(false);
  const pianoOscRef = useRef<OscillatorNode | null>(null);

  // Autosave
  const autosaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryData, setRecoveryData] = useState<ChartData | null>(null);

  // Keyboard shortcuts panel
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Name prompt (new section at the playhead, or a catalog pattern from the selection)
  const [namePrompt, setNamePrompt] = useState<{ kind: "section"; tick: number } | { kind: "pattern" } | null>(null);

  // Validation & Statistics panels
  const [showValidation, setShowValidation] = useState(false);

  // Song info (metadata) dialog
  const [showMetadata, setShowMetadata] = useState(false);

  // Chart as of the last save or load: anything else is unsaved work
  const [savedChart, setSavedChart] = useState<ChartData>(INITIAL_CHART);
  const [showStatistics, setShowStatistics] = useState(false);

  // Ghost notes (difficulty reference overlay)
  const [ghostTrackKey, setGhostTrackKey] = useState<TrackKey | null>(null);

  // Auto-reduce dialog
  const [showAutoReduce, setShowAutoReduce] = useState(false);

  // BPM detection dialog
  const [showBpmDetect, setShowBpmDetect] = useState(false);

  // Density overlay
  const [densityOverlay, setDensityOverlay] = useState(false);

  // Global view (minimap)
  const [showGlobalView, setShowGlobalView] = useState(true);

  // Practice loop
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const loopARef = useRef<number | null>(null);
  const loopBRef = useRef<number | null>(null);

  // Metronome
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const metronomeRef = useRef<MetronomeScheduler | null>(null);
  const clapRef = useRef<ClapScheduler | null>(null);

  // Clipboard for copy/paste
  const clipboardRef = useRef<Note[]>([]);

  // Visualization mode (waveform vs mel spectrogram)
  const [vizMode, setVizMode] = useState<"waveform" | "spectrogram" | "none">("waveform");
  const vizModeRef = useRef(vizMode);
  useEffect(() => { vizModeRef.current = vizMode; }, [vizMode]);
  const [spectrograms, setSpectrograms] = useState<Map<string, SpectrogramData>>(new Map());
  const [spectrogramLoading, setSpectrogramLoading] = useState(false);
  const spectrogramsRef = useRef(spectrograms);
  spectrogramsRef.current = spectrograms;

  // Multi-stem audio state
  const [stems, setStems] = useState<Map<string, AudioStem>>(new Map());
  const [mutedStems, setMutedStems] = useState<Set<string>>(new Set());

  // Stable refs so callbacks don't need to redeclare deps on everything
  const chartRef = useRef(chart);
  chartRef.current = chart;
  const stemsRef = useRef(stems);
  stemsRef.current = stems;
  const mutedStemsRef = useRef(mutedStems);
  mutedStemsRef.current = mutedStems;
  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  const selectedNoteIdsRef = useRef(selectedNoteIds);
  selectedNoteIdsRef.current = selectedNoteIds;
  const selectedTrackRef = useRef(selectedTrack);
  selectedTrackRef.current = selectedTrack;
  const currentTickRef = useRef(currentTick);
  currentTickRef.current = currentTick;
  const metronomeEnabledRef = useRef(metronomeEnabled);
  metronomeEnabledRef.current = metronomeEnabled;
  loopARef.current = loopA;
  loopBRef.current = loopB;
  const tickFrameRef = useRef(0);

  // Seek callback ref for the animation loop (set after handleSeek is defined)
  const handleSeekStableRef = useRef<((tick: number) => void) | null>(null);

  // Audio engine refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const playbackStartTimeRef = useRef(0);
  const playbackStartTickRef = useRef(0);
  // Chart time (seconds) at playbackStartTick, and the tempo map playback was started with
  const playbackStartSecondsRef = useRef(0);
  const playbackTempoMapRef = useRef<TempoPoint[] | null>(null);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  const rafRef = useRef<number>(0);

  function getAudioCtx(): AudioContext {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }

  // Active waveform = stem matching the current instrument
  const activeWaveform = useMemo<WaveformData | undefined>(() => {
    if (stems.size === 0) return undefined;
    if (!selectedTrack) {
      return stems.values().next().value?.waveform;
    }
    const parsed = parseTrackKey(selectedTrack);
    if (!parsed) return stems.values().next().value?.waveform;
    const priorities = INSTRUMENT_STEMS[parsed.instrument];
    for (const label of priorities) {
      const stem = stems.get(label);
      if (stem) return stem.waveform;
    }
    return stems.values().next().value?.waveform;
  }, [selectedTrack, stems]);

  // Active spectrogram = same stem priority as waveform
  const activeSpectrogram = useMemo<SpectrogramData | undefined>(() => {
    if (spectrograms.size === 0) return undefined;
    if (!selectedTrack) {
      const firstLabel = stems.keys().next().value;
      return firstLabel ? spectrograms.get(firstLabel) : undefined;
    }
    const parsed = parseTrackKey(selectedTrack);
    if (!parsed) {
      const firstLabel = stems.keys().next().value;
      return firstLabel ? spectrograms.get(firstLabel) : undefined;
    }
    const priorities = INSTRUMENT_STEMS[parsed.instrument];
    for (const label of priorities) {
      const spec = spectrograms.get(label);
      if (spec) return spec;
    }
    const firstLabel = stems.keys().next().value;
    return firstLabel ? spectrograms.get(firstLabel) : undefined;
  }, [selectedTrack, stems, spectrograms]);

  // Lazily compute spectrograms when switching to spectrogram mode
  const handleVizModeChange = useCallback((mode: "waveform" | "spectrogram" | "none") => {
    setVizMode(mode);
    if (mode !== "spectrogram") return;
    // Check if any stems need computing
    const missing = [...stemsRef.current.keys()].filter(
      (label) => !spectrogramsRef.current.has(label)
    );
    if (missing.length === 0) return;
    setSpectrogramLoading(true);
    // Defer so the loading state renders before the blocking compute
    setTimeout(() => {
      const next = new Map(spectrogramsRef.current);
      for (const label of missing) {
        const stem = stemsRef.current.get(label);
        if (stem) next.set(label, computeSpectrogram(stem.buffer, chartRef.current));
      }
      setSpectrograms(next);
      setSpectrogramLoading(false);
    }, 50);
  }, []);

  // Auto-select first track when chart loads
  useEffect(() => {
    if (selectedTrack && chart.tracks[selectedTrack]) return;
    for (const diff of DIFFICULTY_ORDER) {
      for (const inst of INSTRUMENT_ORDER) {
        const key = makeTrackKey(diff, inst);
        if (chart.tracks[key]) {
          setSelectedTrack(key);
          return;
        }
      }
    }
  }, [chart.tracks, selectedTrack]);

  // Autosave every 30 seconds
  useEffect(() => {
    if (Object.keys(chart.tracks).length === 0) return;
    autosaveTimerRef.current = setInterval(() => {
      try {
        const data = JSON.stringify(chartRef.current);
        localStorage.setItem("chart-editor-autosave", data);
        localStorage.setItem("chart-editor-autosave-time", Date.now().toString());
      } catch { /* storage full, ignore */ }
    }, 30000);
    return () => { if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current); };
  }, [Object.keys(chart.tracks).length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for recovery on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("chart-editor-autosave");
      const savedTime = localStorage.getItem("chart-editor-autosave-time");
      if (saved && savedTime) {
        const age = Date.now() - parseInt(savedTime);
        if (age < 24 * 60 * 60 * 1000) { // less than 24 hours old
          const parsed = JSON.parse(saved) as ChartData;
          if (Object.keys(parsed.tracks).length > 0) {
            setRecoveryData(parsed);
            setShowRecovery(true);
          }
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Persist catalog to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("chart-editor-catalog", JSON.stringify(catalogPatterns));
    } catch { /* ignore */ }
  }, [catalogPatterns]);

  // Piano tone preview — defined after isVocalsTrack below

  // Animation loop — only depends on isPlaying; reads chart via chartRef to avoid
  // restarting (and stuttering) on every chart edit while playing.
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    function frame() {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      // Advance in chart seconds and map back through the tempo map, so the
      // playhead follows every BPM change instead of the tempo at the start tick
      const tempoMap = playbackTempoMapRef.current ?? buildTempoMap(chartRef.current);
      const elapsed = ctx.currentTime - playbackStartTimeRef.current;
      const speed = playbackSpeedRef.current;
      const newTick = secondsToTick(playbackStartSecondsRef.current + elapsed * speed, tempoMap);

      // Practice loop: seek back to loopA when passing loopB
      const la = loopARef.current;
      const lb = loopBRef.current;
      if (la !== null && lb !== null && la < lb && newTick > lb) {
        // Restarts the stems at A; keep the frame loop running afterwards
        handleSeekStableRef.current?.(la);
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      currentTickRef.current = newTick;           // always 60fps (no React)
      tickFrameRef.current++;
      if (tickFrameRef.current % 6 === 0) {
        setCurrentTick(newTick);                  // ~10fps for UI elements
      }
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Waveforms (and spectrograms) map audio samples to ticks through the tempo map
  // and offset, so redo them when either changes. Debounced: BPM drags commit often.
  useEffect(() => {
    if (stemsRef.current.size === 0) return;
    const timer = setTimeout(() => {
      const current = chartRef.current;
      const next = new Map<string, AudioStem>();
      for (const [label, stem] of stemsRef.current) {
        next.set(label, { ...stem, waveform: computeWaveform(stem.buffer, current) });
      }
      const specs = new Map<string, SpectrogramData>();
      if (vizModeRef.current === "spectrogram") {
        for (const [label, stem] of next) specs.set(label, computeSpectrogram(stem.buffer, current));
      }
      setStems(next);
      setSpectrograms(specs);
    }, 300);
    return () => clearTimeout(timer);
  }, [chart.syncTrack, chart.metadata.offset, chart.metadata.resolution]);

  // Audio files upload (multiple stems) — decode all files in parallel
  const handleAudioFiles = useCallback(async (files: File[]) => {
    const ctx = getAudioCtx();
    const currentChart = chartRef.current;
    const settled = await Promise.allSettled(
      files.map(async (file) => {
        const label = inferStemLabel(file.name);
        const buf = await file.arrayBuffer();
        const decoded = await ctx.decodeAudioData(buf);
        const waveform = computeWaveform(decoded, currentChart);
        return { label, buffer: decoded, waveform };
      })
    );
    // One unreadable file shouldn't drop the others
    const results = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const failed = files.filter((_, i) => settled[i].status === "rejected").map((f) => f.name);
    if (failed.length > 0) {
      toast.error(`Could not decode ${failed.join(", ")}`, {
        description: "The browser can't read this audio file. Try OGG, MP3 or WAV.",
      });
    }
    if (results.length === 0) return;
    setStems((prev) => {
      const next = new Map(prev);
      for (const { label, buffer, waveform } of results) {
        next.set(label, { label, buffer, waveform });
      }
      return next;
    });
    setSpectrograms((prev) => {
      const labelsToDelete = results.map((r) => r.label).filter((l) => prev.has(l));
      if (labelsToDelete.length === 0) return prev;
      const next = new Map(prev);
      for (const label of labelsToDelete) next.delete(label);
      return next;
    });
  }, []);

  // Mute toggle
  const toggleMute = useCallback((label: string) => {
    setMutedStems((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
        const gn = gainNodesRef.current.get(label);
        if (gn) gn.gain.value = 1;
      } else {
        next.add(label);
        const gn = gainNodesRef.current.get(label);
        if (gn) gn.gain.value = 0;
      }
      return next;
    });
  }, []);

  const stopAudio = useCallback(() => {
    for (const src of sourceNodesRef.current.values()) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    sourceNodesRef.current.clear();
    gainNodesRef.current.clear();
    metronomeRef.current?.stop();
    clapRef.current?.stop();
  }, []);

  // Start every stem (plus metronome/clap) at a chart tick, converting through the tempo map
  const startAudioAt = useCallback((tick: number) => {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    const currentChart = chartRef.current;
    const resolution = currentChart.metadata.resolution || 192;
    const tempoMap = buildTempoMap(currentChart);
    const speed = playbackSpeedRef.current;
    const chartSeconds = tickToSeconds(tick, tempoMap);
    // chartTime = audioTime - offset (same convention as waveform.ts)
    const audioSeconds = chartSeconds + currentChart.metadata.offset;
    const now = ctx.currentTime;

    for (const [label, stem] of stemsRef.current) {
      const source = ctx.createBufferSource();
      source.buffer = stem.buffer;
      source.playbackRate.value = speed;
      const gain = ctx.createGain();
      gain.gain.value = mutedStemsRef.current.has(label) ? 0 : 1;
      source.connect(gain);
      gain.connect(ctx.destination);
      // Before the audio begins (negative offset): delay the start instead of clamping to 0
      if (audioSeconds >= 0) source.start(now, audioSeconds);
      else source.start(now - audioSeconds / speed, 0);
      sourceNodesRef.current.set(label, source);
      gainNodesRef.current.set(label, gain);
    }

    playbackStartTimeRef.current = now;
    playbackStartTickRef.current = tick;
    playbackStartSecondsRef.current = chartSeconds;
    playbackTempoMapRef.current = tempoMap;

    if (metronomeEnabledRef.current) {
      const metro = new MetronomeScheduler(ctx, tempoMap, currentChart.syncTrack.timeSignatures, resolution);
      metro.start(tick, speed);
      metronomeRef.current = metro;
    }

    if (clapEnabledRef.current && selectedTrackRef.current) {
      const track = currentChart.tracks[selectedTrackRef.current];
      if (track) {
        const clap = new ClapScheduler(ctx, tempoMap, track.notes, resolution);
        clap.start(tick, speed);
        clapRef.current = clap;
      }
    }
  }, []);

  // Play/pause — uses the 60fps tick ref (the state only updates every few frames)
  const handlePlayPause = useCallback(() => {
    if (isPlayingRef.current) {
      stopAudio();
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentTick(currentTickRef.current);
    } else {
      startAudioAt(currentTickRef.current);
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  }, [stopAudio, startAudioAt]);

  const handleStop = useCallback(() => {
    stopAudio();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentTick(0);
  }, [stopAudio]);

  // Seek to a tick — restarts audio at the new position if currently playing
  const handleSeek = useCallback((tick: number) => {
    const target = Math.max(0, tick);
    stopAudio();
    currentTickRef.current = target;
    setCurrentTick(target);
    if (isPlayingRef.current) startAudioAt(target);
  }, [stopAudio, startAudioAt]);
  handleSeekStableRef.current = handleSeek;

  // Load a chart file, filling empty metadata from song.ini when given. Failures are shown, not swallowed.
  const loadChartFile = useCallback(async (file: File, songIni?: File) => {
    const lower = file.name.toLowerCase();
    let parsed: ChartData;
    // The parser falls back to 120 BPM, so "has a tempo map" means the file declared one
    let hasSyncTrack = true;
    try {
      if (lower.endsWith(".chart")) {
        const text = await file.text();
        hasSyncTrack = /^\s*\[SyncTrack\]/im.test(text);
        parsed = parseChart(text);
      } else if (lower.endsWith(".mid") || lower.endsWith(".midi")) parsed = parseMidi(await file.arrayBuffer());
      else {
        toast.error(`${file.name} is not a chart file`, { description: "Use a .chart or .mid / .midi file." });
        return;
      }
    } catch (err) {
      toast.error(`Could not read ${file.name}`, {
        description: err instanceof Error ? err.message : "The file is damaged or in an unknown format.",
      });
      return;
    }

    if (Object.keys(parsed.tracks).length === 0) {
      if (!hasSyncTrack || parsed.syncTrack.bpmEvents.length === 0) {
        toast.error(`Could not read ${file.name}`, { description: "No tempo map and no instrument tracks were found." });
        return;
      }
      // A tempo map without notes (e.g. a freshly saved new chart): start an empty Guitar track
      parsed = { ...parsed, tracks: { ExpertSingle: emptyTrack("Expert", "Single") } };
    }
    if (parsed.syncTrack.bpmEvents.length === 0) {
      parsed = { ...parsed, syncTrack: { ...parsed.syncTrack, bpmEvents: [{ tick: 0, bpm: 120 }] } };
    }
    if (parsed.syncTrack.timeSignatures.length === 0) {
      parsed = { ...parsed, syncTrack: { ...parsed.syncTrack, timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }] } };
    }

    if (songIni) {
      try {
        const ini = parseSongIni(await songIni.text());
        const metadata = { ...parsed.metadata };
        for (const key of ["name", "artist", "album", "genre", "year", "charter"] as const) {
          if (!metadata[key] && ini[key]) metadata[key] = ini[key];
        }
        if (metadata.offset === 0 && ini.offset !== undefined) metadata.offset = ini.offset;
        parsed = { ...parsed, metadata };
      } catch {
        toast.warning("song.ini could not be read; using the chart's own metadata");
      }
    }

    stopAudio();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setChartFileName(file.name);
    dispatch({ type: "DO", action: { type: "SET_CHART", chart: parsed } });
    setSavedChart(parsed);
    setCurrentTick(0);
    setSelectedNoteIds(new Set());
  }, [stopAudio]);

  // A whole song folder or several files at once: chart + stems + song.ini
  const handleSongFiles = useCallback(async (files: File[]) => {
    const { chart: chartFile, audio, songIni } = classifySongFiles(files);
    if (!chartFile && audio.length === 0) {
      toast.error("No chart or audio files found", {
        description: "Expected notes.chart or notes.mid, plus .ogg / .mp3 / .wav / .flac / .opus stems.",
      });
      return;
    }
    if (chartFile) await loadChartFile(chartFile, songIni);
    if (audio.length > 0) await handleAudioFiles(audio);
  }, [loadChartFile, handleAudioFiles]);

  // Start from scratch (e.g. only audio is loaded): 120 BPM, 4/4, an empty Expert Guitar track
  const handleNewChart = useCallback(() => {
    const fresh: ChartData = {
      ...INITIAL_CHART,
      tracks: { ExpertSingle: emptyTrack("Expert", "Single") },
    };
    dispatch({ type: "DO", action: { type: "SET_CHART", chart: fresh } });
    setSavedChart(fresh);
    setChartFileName(undefined);
    setSelectedTrack("ExpertSingle");
    setSelectedNoteIds(new Set());
    setCurrentTick(0);
    setShowMetadata(true);
  }, []);

  // Save = download in the format it was loaded in (YARG/Clone Hero read notes.chart / notes.mid)
  const handleSave = useCallback(() => {
    const current = chartRef.current;
    if (Object.keys(current.tracks).length === 0) return;
    const fileName = chartFileName ?? "notes.chart";
    if (/\.midi?$/i.test(fileName)) downloadMidi(current, fileName);
    else downloadChart(current, fileName);
    setSavedChart(current);
    try {
      localStorage.setItem("chart-editor-autosave", JSON.stringify(current));
      localStorage.setItem("chart-editor-autosave-time", Date.now().toString());
    } catch { /* storage full, ignore */ }
    toast.success(`Saved ${fileName}`, { description: "Downloaded to your browser's download folder." });
  }, [chartFileName]);

  // Live speed change
  useEffect(() => {
    if (!isPlaying) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    for (const src of sourceNodesRef.current.values()) {
      src.playbackRate.value = playbackSpeed;
    }
    const tick = currentTickRef.current;
    playbackStartTickRef.current = tick;
    playbackStartSecondsRef.current = tickToSeconds(
      tick,
      playbackTempoMapRef.current ?? buildTempoMap(chartRef.current)
    );
    playbackStartTimeRef.current = ctx.currentTime;
    metronomeRef.current?.setPlaybackSpeed(playbackSpeed);
    clapRef.current?.setPlaybackSpeed(playbackSpeed);
  }, [playbackSpeed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      )
        return;
      // A dialog or an open dropdown owns the keyboard (Delete must not edit the chart behind it)
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]')) return;

      if (e.code === "Space") {
        e.preventDefault();
        // Otherwise the focused button would also fire on keyup (e.g. Play → toggles twice)
        if (target?.closest("button, [role='button'], [role='combobox']")) target.blur();
        handlePlayPause();
        return;
      }

      // ? key: show shortcuts panel
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      // N key: toggle clap sounds
      if (e.key === "n" || e.key === "N") {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setClapEnabled((v) => !v);
          return;
        }
      }

      // P key: toggle piano tone preview (vocals)
      if (e.key === "p" || e.key === "P") {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setPianoPreview((v) => !v);
          return;
        }
      }

      // K key: switch to eraser mode (Shift+K is double kick, handled below)
      if (e.key === "k" || e.key === "K") {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          setEditMode((m) => m === "eraser" ? "note" : "eraser");
          return;
        }
      }

      // L key: toggle lefty-flip
      if (e.key === "l" || e.key === "L") {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setLeftyFlip((v) => !v);
          return;
        }
      }

      // Bookmark shortcuts: Ctrl+0-9 to set, 0-9 to jump
      if (e.key >= "0" && e.key <= "9") {
        const idx = parseInt(e.key);
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setBookmarks((prev) => {
            const next = [...prev];
            next[idx] = Math.round(currentTickRef.current);
            return next;
          });
          return;
        } else {
          // Jump to bookmark (only if no modifier keys)
          if (!e.shiftKey && !e.altKey) {
            const bm = bookmarks[idx];
            if (bm !== null) {
              e.preventDefault();
              handleSeek(bm);
              return;
            }
          }
        }
      }

      // I key: set loop start (A)
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        setLoopA(Math.round(currentTickRef.current));
        return;
      }

      // O key: set loop end (B)
      if (e.key === "o" || e.key === "O") {
        e.preventDefault();
        setLoopB(Math.round(currentTickRef.current));
        return;
      }

      // Escape: clear the selection first, then the loop points
      if (e.key === "Escape") {
        if (selectedNoteIdsRef.current.size > 0) {
          e.preventDefault();
          setSelectedNoteIds(new Set());
          return;
        }
        if (loopARef.current !== null || loopBRef.current !== null) {
          e.preventDefault();
          setLoopA(null);
          setLoopB(null);
          return;
        }
      }

      // [ / ] keys: jump to previous/next section
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        const sortedSections = [...(chartRef.current.sections ?? [])].sort((a, b) => a.tick - b.tick);
        if (sortedSections.length === 0) return;
        const tick = currentTickRef.current;
        if (e.key === "[") {
          // Jump to previous section
          let target: number | null = null;
          for (let i = sortedSections.length - 1; i >= 0; i--) {
            if (sortedSections[i].tick < tick - 1) { target = sortedSections[i].tick; break; }
          }
          if (target !== null) handleSeek(target);
        } else {
          // Jump to next section
          for (const section of sortedSections) {
            if (section.tick > tick + 1) { handleSeek(section.tick); break; }
          }
        }
        return;
      }

      const track = selectedTrackRef.current;
      const noteIds = selectedNoteIdsRef.current;

      // Navigation: PageUp/PageDown = next/previous measure, Home/End = start/end,
      // Arrow Up/Down without a selection = one snap step
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const currentChart = chartRef.current;
        const tick = currentTickRef.current;
        if (e.key === "PageUp" || e.key === "PageDown") {
          e.preventDefault();
          handleSeek(measureStep(currentChart, tick, e.key === "PageUp" ? 1 : -1));
          return;
        }
        if (e.key === "Home" || e.key === "End") {
          e.preventDefault();
          handleSeek(e.key === "Home" ? 0 : getChartDurationTicks(chartRef.current));
          return;
        }
        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && noteIds.size === 0) {
          e.preventDefault();
          const gridTicks = snapDivisionToTicks(currentChart.metadata.resolution || 192, snapDivision);
          const target = gridStep(tick, gridTicks, e.key === "ArrowUp" ? 1 : -1);
          handleSeek(Math.min(getChartDurationTicks(chartRef.current), target));
          return;
        }
      }

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        noteIds.size > 0 &&
        track
      ) {
        e.preventDefault();
        dispatch({
          type: "DO",
          action: {
            type: "DELETE_NOTES",
            track,
            ids: [...noteIds],
          },
        });
        setSelectedNoteIds(new Set());
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          handleSave();
          return;
        }
        if (e.key === "a") {
          // Select all notes in current track
          if (track) {
            e.preventDefault();
            const currentTrack = chartRef.current.tracks[track];
            if (currentTrack) {
              setSelectedNoteIds(new Set(currentTrack.notes.map((n) => n.id)));
            }
          }
          return;
        }
        // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo (macOS convention)
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          dispatch({ type: e.shiftKey ? "REDO" : "UNDO" });
          return;
        }
        if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          dispatch({ type: "REDO" });
          return;
        }
        if (e.key === "c") {
          // Copy
          if (noteIds.size > 0 && track) {
            e.preventDefault();
            const currentTrack = chartRef.current.tracks[track];
            if (currentTrack) {
              clipboardRef.current = currentTrack.notes.filter((n) => noteIds.has(n.id));
            }
          }
          return;
        }
        if (e.key === "x") {
          // Cut = copy + delete
          if (noteIds.size > 0 && track) {
            e.preventDefault();
            const currentTrack = chartRef.current.tracks[track];
            if (currentTrack) {
              clipboardRef.current = currentTrack.notes.filter((n) => noteIds.has(n.id));
              dispatch({
                type: "DO",
                action: { type: "DELETE_NOTES", track, ids: [...noteIds] },
              });
              setSelectedNoteIds(new Set());
            }
          }
          return;
        }
        if (e.key === "v") {
          // Paste at current tick
          if (clipboardRef.current.length > 0 && track) {
            e.preventDefault();
            const clipboard = clipboardRef.current;
            let minTick = clipboard[0].tick;
            for (let i = 1; i < clipboard.length; i++) {
              if (clipboard[i].tick < minTick) minTick = clipboard[i].tick;
            }
            // Anchor on the nearest grid line so pasted notes stay on the grid
            const gridTicks = snapDivisionToTicks(chartRef.current.metadata.resolution || 192, snapDivision);
            const pastedTick = snapToGrid(currentTickRef.current, gridTicks);
            const offset = pastedTick - minTick;
            const newNotes: Note[] = clipboard.map((n) => ({
              ...n,
              id: uuidv4(),
              tick: Math.max(0, n.tick + offset),
            }));
            dispatch({
              type: "DO",
              action: { type: "PASTE_NOTES", track, notes: newNotes },
            });
            setSelectedNoteIds(new Set(newNotes.map((n) => n.id)));
          }
          return;
        }
        if (e.key === "d") {
          // Duplicate: copy + paste offset by selection length
          if (noteIds.size > 0 && track) {
            e.preventDefault();
            const currentTrack = chartRef.current.tracks[track];
            if (currentTrack) {
              const selected = currentTrack.notes.filter((n) => noteIds.has(n.id));
              if (selected.length > 0) {
                const minTick = Math.min(...selected.map((n) => n.tick));
                const maxTick = Math.max(...selected.map((n) => n.tick + n.length));
                const selectionLength = maxTick - minTick;
                const newNotes: Note[] = selected.map((n) => ({
                  ...n,
                  id: uuidv4(),
                  tick: n.tick + selectionLength,
                }));
                dispatch({
                  type: "DO",
                  action: { type: "PASTE_NOTES", track, notes: newNotes },
                });
                setSelectedNoteIds(new Set(newNotes.map((n) => n.id)));
              }
            }
          }
          return;
        }
        return;
      }

      // H key: toggle Force HOPO on selected notes
      if (e.key === "h" || e.key === "H") {
        if (noteIds.size > 0 && track) {
          e.preventDefault();
          dispatch({
            type: "DO",
            action: {
              type: "TOGGLE_NOTE_FLAG",
              track,
              ids: [...noteIds],
              flag: "forceHopo",
            },
          });
        }
        return;
      }

      // S key: toggle Force Strum on selected notes
      if (e.key === "s" || e.key === "S") {
        if (noteIds.size > 0 && track) {
          e.preventDefault();
          dispatch({
            type: "DO",
            action: {
              type: "TOGGLE_NOTE_FLAG",
              track,
              ids: [...noteIds],
              flag: "forceStrum",
            },
          });
        }
        return;
      }

      // T key: toggle tap flag
      if (e.key === "t" || e.key === "T") {
        if (noteIds.size > 0 && track) {
          e.preventDefault();
          dispatch({
            type: "DO",
            action: { type: "TOGGLE_NOTE_FLAG", track, ids: [...noteIds], flag: "tap" },
          });
        }
        return;
      }

      // O key: toggle open note flag (guitar/bass only, when not setting loop)
      // (Loop is handled by lowercase 'o' above, so we check for uppercase)
      // Actually, let's use Shift+O for open note to avoid conflict with loop
      // No — let's use a different approach. The loop handler runs first.
      // We'll catch it only when there's a selection.

      // C key: toggle cymbal flag (drums only)
      if (e.key === "c" || e.key === "C") {
        if (!e.ctrlKey && !e.metaKey && noteIds.size > 0 && track) {
          const parsed = parseTrackKey(track);
          if (parsed?.instrument === "Drums") {
            e.preventDefault();
            dispatch({
              type: "DO",
              action: { type: "TOGGLE_NOTE_FLAG", track, ids: [...noteIds], flag: "cymbal" },
            });
            return;
          }
        }
      }

      // A key: toggle accent flag (drums only)
      if (e.key === "a" || e.key === "A") {
        if (!e.ctrlKey && !e.metaKey && noteIds.size > 0 && track) {
          const parsed = parseTrackKey(track);
          if (parsed?.instrument === "Drums") {
            e.preventDefault();
            dispatch({
              type: "DO",
              action: { type: "TOGGLE_NOTE_FLAG", track, ids: [...noteIds], flag: "accent" },
            });
            return;
          }
        }
      }

      // Shift+G: toggle ghost flag (drums only)
      if (e.key === "G" && e.shiftKey) {
        if (noteIds.size > 0 && track) {
          const parsed = parseTrackKey(track);
          if (parsed?.instrument === "Drums") {
            e.preventDefault();
            dispatch({
              type: "DO",
              action: { type: "TOGGLE_NOTE_FLAG", track, ids: [...noteIds], flag: "ghost" },
            });
            return;
          }
        }
      }

      // Shift+K: toggle double kick / Expert+ (drums only)
      if (e.key === "K" && e.shiftKey) {
        if (noteIds.size > 0 && track) {
          const parsed = parseTrackKey(track);
          if (parsed?.instrument === "Drums") {
            e.preventDefault();
            dispatch({
              type: "DO",
              action: { type: "TOGGLE_NOTE_FLAG", track, ids: [...noteIds], flag: "doubleKick" },
            });
            return;
          }
        }
      }

      // F key: toggle open note (guitar/bass only)
      // Using F since H=HOPO, S=Strum are taken; F for "Free" / open fret
      if (e.key === "f" || e.key === "F") {
        if (noteIds.size > 0 && track) {
          const parsed = parseTrackKey(track);
          if (parsed && (parsed.instrument === "Single" || parsed.instrument === "DoubleBass")) {
            e.preventDefault();
            dispatch({
              type: "DO",
              action: { type: "TOGGLE_NOTE_FLAG", track, ids: [...noteIds], flag: "open" },
            });
            return;
          }
        }
      }

      // M key: add section at current playhead
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setNamePrompt({ kind: "section", tick: Math.round(currentTickRef.current) });
        return;
      }

      if (
        (e.key === "ArrowUp" || e.key === "ArrowDown") &&
        noteIds.size > 0 &&
        track
      ) {
        e.preventDefault();
        const resolution = chartRef.current.metadata.resolution || 192;
        const gridTicks = snapDivisionToTicks(resolution, snapDivision);
        const deltaTick = e.key === "ArrowUp" ? gridTicks : -gridTicks;
        dispatch({
          type: "DO",
          action: {
            type: "MOVE_NOTES",
            track,
            ids: [...noteIds],
            deltaTick,
            deltaFret: 0,
          },
        });
        return;
      }

      if (
        (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        noteIds.size > 0 &&
        track
      ) {
        e.preventDefault();
        const deltaFret = e.key === "ArrowRight" ? 1 : -1;
        dispatch({
          type: "DO",
          action: {
            type: "MOVE_NOTES",
            track,
            ids: [...noteIds],
            deltaTick: 0,
            deltaFret,
          },
        });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    handlePlayPause,
    handleSeek,
    handleSave,
    snapDivision,
    bookmarks,
  ]);

  const hasChart   = Object.keys(chart.tracks).length > 0;
  const isDirty    = hasChart && chart !== savedChart;

  // Warn before closing or reloading the tab with unsaved work
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // In-app navigation doesn't fire beforeunload: write the autosave when the editor unmounts
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => () => {
    if (!isDirtyRef.current) return;
    try {
      localStorage.setItem("chart-editor-autosave", JSON.stringify(chartRef.current));
      localStorage.setItem("chart-editor-autosave-time", Date.now().toString());
    } catch { /* storage full, ignore */ }
  }, []);

  const handleCreateTrack = useCallback((key: TrackKey) => {
    const parsed = parseTrackKey(key);
    if (!parsed || chartRef.current.tracks[key]) return;
    dispatch({ type: "DO", action: { type: "SET_TRACK", trackKey: key, track: emptyTrack(parsed.difficulty, parsed.instrument) } });
    setSelectedTrack(key);
    setSelectedNoteIds(new Set());
  }, []);

  const handleSaveMetadata = useCallback((metadata: ChartData["metadata"]) => {
    dispatch({ type: "DO", action: { type: "SET_METADATA", metadata } });
  }, []);
  const tempoMap   = useMemo(() => buildTempoMap(chart), [chart.syncTrack]);
  const bpm        = getBpmAtTick(currentTick, tempoMap);
  const totalTicks = useMemo(() => getChartDurationTicks(chart), [chart.tracks, chart.syncTrack]);
  const resolution = chart.metadata.resolution || 192;
  const viewportTicks = ((resolution * 960) / zoom) * renderDistance;

  // Mouse wheel over the lane: scroll through the song one snap step per notch
  // (wheel up = forward, like the highway), Ctrl/Cmd+wheel or pinch = zoom.
  // Non-passive listener so the page itself doesn't scroll.
  const laneContainerRef = useRef<HTMLDivElement>(null);
  const wheelAccumRef = useRef(0);
  const snapDivisionRef = useRef(snapDivision);
  useEffect(() => { snapDivisionRef.current = snapDivision; }, [snapDivision]);
  useEffect(() => {
    const el = laneContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scale = e.deltaMode === 1 ? 40 : 1; // DOM_DELTA_LINE → px
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * scale * 0.0015);
        setZoom((z) => Math.min(800, Math.max(30, z * factor)));
        return;
      }
      // Seeking restarts every stem, so don't scrub with the wheel while playing
      if (isPlayingRef.current) return;
      // Dominant axis: vertical wheel for the highway, horizontal swipe for the vocals lane
      const forward = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
      const px = forward * scale;
      let steps: number;
      if (Math.abs(px) >= 50) {
        // Mouse wheel notch: exactly one step
        steps = Math.sign(px);
        wheelAccumRef.current = 0;
      } else {
        // Trackpad: accumulate small deltas
        wheelAccumRef.current += px;
        steps = Math.trunc(wheelAccumRef.current / 25);
        wheelAccumRef.current -= steps * 25;
      }
      if (steps === 0) return;
      const currentChart = chartRef.current;
      const gridTicks = snapDivisionToTicks(currentChart.metadata.resolution || 192, snapDivisionRef.current);
      let target = currentTickRef.current;
      for (let i = 0; i < Math.abs(steps); i++) target = gridStep(target, gridTicks, steps > 0 ? 1 : -1);
      handleSeekStableRef.current?.(Math.min(getChartDurationTicks(chartRef.current), target));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [hasChart]);

  // First audio buffer (for BPM detection)
  const firstAudioBuffer = useMemo<AudioBuffer | undefined>(() => {
    if (stems.size === 0) return undefined;
    return stems.values().next().value?.buffer;
  }, [stems]);

  // Density heatmap for overlay
  const densityHeatmap = useMemo<Float32Array | undefined>(() => {
    if (!densityOverlay || !selectedTrack) return undefined;
    const track = chart.tracks[selectedTrack];
    if (!track) return undefined;
    return computeDensityHeatmap(track, chart.metadata.resolution || 192);
  }, [densityOverlay, selectedTrack, chart.tracks, chart.metadata.resolution]);

  // Ghost notes for difficulty reference
  const ghostNotes = useMemo(() => {
    if (!ghostTrackKey) return undefined;
    return chart.tracks[ghostTrackKey]?.notes;
  }, [ghostTrackKey, chart.tracks]);

  const isVocalsTrack = selectedTrack
    ? (() => {
        const inst = parseTrackKey(selectedTrack)?.instrument;
        return inst === "Vocals" || inst === "Harmony1" || inst === "Harmony2" || inst === "Harmony3";
      })()
    : false;

  // Piano tone preview — play a sine wave based on mouse Y position in vocals lane
  useEffect(() => {
    if (!pianoPreview || !isVocalsTrack) {
      if (pianoOscRef.current) {
        pianoOscRef.current.stop();
        pianoOscRef.current = null;
      }
      return;
    }

    const handler = (e: MouseEvent) => {
      const canvas = (e.target as HTMLElement)?.closest?.("canvas");
      if (!canvas) {
        if (pianoOscRef.current) { pianoOscRef.current.stop(); pianoOscRef.current = null; }
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const h = rect.height;
      const ratio = Math.max(0, Math.min(1, y / h));
      const pitch = Math.round(83 - ratio * 47);
      const freq = 440 * Math.pow(2, (pitch - 69) / 12);

      const ctx = getAudioCtx();
      if (!pianoOscRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        pianoOscRef.current = osc;
      } else {
        pianoOscRef.current.frequency.value = freq;
      }
    };

    window.addEventListener("mousemove", handler);
    return () => {
      window.removeEventListener("mousemove", handler);
      if (pianoOscRef.current) { pianoOscRef.current.stop(); pianoOscRef.current = null; }
    };
  }, [pianoPreview, isVocalsTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdateLyrics = useCallback(
    (lyrics: import("@/lib/chart/types").LyricEvent[]) => {
      dispatch({ type: "DO", action: { type: "SET_LYRICS", lyrics } });
    },
    []
  );

  // ── Stable callbacks for child components (read refs, never re-created) ───

  const handleSelectNotes = useCallback((ids: string[]) => {
    setSelectedNoteIds(new Set(ids));
  }, []);

  const handleAddNote = useCallback((tick: number, fret: number) => {
    const track = selectedTrackRef.current;
    if (!track) return;
    dispatch({ type: "DO", action: { type: "ADD_NOTE", track, note: { id: uuidv4(), tick, fret, length: 0 } } });
  }, []);

  const handleLaneDeleteNotes = useCallback((ids: string[]) => {
    const track = selectedTrackRef.current;
    if (!track) return;
    dispatch({ type: "DO", action: { type: "DELETE_NOTES", track, ids } });
    setSelectedNoteIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next; });
  }, []);

  // gestureId: passed by lanes for live drags so the whole gesture is one undo step
  const handleMoveNotes = useCallback((ids: string[], deltaTick: number, deltaFret: number, gestureId?: string) => {
    const track = selectedTrackRef.current;
    if (!track) return;
    dispatch({ type: "DO", action: { type: "MOVE_NOTES", track, ids, deltaTick, deltaFret }, coalesceKey: gestureId });
  }, []);

  const handleDragNotes = useCallback((positions: NotePosition[], gestureId: string) => {
    const track = selectedTrackRef.current;
    if (!track) return;
    dispatch({ type: "DO", action: { type: "SET_NOTE_POSITIONS", track, positions }, coalesceKey: gestureId });
  }, []);

  const handleResizeNote = useCallback((id: string, newLength: number, gestureId?: string) => {
    const track = selectedTrackRef.current;
    if (!track) return;
    dispatch({ type: "DO", action: { type: "RESIZE_NOTE", track, id, newLength }, coalesceKey: gestureId });
  }, []);

  // Right-click drag: add note with sustain
  const handleRightClickDrag = useCallback((tick: number, fret: number, endTick: number) => {
    const track = selectedTrackRef.current;
    if (!track) return;
    const length = Math.max(0, endTick - tick);
    const note: Note = { id: uuidv4(), tick, fret, length };
    dispatch({ type: "DO", action: { type: "ADD_NOTE", track, note } });
  }, []);

  const handleAddPhrase = useCallback((tick: number, length: number) => {
    const track = selectedTrackRef.current;
    if (!track) return;
    dispatch({ type: "DO", action: { type: "ADD_PHRASE", track, phrase: { id: uuidv4(), tick, length, type: phraseTypeRef.current } } });
  }, []);

  const handleDeletePhrase = useCallback((id: string) => {
    const track = selectedTrackRef.current;
    if (!track) return;
    dispatch({ type: "DO", action: { type: "DELETE_PHRASE", track, id } });
  }, []);

  const handleSelectTrack = useCallback((key: TrackKey) => {
    setSelectedTrack(key);
    setSelectedNoteIds(new Set());
  }, []);

  // ChartRuler callbacks (dispatch is stable from useReducer)
  const handleAddBpm = useCallback((tick: number, bpm: number) => {
    dispatch({ type: "DO", action: { type: "ADD_BPM", tick, bpm } });
  }, []);
  const handleDeleteBpm = useCallback((tick: number) => {
    dispatch({ type: "DO", action: { type: "DELETE_BPM", tick } });
  }, []);
  const handleAddTimeSignature = useCallback((tick: number, numerator: number, denominator: number) => {
    dispatch({ type: "DO", action: { type: "ADD_TIME_SIGNATURE", tick, numerator, denominator } });
  }, []);
  const handleDeleteTimeSignature = useCallback((tick: number) => {
    dispatch({ type: "DO", action: { type: "DELETE_TIME_SIGNATURE", tick } });
  }, []);
  const handleAddRulerSection = useCallback((id: string, tick: number, name: string) => {
    dispatch({ type: "DO", action: { type: "ADD_SECTION", section: { id, tick, name, type: "section" } } });
  }, []);
  const handleDeleteSection = useCallback((id: string) => {
    dispatch({ type: "DO", action: { type: "DELETE_SECTION", id } });
  }, []);
  const handleRenameSection = useCallback((id: string, name: string) => {
    dispatch({ type: "DO", action: { type: "RENAME_SECTION", id, name } });
  }, []);
  const handleMoveBpm = useCallback((from: number, to: number) => {
    dispatch({ type: "DO", action: { type: "MOVE_BPM", from, to } });
  }, []);
  const handleMoveTimeSignature = useCallback((from: number, to: number) => {
    dispatch({ type: "DO", action: { type: "MOVE_TIME_SIGNATURE", from, to } });
  }, []);
  const handleMoveSection = useCallback((id: string, tick: number) => {
    dispatch({ type: "DO", action: { type: "MOVE_SECTION", id, tick } });
  }, []);

  // PropertiesPanel callbacks
  const handleUpdateNote = useCallback((id: string, tick: number, fret: number, length: number) => {
    const track = selectedTrackRef.current;
    if (!track) return;
    dispatch({ type: "DO", action: { type: "UPDATE_NOTE", track, note: { id, tick, fret, length } } });
  }, []);
  const handlePropDeleteNotes = useCallback((ids: string[]) => {
    const track = selectedTrackRef.current;
    if (!track) return;
    dispatch({ type: "DO", action: { type: "DELETE_NOTES", track, ids } });
    setSelectedNoteIds(new Set());
  }, []);
  const handleToggleFlag = useCallback((id: string, flag: "forceHopo" | "forceStrum" | "tap" | "open" | "cymbal" | "accent" | "ghost" | "doubleKick") => {
    const track = selectedTrackRef.current;
    if (!track) return;
    dispatch({ type: "DO", action: { type: "TOGGLE_NOTE_FLAG", track, ids: [id], flag } });
  }, []);

  const handleUndo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const handleRedo = useCallback(() => dispatch({ type: "REDO" }), []);

  // Anchored BPM toggle
  const handleToggleBpmAnchor = useCallback((tick: number) => {
    dispatch({ type: "DO", action: { type: "TOGGLE_BPM_ANCHOR", tick } });
  }, []);

  // Recovery handlers
  const handleRecoverAutosave = useCallback(() => {
    if (recoveryData) {
      dispatch({ type: "DO", action: { type: "SET_CHART", chart: recoveryData } });
    }
    setShowRecovery(false);
    setRecoveryData(null);
  }, [recoveryData]);
  const handleDismissRecovery = useCallback(() => {
    setShowRecovery(false);
    setRecoveryData(null);
    localStorage.removeItem("chart-editor-autosave");
    localStorage.removeItem("chart-editor-autosave-time");
  }, []);

  // Catalog: save current selection as a pattern
  const handleSaveToCatalog = useCallback((name: string) => {
    const track = selectedTrackRef.current;
    if (!track) return;
    const currentTrack = chartRef.current.tracks[track];
    if (!currentTrack) return;
    const ids = selectedNoteIdsRef.current;
    if (ids.size === 0) return;
    const selected = currentTrack.notes.filter((n) => ids.has(n.id));
    if (selected.length === 0) return;
    // Normalize ticks relative to first note
    const minTick = Math.min(...selected.map((n) => n.tick));
    const normalized = selected.map((n) => ({ ...n, tick: n.tick - minTick }));
    setCatalogPatterns((prev) => [...prev, { name, notes: normalized }]);
  }, []);

  // Catalog: paste a pattern at current playhead
  const handlePasteFromCatalog = useCallback((pattern: Note[]) => {
    const track = selectedTrackRef.current;
    if (!track) return;
    const gridTicks = snapDivisionToTicks(chartRef.current.metadata.resolution || 192, snapDivisionRef.current);
    const tick = snapToGrid(currentTickRef.current, gridTicks);
    const newNotes = pattern.map((n) => ({
      ...n,
      id: uuidv4(),
      tick: n.tick + tick,
    }));
    dispatch({ type: "DO", action: { type: "PASTE_NOTES", track, notes: newNotes } });
    setSelectedNoteIds(new Set(newNotes.map((n) => n.id)));
  }, []);

  const handleDeleteCatalogPattern = useCallback((idx: number) => {
    setCatalogPatterns((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // BPM detection apply
  const handleBpmApply = useCallback((bpm: number) => {
    dispatch({ type: "DO", action: { type: "ADD_BPM", tick: 0, bpm } });
  }, []);

  // Auto-reduce: generate lower difficulties from source
  const handleAutoReduce = useCallback((sourceTrackKey: TrackKey, targetDifficulties: import("@/lib/chart/types").Difficulty[]) => {
    const currentChart = chartRef.current;
    const sourceTrack = currentChart.tracks[sourceTrackKey];
    if (!sourceTrack) return;
    const tm = buildTempoMap(currentChart);
    const resolution = currentChart.metadata.resolution || 192;
    const parsed = parseTrackKey(sourceTrackKey);
    if (!parsed) return;

    for (const diff of targetDifficulties) {
      const reduced = autoReduceDifficulty(sourceTrack, diff, tm, resolution);
      const targetKey = makeTrackKey(diff, parsed.instrument);
      dispatch({ type: "DO", action: { type: "SET_TRACK", trackKey: targetKey, track: reduced } });
    }
  }, []);

  const sections = useMemo(() => chart.sections ?? [], [chart.sections]);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z * 1.25, 800)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z / 1.25, 30)), []);
  const handlePhraseTypeChange = useCallback((t: string) => setPhraseType(t as Phrase["type"]), []);

  // Which stem label is "active" for the current instrument (for UI highlight)
  const activeStemLabel = useMemo<string | null>(() => {
    if (!selectedTrack || stems.size === 0) return null;
    const parsed = parseTrackKey(selectedTrack);
    if (!parsed) return null;
    const priorities = INSTRUMENT_STEMS[parsed.instrument];
    for (const label of priorities) {
      if (stems.has(label)) return label;
    }
    return stems.keys().next().value ?? null;
  }, [selectedTrack, stems]);

  return (
    <div
      className="flex flex-col h-full"
      // Drop a song folder (or chart + stems + song.ini) anywhere on the editor
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
      onDrop={async (e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        handleSongFiles(await collectDroppedFiles(e.dataTransfer));
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {hasChart ? (
              <button
                className="text-sm font-semibold truncate hover:underline text-left"
                onClick={() => setShowMetadata(true)}
                title="Edit song info"
              >
                {chart.metadata.name
                  ? `${chart.metadata.artist || "Unknown artist"} — ${chart.metadata.name}`
                  : "Untitled chart"}
              </button>
            ) : (
              <h1 className="text-sm font-semibold">Chart Editor</h1>
            )}
            {hasChart && (
              <span
                className={cn(
                  "flex items-center gap-1 text-[10px] shrink-0",
                  isDirty ? "text-amber-400" : "text-muted-foreground"
                )}
                title={isDirty ? "Changes since the last save (Ctrl+S)" : "No changes since the last save"}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", isDirty ? "bg-amber-400" : "bg-muted-foreground/50")} />
                {isDirty ? "Unsaved changes" : "Saved"}
              </span>
            )}
          </div>
          {chart.metadata.charter && (
            <p className="text-xs text-muted-foreground">
              Charter: {chart.metadata.charter}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowMetadata(true)}
            disabled={!hasChart}
          >
            <Info className="h-3 w-3" />
            Song info
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowCatalog(true)}
            disabled={!hasChart}
          >
            Catalog
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowAutoReduce(true)}
            disabled={!hasChart}
          >
            Auto-reduce
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setExportOpen(true)}
            disabled={!hasChart}
          >
            <Download className="h-3 w-3" />
            Export
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleSave}
            disabled={!hasChart}
            title={`Download ${chartFileName ?? "notes.chart"} (Ctrl+S)`}
          >
            <Save className="h-3 w-3" />
            Save
          </Button>
        </div>
      </div>

      {!hasChart ? (
        <div className="flex-1">
          <FileUpload
            onChartFile={(file) => loadChartFile(file)}
            onAudioFiles={handleAudioFiles}
            onSongFiles={handleSongFiles}
            onNewChart={handleNewChart}
            chartFileName={chartFileName}
            stems={stems}
          />
        </div>
      ) : (
        <>
          <Toolbar
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onStop={handleStop}
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            renderDistance={renderDistance}
            onRenderDistanceChange={setRenderDistance}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
            snapDivision={snapDivision}
            onSnapChange={setSnapDivision}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            currentTick={currentTick}
            bpm={bpm}
            timeSignatures={chart.syncTrack.timeSignatures}
            resolution={resolution}
            editMode={editMode}
            onEditModeChange={setEditMode}
            phraseType={phraseType}
            onPhraseTypeChange={handlePhraseTypeChange}
            vizMode={vizMode}
            onVizModeChange={handleVizModeChange}
            spectrogramLoading={spectrogramLoading}
            metronomeEnabled={metronomeEnabled}
            onMetronomeToggle={() => setMetronomeEnabled((v) => !v)}
            clapEnabled={clapEnabled}
            onClapToggle={() => setClapEnabled((v) => !v)}
            sections={sections}
            tempoMap={tempoMap}
            onSectionSeek={handleSeek}
            onShowShortcuts={() => setShowShortcuts(true)}
            loopA={loopA}
            loopB={loopB}
            onClearLoop={() => { setLoopA(null); setLoopB(null); }}
            onShowBpmDetect={() => setShowBpmDetect(true)}
            densityOverlay={densityOverlay}
            onDensityToggle={() => setDensityOverlay((v) => !v)}
            showGlobalView={showGlobalView}
            onToggleGlobalView={() => setShowGlobalView((v) => !v)}
            leftyFlip={leftyFlip}
            onLeftyFlipToggle={() => setLeftyFlip((v) => !v)}
            bookmarks={bookmarks}
            onBookmarkSeek={handleSeek}
          />

          <TrackSelector
            chart={chart}
            selectedTrack={selectedTrack}
            onSelectTrack={handleSelectTrack}
            ghostTrackKey={ghostTrackKey}
            onGhostTrackChange={setGhostTrackKey}
            onCreateTrack={handleCreateTrack}
          />

          {/* Global minimap */}
          {showGlobalView && (
            <GlobalView
              chart={chart}
              trackKey={selectedTrack}
              totalTicks={totalTicks}
              currentTick={currentTick}
              viewportTicks={viewportTicks}
              tempoMap={tempoMap}
              sections={sections}
              onSeek={handleSeek}
              currentTickRef={currentTickRef}
              isPlaying={isPlaying}
            />
          )}

          {/* Chart Ruler */}
          <ChartRuler
            bpmEvents={chart.syncTrack.bpmEvents}
            timeSignatures={chart.syncTrack.timeSignatures}
            sections={sections}
            currentTick={currentTick}
            zoom={zoom}
            resolution={chart.metadata.resolution || 192}
            renderDistance={renderDistance}
            onAddBpm={handleAddBpm}
            onDeleteBpm={handleDeleteBpm}
            onAddTimeSignature={handleAddTimeSignature}
            onDeleteTimeSignature={handleDeleteTimeSignature}
            onAddSection={handleAddRulerSection}
            onDeleteSection={handleDeleteSection}
            onRenameSection={handleRenameSection}
            onMoveBpm={handleMoveBpm}
            onMoveTimeSignature={handleMoveTimeSignature}
            onMoveSection={handleMoveSection}
            snapDivision={snapDivision}
            tempoMap={tempoMap}
            onSeek={handleSeek}
            currentTickRef={currentTickRef}
            isPlaying={isPlaying}
          />

          <div className="flex flex-1 overflow-hidden">
            {/* Lane */}
            <div ref={laneContainerRef} className="flex-1 overflow-hidden relative bg-[#0f0f14]">
              {selectedTrack ? (
                isVocalsTrack ? (
                  <VocalsLane
                    chart={chart}
                    trackKey={selectedTrack}
                    currentTick={currentTick}
                    isPlaying={isPlaying}
                    currentTickRef={currentTickRef}
                    zoom={zoom}
                    renderDistance={renderDistance}
                    snapDivision={snapDivision}
                    selectedNoteIds={selectedNoteIds}
                    onSelectNotes={handleSelectNotes}
                    onAddNote={handleAddNote}
                    onDeleteNotes={handleLaneDeleteNotes}
                    onMoveNotes={handleMoveNotes}
                    onResizeNote={handleResizeNote}
                    onSeekToTick={handleSeek}
                    sections={sections}
                    lyrics={chart.lyrics}
                    waveform={activeWaveform}
                    vizMode={vizMode}
                    spectrogram={activeSpectrogram}
                    ghostNotes={ghostNotes}
                  />
                ) : (
                  <TrackLane
                    chart={chart}
                    trackKey={selectedTrack}
                    currentTick={currentTick}
                    isPlaying={isPlaying}
                    currentTickRef={currentTickRef}
                    zoom={zoom}
                    renderDistance={renderDistance}
                    snapDivision={snapDivision}
                    selectedNoteIds={selectedNoteIds}
                    onSelectNotes={handleSelectNotes}
                    onAddNote={handleAddNote}
                    onDeleteNotes={handleLaneDeleteNotes}
                    onMoveNotes={handleMoveNotes}
                    onDragNotes={handleDragNotes}
                    onResizeNote={handleResizeNote}
                    onSeekToTick={handleSeek}
                    sections={sections}
                    onAddPhrase={handleAddPhrase}
                    onDeletePhrase={handleDeletePhrase}
                    editMode={editMode}
                    phraseType={phraseType}
                    waveform={activeWaveform}
                    vizMode={vizMode}
                    spectrogram={activeSpectrogram}
                    ghostNotes={ghostNotes}
                    densityHeatmap={densityHeatmap}
                    leftyFlip={leftyFlip}
                    onRightClickDrag={handleRightClickDrag}
                    isDrumTrack={parseTrackKey(selectedTrack)?.instrument === "Drums"}
                    drumMode={drumMode}
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No track selected
                </div>
              )}
            </div>

            {/* Properties + Lyrics + Validation + Stats */}
            <div className="flex flex-col overflow-y-auto border-l w-[260px] shrink-0">
              <PropertiesPanel
                chart={chart}
                trackKey={selectedTrack}
                selectedNoteIds={selectedNoteIds}
                isVocals={isVocalsTrack}
                onUpdateNote={handleUpdateNote}
                onDeleteNotes={handlePropDeleteNotes}
                onToggleFlag={handleToggleFlag}
              />
              {isVocalsTrack && selectedTrack && (
                <LyricsPanel
                  chart={chart}
                  trackKey={selectedTrack}
                  currentTick={currentTick}
                  isPlaying={isPlaying}
                  onUpdateLyrics={handleUpdateLyrics}
                />
              )}

              {/* Validation panel toggle */}
              <div className="border-t">
                <button
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium hover:bg-muted/40 transition-colors"
                  onClick={() => setShowValidation((v) => !v)}
                >
                  Validation
                  <span className="text-muted-foreground">{showValidation ? "−" : "+"}</span>
                </button>
                {showValidation && (
                  <ValidationPanel
                    chart={chart}
                    onSeek={handleSeek}
                    onSelectNotes={(trackKey, ids) => {
                      setSelectedTrack(trackKey);
                      setSelectedNoteIds(new Set(ids));
                    }}
                    onSelectTrack={(trackKey) => setSelectedTrack(trackKey)}
                  />
                )}
              </div>

              {/* Statistics panel toggle */}
              <div className="border-t">
                <button
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium hover:bg-muted/40 transition-colors"
                  onClick={() => setShowStatistics((v) => !v)}
                >
                  Statistics
                  <span className="text-muted-foreground">{showStatistics ? "−" : "+"}</span>
                </button>
                {showStatistics && (
                  <StatisticsPanel
                    chart={chart}
                    trackKey={selectedTrack}
                    tempoMap={tempoMap}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Timeline scrubber */}
          <div className="border-t bg-background px-3">
            <TimelineBar
              currentTick={currentTick}
              totalTicks={totalTicks}
              sections={sections}
              tempoMap={tempoMap}
              onSeek={handleSeek}
            />
          </div>

          {/* Bottom bar: file pickers + stem mixer */}
          <div className="border-t px-4 py-2 flex gap-3 items-center text-xs text-muted-foreground flex-wrap">
            {/* Chart file picker */}
            <label className="cursor-pointer hover:text-foreground transition-colors shrink-0">
              <input
                type="file"
                accept=".chart,.mid,.midi"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadChartFile(f);
                  e.target.value = "";
                }}
              />
              {chartFileName ? `Chart: ${chartFileName}` : "Load chart…"}
            </label>

            <span className="text-border">|</span>

            {/* Add stems button */}
            <label className="cursor-pointer hover:text-foreground transition-colors flex items-center gap-1 shrink-0">
              <input
                type="file"
                accept=".ogg,.mp3,.wav,.flac,.opus"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) handleAudioFiles(files);
                  e.target.value = "";
                }}
              />
              <span className="text-base leading-none">+</span>
              {stems.size === 0 ? "Load audio stems…" : "Add stem…"}
            </label>

            {/* Stem mixer chips */}
            {stems.size > 0 && (
              <>
                <span className="text-border">|</span>
                <div className="flex gap-1.5 flex-wrap">
                  {[...stems.keys()].map((label) => {
                    const muted = mutedStems.has(label);
                    const isActive = label === activeStemLabel;
                    return (
                      <button
                        key={label}
                        onClick={() => toggleMute(label)}
                        title={muted ? `Unmute ${label}` : `Mute ${label}`}
                        className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded border text-xs transition-all",
                          muted
                            ? "opacity-35 border-border text-muted-foreground"
                            : isActive
                              ? "border-sky-400/70 text-sky-300 bg-sky-400/10"
                              : "border-white/20 text-foreground hover:border-white/40"
                        )}
                      >
                        {muted ? (
                          <VolumeX className="h-3 w-3" />
                        ) : (
                          <Volume2 className="h-3 w-3" />
                        )}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        chart={chart}
        fileName={chartFileName}
        onExported={(format) => { if (format !== "songini") setSavedChart(chart); }}
        onShowValidation={() => { setExportOpen(false); setShowValidation(true); }}
      />
      <MetadataDialog
        open={showMetadata}
        onOpenChange={setShowMetadata}
        metadata={chart.metadata}
        onSave={handleSaveMetadata}
      />
      <ShortcutsPanel
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />
      <NamePromptDialog
        open={namePrompt !== null}
        onOpenChange={(open) => { if (!open) setNamePrompt(null); }}
        title={namePrompt?.kind === "pattern" ? "Save pattern" : "Add section"}
        description={
          namePrompt?.kind === "section"
            ? `At ${formatPosition(namePrompt.tick, tempoMap, chart.syncTrack.timeSignatures, resolution)}`
            : `${selectedNoteIds.size} selected notes`
        }
        placeholder={namePrompt?.kind === "pattern" ? "Pattern name" : "Verse 1"}
        submitLabel={namePrompt?.kind === "pattern" ? "Save" : "Add"}
        onSubmit={(name) => {
          if (namePrompt?.kind === "pattern") {
            handleSaveToCatalog(name);
          } else if (namePrompt?.kind === "section") {
            dispatch({
              type: "DO",
              action: { type: "ADD_SECTION", section: { id: uuidv4(), tick: namePrompt.tick, name, type: "section" } },
            });
          }
        }}
      />
      <AutoReduceDialog
        open={showAutoReduce}
        onOpenChange={setShowAutoReduce}
        chart={chart}
        selectedTrack={selectedTrack}
        onGenerate={handleAutoReduce}
      />
      <BpmDetectDialog
        open={showBpmDetect}
        onOpenChange={setShowBpmDetect}
        audioBuffer={firstAudioBuffer}
        onApply={handleBpmApply}
      />

      {/* Autosave recovery dialog */}
      {showRecovery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div role="alertdialog" aria-modal="true" aria-labelledby="chart-recovery-title" className="bg-background border rounded-lg p-6 max-w-md shadow-xl">
            <h3 id="chart-recovery-title" className="text-sm font-semibold mb-2">Recover Autosaved Chart?</h3>
            <p className="text-xs text-muted-foreground mb-4">
              An autosaved chart was found from a previous session. Would you like to recover it?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleDismissRecovery}>
                Discard
              </Button>
              <Button size="sm" onClick={handleRecoverAutosave}>
                Recover
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pattern catalog dialog */}
      {showCatalog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCatalog(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="chart-catalog-title" className="bg-background border rounded-lg p-6 max-w-md shadow-xl w-full" onClick={(e) => e.stopPropagation()}>
            <h3 id="chart-catalog-title" className="text-sm font-semibold mb-3">Pattern Catalog</h3>
            {catalogPatterns.length === 0 ? (
              <p className="text-xs text-muted-foreground mb-4">No patterns saved yet. Select notes and use &quot;Save to Catalog&quot; to add patterns.</p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto mb-4">
                {catalogPatterns.map((pattern, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                    <span>{pattern.name} ({pattern.notes.length} notes)</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => { handlePasteFromCatalog(pattern.notes); setShowCatalog(false); }}>
                        Paste
                      </Button>
                      <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px] text-destructive" onClick={() => handleDeleteCatalogPattern(idx)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-between">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={selectedNoteIds.size === 0}
                onClick={() => setNamePrompt({ kind: "pattern" })}
              >
                Save Selection
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCatalog(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
