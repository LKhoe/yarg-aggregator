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
import type { ChartData, Instrument, Note, TrackKey } from "@/lib/chart/types";
import {
  makeTrackKey,
  parseTrackKey,
  DIFFICULTY_ORDER,
  INSTRUMENT_ORDER,
} from "@/lib/chart/types";
import { parseChart } from "@/lib/chart/parser-chart";
import { parseMidi } from "@/lib/chart/parser-midi";
import { computeWaveform, type WaveformData } from "@/lib/chart/waveform";
import {
  buildTempoMap,
  getBpmAtTick,
  snapDivisionToTicks,
  snapToGrid,
} from "@/lib/chart/tempo-utils";
import { FileUpload } from "./FileUpload";
import { Toolbar } from "./Toolbar";
import { TrackSelector } from "./TrackSelector";
import { TrackLane } from "./TrackLane";
import { PropertiesPanel } from "./PropertiesPanel";
import { ExportDialog } from "./ExportDialog";
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
  | { type: "SET_CHART"; chart: ChartData };

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
              n.id === action.id ? { ...n, length: action.newLength } : n
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
    // Fallback: any available stem
    return stems.values().next().value?.waveform;
  }, [selectedTrack, stems]);

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

    // Recompute waveforms against new chart tempo map
    if (stemsRef.current.size > 0) {
      const newStems = new Map<string, AudioStem>();
      for (const [label, stem] of stemsRef.current) {
        newStems.set(label, {
          ...stem,
          waveform: computeWaveform(stem.buffer, parsed),
        });
      }
      setTimeout(() => setStems(newStems), 0);
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
    }
  }, []);

  // Mute toggle — also updates gain node immediately if playing
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

  // Live speed change: update source playbackRate + reset time refs
  useEffect(() => {
    if (!isPlaying) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Update playback rate on all source nodes
    for (const src of sourceNodesRef.current.values()) {
      src.playbackRate.value = playbackSpeed;
    }

    // Reset reference points so tick tracking stays in sync
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

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedNoteIds.size > 0 &&
        selectedTrack
      ) {
        e.preventDefault();
        dispatch({
          type: "DO",
          action: {
            type: "DELETE_NOTES",
            track: selectedTrack,
            ids: [...selectedNoteIds],
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
      }

      if (
        (e.key === "ArrowUp" || e.key === "ArrowDown") &&
        selectedNoteIds.size > 0 &&
        selectedTrack
      ) {
        e.preventDefault();
        const resolution = chart.metadata.resolution || 192;
        const gridTicks = snapDivisionToTicks(resolution, snapDivision);
        const deltaTick = e.key === "ArrowUp" ? gridTicks : -gridTicks;
        dispatch({
          type: "DO",
          action: {
            type: "MOVE_NOTES",
            track: selectedTrack,
            ids: [...selectedNoteIds],
            deltaTick,
            deltaFret: 0,
          },
        });
        return;
      }

      if (
        (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        selectedNoteIds.size > 0 &&
        selectedTrack
      ) {
        e.preventDefault();
        const deltaFret = e.key === "ArrowRight" ? 1 : -1;
        dispatch({
          type: "DO",
          action: {
            type: "MOVE_NOTES",
            track: selectedTrack,
            ids: [...selectedNoteIds],
            deltaTick: 0,
            deltaFret,
          },
        });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    selectedNoteIds,
    selectedTrack,
    handlePlayPause,
    chart.metadata.resolution,
    snapDivision,
  ]);

  const hasChart = Object.keys(chart.tracks).length > 0;
  const tempoMap = buildTempoMap(chart);
  const bpm = getBpmAtTick(currentTick, tempoMap);

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
          />

          <TrackSelector
            chart={chart}
            selectedTrack={selectedTrack}
            onSelectTrack={(key) => {
              setSelectedTrack(key);
              setSelectedNoteIds(new Set());
            }}
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
                  waveform={activeWaveform}
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
                  // reset so same files can be re-added
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
