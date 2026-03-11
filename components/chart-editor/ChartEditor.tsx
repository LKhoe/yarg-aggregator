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
import type { ChartData, Instrument, Note, Phrase, Section, TrackKey } from "@/lib/chart/types";
import {
  makeTrackKey,
  parseTrackKey,
  DIFFICULTY_ORDER,
  INSTRUMENT_ORDER,
} from "@/lib/chart/types";
import { parseChart } from "@/lib/chart/parser-chart";
import { parseMidi } from "@/lib/chart/parser-midi";
import { computeWaveform, type WaveformData } from "@/lib/chart/waveform";
import { computeSpectrogram, type SpectrogramData } from "@/lib/chart/spectrogram";
import {
  buildTempoMap,
  getBpmAtTick,
  getChartDurationTicks,
  snapDivisionToTicks,
  snapToGrid,
  tickToSeconds,
} from "@/lib/chart/tempo-utils";
import { FileUpload } from "./FileUpload";
import { Toolbar } from "./Toolbar";
import { TrackSelector } from "./TrackSelector";
import { TrackLane } from "./TrackLane";
import { PropertiesPanel } from "./PropertiesPanel";
import { ExportDialog } from "./ExportDialog";
import { ChartRuler } from "./ChartRuler";
import { TimelineBar } from "./TimelineBar";
import { Button } from "@/components/ui/button";
import { Download, Volume2, VolumeX } from "lucide-react";
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
  | { type: "SET_CHART"; chart: ChartData }
  // BPM / Tempo map
  | { type: "ADD_BPM"; tick: number; bpm: number }
  | { type: "DELETE_BPM"; tick: number }
  | { type: "ADD_TIME_SIGNATURE"; tick: number; numerator: number; denominator: number }
  | { type: "DELETE_TIME_SIGNATURE"; tick: number }
  // Phrases
  | { type: "ADD_PHRASE"; track: TrackKey; phrase: Phrase }
  | { type: "DELETE_PHRASE"; track: TrackKey; id: string }
  | { type: "RESIZE_PHRASE"; track: TrackKey; id: string; newLength: number }
  // Note flags
  | { type: "TOGGLE_NOTE_FLAG"; track: TrackKey; ids: string[]; flag: "forceHopo" | "forceStrum" | "tap" }
  // Sections
  | { type: "ADD_SECTION"; section: Section }
  | { type: "RENAME_SECTION"; id: string; name: string }
  | { type: "DELETE_SECTION"; id: string }
  // Copy/paste
  | { type: "PASTE_NOTES"; track: TrackKey; notes: Note[] };

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
          fret: Math.max(0, Math.min(4, n.fret + action.deltaFret)),
        };
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
            notes: track.notes
              .map((n) => (n.id === action.note.id ? action.note : n))
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

    case "PASTE_NOTES": {
      const track = chart.tracks[action.track];
      if (!track) return chart;
      const notes = [...track.notes, ...action.notes].sort((a, b) => a.tick - b.tick);
      return {
        ...chart,
        tracks: { ...chart.tracks, [action.track]: { ...track, notes } },
      };
    }

    default:
      return chart;
  }
}

// ─────────────────────── History reducer ─────────────────────────

interface HistoryState {
  past: ChartData[];
  present: ChartData;
  future: ChartData[];
}

type HistoryAction =
  | { type: "DO"; action: EditAction }
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
  tracks: {},
};

function historyReducer(
  state: HistoryState,
  action: HistoryAction
): HistoryState {
  switch (action.type) {
    case "DO": {
      const next = applyAction(state.present, action.action);
      return {
        past: [...state.past.slice(-49), state.present],
        present: next,
        future: [],
      };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future.slice(0, 49)],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past.slice(-49), state.present],
        present: next,
        future: state.future.slice(1),
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

  // Edit mode state
  const [editMode, setEditMode] = useState<"note" | "phrase">("note");
  const [phraseType, setPhraseType] = useState<Phrase["type"]>("starPower");

  // Clipboard for copy/paste
  const clipboardRef = useRef<Note[]>([]);

  // Visualization mode (waveform vs mel spectrogram)
  const [vizMode, setVizMode] = useState<"waveform" | "spectrogram">("waveform");
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

  // Audio engine refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const playbackStartTimeRef = useRef(0);
  const playbackStartTickRef = useRef(0);
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
  const handleVizModeChange = useCallback((mode: "waveform" | "spectrogram") => {
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

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const tempoMap = buildTempoMap(chart);
    const resolution = chart.metadata.resolution || 192;

    function frame() {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const elapsed = ctx.currentTime - playbackStartTimeRef.current;
      const speed = playbackSpeedRef.current;
      const bpm = getBpmAtTick(playbackStartTickRef.current, tempoMap);
      const beatsPerSecond = bpm / 60;
      const newTick =
        playbackStartTickRef.current +
        elapsed * speed * beatsPerSecond * resolution;
      setCurrentTick(newTick);
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, chart]);

  // Chart file upload
  const handleChartFile = useCallback(async (file: File) => {
    setChartFileName(file.name);
    const text = await file.text();
    const ext = file.name.toLowerCase();
    let parsed: ChartData;
    if (ext.endsWith(".chart")) {
      parsed = parseChart(text);
    } else if (ext.endsWith(".mid") || ext.endsWith(".midi")) {
      const buf = await file.arrayBuffer();
      parsed = parseMidi(buf);
    } else {
      return;
    }
    dispatch({ type: "DO", action: { type: "SET_CHART", chart: parsed } });
    setCurrentTick(0);
    setIsPlaying(false);
    setSelectedNoteIds(new Set());

    if (stemsRef.current.size > 0) {
      const newStems = new Map<string, AudioStem>();
      for (const [label, stem] of stemsRef.current) {
        newStems.set(label, {
          ...stem,
          waveform: computeWaveform(stem.buffer, parsed),
        });
      }
      setTimeout(() => {
        setStems(newStems);
        setSpectrograms(new Map()); // clear spectrograms — tempo map changed
      }, 0);
    }
  }, []);

  // Audio files upload (multiple stems)
  const handleAudioFiles = useCallback(async (files: File[]) => {
    const ctx = getAudioCtx();
    const currentChart = chartRef.current;
    for (const file of files) {
      const label = inferStemLabel(file.name);
      const buf = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(buf);
      const waveform = computeWaveform(decoded, currentChart);
      setStems((prev) => {
        const next = new Map(prev);
        next.set(label, { label, buffer: decoded, waveform });
        return next;
      });
      // Invalidate cached spectrogram for this stem so it gets recomputed
      setSpectrograms((prev) => {
        if (!prev.has(label)) return prev;
        const next = new Map(prev);
        next.delete(label);
        return next;
      });
    }
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

  // Play/pause
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      for (const src of sourceNodesRef.current.values()) {
        try { src.stop(); } catch { /* already stopped */ }
      }
      sourceNodesRef.current.clear();
      gainNodesRef.current.clear();
      setIsPlaying(false);
    } else {
      const ctx = getAudioCtx();
      if (ctx.state === "suspended") ctx.resume();

      const resolution = chartRef.current.metadata.resolution || 192;
      const bpm = chartRef.current.syncTrack.bpmEvents[0]?.bpm ?? 120;
      const startOffset =
        (currentTick / resolution / bpm) * 60;

      const speed = playbackSpeedRef.current;
      for (const [label, stem] of stemsRef.current) {
        const source = ctx.createBufferSource();
        source.buffer = stem.buffer;
        source.playbackRate.value = speed;
        const gain = ctx.createGain();
        gain.gain.value = mutedStemsRef.current.has(label) ? 0 : 1;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(
          0,
          Math.max(0, startOffset + chartRef.current.metadata.offset)
        );
        sourceNodesRef.current.set(label, source);
        gainNodesRef.current.set(label, gain);
      }

      playbackStartTimeRef.current = ctx.currentTime;
      playbackStartTickRef.current = currentTick;
      setIsPlaying(true);
    }
  }, [isPlaying, currentTick]);

  const handleStop = useCallback(() => {
    for (const src of sourceNodesRef.current.values()) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    sourceNodesRef.current.clear();
    gainNodesRef.current.clear();
    setIsPlaying(false);
    setCurrentTick(0);
  }, []);

  // Seek to a tick — restarts audio at the new position if currently playing
  const handleSeek = useCallback((tick: number) => {
    const playing = isPlaying;
    // Stop existing sources
    for (const src of sourceNodesRef.current.values()) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    sourceNodesRef.current.clear();
    gainNodesRef.current.clear();

    setCurrentTick(tick);

    if (!playing) return;

    // Restart audio from new position
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const currentChart = chartRef.current;
    const resolution   = currentChart.metadata.resolution || 192;
    const bpm          = currentChart.syncTrack.bpmEvents[0]?.bpm ?? 120;
    const startOffset  = (tick / resolution / bpm) * 60;
    const speed        = playbackSpeedRef.current;

    for (const [label, stem] of stemsRef.current) {
      const source = ctx.createBufferSource();
      source.buffer = stem.buffer;
      source.playbackRate.value = speed;
      const gain = ctx.createGain();
      gain.gain.value = mutedStemsRef.current.has(label) ? 0 : 1;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0, Math.max(0, startOffset + currentChart.metadata.offset));
      sourceNodesRef.current.set(label, source);
      gainNodesRef.current.set(label, gain);
    }

    playbackStartTimeRef.current = ctx.currentTime;
    playbackStartTickRef.current = tick;
  }, [isPlaying]);

  // Live speed change
  useEffect(() => {
    if (!isPlaying) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    for (const src of sourceNodesRef.current.values()) {
      src.playbackRate.value = playbackSpeed;
    }
    playbackStartTickRef.current = currentTick;
    playbackStartTimeRef.current = ctx.currentTime;
  }, [playbackSpeed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.code === "Space") {
        e.preventDefault();
        handlePlayPause();
        return;
      }

      const track = selectedTrackRef.current;
      const noteIds = selectedNoteIdsRef.current;

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
        if (e.key === "z") {
          e.preventDefault();
          dispatch({ type: "UNDO" });
          return;
        }
        if (e.key === "y") {
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
        if (e.key === "v") {
          // Paste at current tick
          if (clipboardRef.current.length > 0 && track) {
            e.preventDefault();
            const clipboard = clipboardRef.current;
            const minTick = Math.min(...clipboard.map((n) => n.tick));
            const pastedTick = currentTickRef.current;
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

      // M key: add section at current playhead
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        const name = window.prompt("Section name:");
        if (name && name.trim()) {
          dispatch({
            type: "DO",
            action: {
              type: "ADD_SECTION",
              section: {
                id: uuidv4(),
                tick: Math.round(currentTickRef.current),
                name: name.trim(),
                type: "section",
              },
            },
          });
        }
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
    snapDivision,
  ]);

  const hasChart  = Object.keys(chart.tracks).length > 0;
  const tempoMap  = buildTempoMap(chart);
  const bpm       = getBpmAtTick(currentTick, tempoMap);
  const totalTicks = getChartDurationTicks(chart);

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
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div>
          <h1 className="text-sm font-semibold">
            {chart.metadata.name
              ? `${chart.metadata.artist} — ${chart.metadata.name}`
              : "Chart Editor"}
          </h1>
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
            onClick={() => setExportOpen(true)}
            disabled={!hasChart}
          >
            <Download className="h-3 w-3" />
            Export
          </Button>
        </div>
      </div>

      {!hasChart ? (
        <div className="flex-1">
          <FileUpload
            onChartFile={handleChartFile}
            onAudioFiles={handleAudioFiles}
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
            onZoomIn={() => setZoom((z) => Math.min(z * 1.25, 800))}
            onZoomOut={() => setZoom((z) => Math.max(z / 1.25, 30))}
            renderDistance={renderDistance}
            onRenderDistanceChange={setRenderDistance}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
            snapDivision={snapDivision}
            onSnapChange={setSnapDivision}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onUndo={() => dispatch({ type: "UNDO" })}
            onRedo={() => dispatch({ type: "REDO" })}
            currentTick={currentTick}
            bpm={bpm}
            editMode={editMode}
            onEditModeChange={setEditMode}
            phraseType={phraseType}
            onPhraseTypeChange={(t) => setPhraseType(t as Phrase["type"])}
            vizMode={vizMode}
            onVizModeChange={handleVizModeChange}
            spectrogramLoading={spectrogramLoading}
          />

          <TrackSelector
            chart={chart}
            selectedTrack={selectedTrack}
            onSelectTrack={(key) => {
              setSelectedTrack(key);
              setSelectedNoteIds(new Set());
            }}
          />

          {/* Chart Ruler */}
          <ChartRuler
            bpmEvents={chart.syncTrack.bpmEvents}
            timeSignatures={chart.syncTrack.timeSignatures}
            sections={chart.sections ?? []}
            currentTick={currentTick}
            zoom={zoom}
            resolution={chart.metadata.resolution || 192}
            renderDistance={renderDistance}
            onAddBpm={(tick, bpm) =>
              dispatch({ type: "DO", action: { type: "ADD_BPM", tick, bpm } })
            }
            onDeleteBpm={(tick) =>
              dispatch({ type: "DO", action: { type: "DELETE_BPM", tick } })
            }
            onAddTimeSignature={(tick, numerator, denominator) =>
              dispatch({
                type: "DO",
                action: { type: "ADD_TIME_SIGNATURE", tick, numerator, denominator },
              })
            }
            onDeleteTimeSignature={(tick) =>
              dispatch({
                type: "DO",
                action: { type: "DELETE_TIME_SIGNATURE", tick },
              })
            }
            onAddSection={(id, tick, name) =>
              dispatch({
                type: "DO",
                action: {
                  type: "ADD_SECTION",
                  section: { id, tick, name, type: "section" },
                },
              })
            }
            onDeleteSection={(id) =>
              dispatch({ type: "DO", action: { type: "DELETE_SECTION", id } })
            }
            onSeek={(tick) => setCurrentTick(tick)}
          />

          <div className="flex flex-1 overflow-hidden">
            {/* Lane */}
            <div className="flex-1 overflow-hidden relative bg-[#0f0f14]">
              {selectedTrack ? (
                <TrackLane
                  chart={chart}
                  trackKey={selectedTrack}
                  currentTick={currentTick}
                  isPlaying={isPlaying}
                  zoom={zoom}
                  renderDistance={renderDistance}
                  snapDivision={snapDivision}
                  selectedNoteIds={selectedNoteIds}
                  onSelectNotes={(ids) => setSelectedNoteIds(new Set(ids))}
                  onAddNote={(tick, fret) => {
                    if (!selectedTrack) return;
                    dispatch({
                      type: "DO",
                      action: {
                        type: "ADD_NOTE",
                        track: selectedTrack,
                        note: { id: uuidv4(), tick, fret, length: 0 },
                      },
                    });
                  }}
                  onDeleteNotes={(ids) => {
                    if (!selectedTrack) return;
                    dispatch({
                      type: "DO",
                      action: {
                        type: "DELETE_NOTES",
                        track: selectedTrack,
                        ids,
                      },
                    });
                    setSelectedNoteIds((prev) => {
                      const next = new Set(prev);
                      ids.forEach((id) => next.delete(id));
                      return next;
                    });
                  }}
                  onMoveNotes={(ids, deltaTick, deltaFret) => {
                    if (!selectedTrack) return;
                    dispatch({
                      type: "DO",
                      action: {
                        type: "MOVE_NOTES",
                        track: selectedTrack,
                        ids,
                        deltaTick,
                        deltaFret,
                      },
                    });
                  }}
                  onResizeNote={(id, newLength) => {
                    if (!selectedTrack) return;
                    dispatch({
                      type: "DO",
                      action: {
                        type: "RESIZE_NOTE",
                        track: selectedTrack,
                        id,
                        newLength,
                      },
                    });
                  }}
                  onAddPhrase={(tick, length) => {
                    if (!selectedTrack) return;
                    dispatch({
                      type: "DO",
                      action: {
                        type: "ADD_PHRASE",
                        track: selectedTrack,
                        phrase: {
                          id: uuidv4(),
                          tick,
                          length,
                          type: phraseType,
                        },
                      },
                    });
                  }}
                  onDeletePhrase={(id) => {
                    if (!selectedTrack) return;
                    dispatch({
                      type: "DO",
                      action: {
                        type: "DELETE_PHRASE",
                        track: selectedTrack,
                        id,
                      },
                    });
                  }}
                  onSeekToTick={(tick) => setCurrentTick(tick)}
                  editMode={editMode}
                  phraseType={phraseType}
                  sections={chart.sections ?? []}
                  waveform={activeWaveform}
                  vizMode={vizMode}
                  spectrogram={activeSpectrogram}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No track selected
                </div>
              )}
            </div>

            {/* Properties */}
            <PropertiesPanel
              chart={chart}
              trackKey={selectedTrack}
              selectedNoteIds={selectedNoteIds}
              onUpdateNote={(id, tick, fret, length) => {
                if (!selectedTrack) return;
                dispatch({
                  type: "DO",
                  action: {
                    type: "UPDATE_NOTE",
                    track: selectedTrack,
                    note: { id, tick, fret, length },
                  },
                });
              }}
              onDeleteNotes={(ids) => {
                if (!selectedTrack) return;
                dispatch({
                  type: "DO",
                  action: {
                    type: "DELETE_NOTES",
                    track: selectedTrack,
                    ids,
                  },
                });
                setSelectedNoteIds(new Set());
              }}
              onToggleFlag={(id, flag) => {
                if (!selectedTrack) return;
                dispatch({
                  type: "DO",
                  action: {
                    type: "TOGGLE_NOTE_FLAG",
                    track: selectedTrack,
                    ids: [id],
                    flag,
                  },
                });
              }}
            />
          </div>

          {/* Timeline scrubber */}
          <div className="border-t bg-background px-3">
            <TimelineBar
              currentTick={currentTick}
              totalTicks={totalTicks}
              sections={chart.sections ?? []}
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
                  if (f) handleChartFile(f);
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
      />
    </div>
  );
}
