"use client";

import React, { memo, useEffect, useRef, useCallback, useState } from "react";
import type { ChartData, LyricEvent, Note, Phrase, Section, TrackKey } from "@/lib/chart/types";
import {
  buildTempoMap,
  snapDivisionToTicks,
  snapToGrid,
} from "@/lib/chart/tempo-utils";
import { type WaveformData, getWaveformPeak } from "@/lib/chart/waveform";
import { type SpectrogramData, getSpectrogramRgb } from "@/lib/chart/spectrogram";

export interface TrackLaneProps {
  chart: ChartData;
  trackKey: TrackKey;
  currentTick: number;
  isPlaying: boolean;
  currentTickRef?: React.MutableRefObject<number>;
  zoom: number;
  renderDistance: number;
  snapDivision: number;
  selectedNoteIds: Set<string>;
  onSelectNotes: (ids: string[]) => void;
  onAddNote: (tick: number, fret: number) => void;
  onDeleteNotes: (ids: string[]) => void;
  onMoveNotes: (ids: string[], deltaTick: number, deltaFret: number) => void;
  waveform?: WaveformData;
  vizMode?: "waveform" | "spectrogram" | "none";
  spectrogram?: SpectrogramData;
  // New phase 1 props
  editMode?: "note" | "phrase" | "eraser";
  phraseType?: Phrase["type"];
  sections?: Section[];
  onAddPhrase?: (tick: number, length: number) => void;
  onDeletePhrase?: (id: string) => void;
  onResizePhrase?: (id: string, newLength: number) => void;
  onResizeNote?: (id: string, newLength: number) => void;
  onSeekToTick?: (tick: number) => void;
  lyrics?: LyricEvent[];
  ghostNotes?: Note[];
  densityHeatmap?: Float32Array;
  leftyFlip?: boolean;
  onRightClickDrag?: (tick: number, fret: number, endTick: number) => void;
  isDrumTrack?: boolean;
  drumMode?: import("@/lib/chart/types").DrumMode;
}

// ── Perspective constants ──────────────────────────────────────────
const HORIZON_Y_RATIO = 0.05;
const STRIKE_Y_RATIO = 0.78;
const PERSP_K = 4.0;
const LANE_W_FRAC = 0.70;
const NUM_FRETS = 5;
const DEFAULT_ZOOM = 120;

function visibleTicksFromZoom(
  zoom: number,
  resolution: number,
  renderDistance: number
): number {
  return ((resolution * 960) / zoom) * renderDistance;
}

function depthAt(tickOffset: number, visibleTicks: number): number {
  const t = Math.max(0, tickOffset) / visibleTicks;
  return 1 / (1 + PERSP_K * t);
}

interface LaneGeom {
  y: number;
  left: number;
  right: number;
  width: number;
  colW: number;
  cx: number;
}

function laneAt(depth: number, W: number, H: number, numCols: number): LaneGeom {
  const hy = H * HORIZON_Y_RATIO;
  const sy = H * STRIKE_Y_RATIO;
  const vpX = W / 2;
  const halfW = W * LANE_W_FRAC * 0.5 * depth;
  const y = hy + (sy - hy) * depth;
  const width = halfW * 2;
  return { y, left: vpX - halfW, right: vpX + halfW, width, colW: width / numCols, cx: vpX };
}

function yToTickOffset(screenY: number, _W: number, H: number, visibleTicks: number): number {
  const hy = H * HORIZON_Y_RATIO;
  const strikeY = H * STRIKE_Y_RATIO;
  const depth = (screenY - hy) / (strikeY - hy);
  if (depth <= 0.001) return visibleTicks;
  if (depth >= 1) return 0;
  return ((1 / depth - 1) / PERSP_K) * visibleTicks;
}

function xyToFret(cx: number, cy: number, W: number, H: number, visibleTicks: number, numCols: number): number {
  const dt = yToTickOffset(cy, W, H, visibleTicks);
  const d = depthAt(dt, visibleTicks);
  const lane = laneAt(d, W, H, numCols);
  const frac = (cx - lane.left) / lane.width;
  return Math.max(0, Math.min(numCols - 1, Math.floor(frac * numCols)));
}

// ── Image loading ─────────────────────────────────────────────────

const IMAGE_PATHS: Record<string, string> = {
  green:  "/frets/green.png",
  red:    "/frets/red.png",
  yellow: "/frets/yellow.png",
  blue:   "/frets/blue.png",
  orange: "/frets/orange.png",
};

const IMAGE_CACHE = new Map<string, HTMLImageElement>();

function preloadFretImages(onDone: () => void) {
  const entries = Object.entries(IMAGE_PATHS);
  let pending = entries.length;
  if (pending === 0) { onDone(); return; }

  for (const [name, path] of entries) {
    if (IMAGE_CACHE.has(name) && IMAGE_CACHE.get(name)!.complete) {
      if (--pending === 0) onDone();
      continue;
    }
    const img = new window.Image();
    img.onload = () => {
      IMAGE_CACHE.set(name, img);
      if (--pending === 0) onDone();
    };
    img.onerror = () => { if (--pending === 0) onDone(); };
    img.src = path;
  }
}

// fret index → image name for 5-fret instruments
const GUITAR_FRET_IMG = ["green", "red", "yellow", "blue", "orange"];
// drum fret → image name (fret 0 = kick has no gem, fret 1-4 = pads)
const DRUM_FRET_IMG: (string | null)[] = [null, "red", "yellow", "blue", "green"];

// ── Perspective-correct image rendering ───────────────────────────
function drawPerspectiveImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  fxBL: number, yB: number, fxBR: number,
  fxFL: number, yF: number, fxFR: number,
  alpha: number = 1,
) {
  if (!img.complete || img.naturalWidth === 0) return;
  const dy = yF - yB;
  if (dy < 0.5) return;

  const prevAlpha = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = alpha;

  const rows = Math.min(Math.ceil(dy / 2), 60);
  const ih = img.height;
  const iw = img.width;
  const stripH = dy / rows + 0.5;

  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const y = yB + t * dy;
    const xL = fxBL + (fxFL - fxBL) * t;
    const xR = fxBR + (fxFR - fxBR) * t;
    const w = xR - xL;
    if (w < 0.5) continue;
    const srcY = t * ih;
    ctx.drawImage(img, 0, Math.floor(srcY), iw, Math.ceil(ih / rows) + 1, xL, y, w, stripH);
  }

  if (alpha !== 1) ctx.globalAlpha = prevAlpha;
}

// ── Fallback colors ───────────────────────────────────────────────
const NOTE_COLORS  = ["#00e06e", "#e8223a", "#f5cc00", "#2299ee", "#ee7700"];
const NOTE_COLORS_DARK = ["#005528", "#5a0c15", "#5a4a00", "#0c3a5a", "#5a2c00"];
const DRUM_COLORS  = ["#ee7700", "#e8223a", "#f5cc00", "#2299ee", "#00e06e"];
const DRUM_COLORS_DARK = ["#5a2c00", "#5a0c15", "#5a4a00", "#0c3a5a", "#005528"];

const EDGE_COLOR  = "rgba(140,140,180,0.35)";
const DIV_COLOR   = "rgba(255,255,255,0.06)";
const BEAT_COLOR  = "rgba(255,255,255,0.10)";
const HALF_COLOR  = "rgba(255,255,255,0.035)";
const SP_COLOR    = "rgba(100,200,255,0.06)";
const BRE_COLOR   = "rgba(255,140,0,0.08)";
const TREMOLO_COLOR = "rgba(255,230,0,0.08)";
const TRILL_COLOR  = "rgba(0,220,100,0.08)";
const STRIKE_COLOR = "#cc33aa";

function lightenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, Math.round(r + (255 - r) * amount))},${Math.min(255, Math.round(g + (255 - g) * amount))},${Math.min(255, Math.round(b + (255 - b) * amount))})`;
}

function getPhraseColor(type: Phrase["type"]): string {
  switch (type) {
    case "starPower": return SP_COLOR;
    case "bre":       return BRE_COLOR;
    case "tremolo":   return TREMOLO_COLOR;
    case "trill":     return TRILL_COLOR;
  }
}

function getPhraseBorderColor(type: Phrase["type"]): string {
  switch (type) {
    case "starPower": return "rgba(100,200,255,0.4)";
    case "bre":       return "rgba(255,140,0,0.4)";
    case "tremolo":   return "rgba(255,230,0,0.4)";
    case "trill":     return "rgba(0,220,100,0.4)";
  }
}

/** Binary-search for the first index where notes[i].tick >= minTick. */
function lowerBound(notes: readonly Note[], minTick: number): number {
  let lo = 0, hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].tick < minTick) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ── Component ──────────────────────────────────────────────────────
export const TrackLane = memo(function TrackLane({
  chart,
  trackKey,
  currentTick,
  isPlaying,
  currentTickRef,
  zoom,
  renderDistance,
  snapDivision,
  selectedNoteIds,
  onSelectNotes,
  onAddNote,
  onDeleteNotes,
  onMoveNotes,
  waveform,
  vizMode = "waveform",
  spectrogram,
  editMode = "note",
  phraseType = "starPower",
  sections = [],
  onAddPhrase,
  onDeletePhrase,
  onResizeNote,
  lyrics,
  ghostNotes,
  densityHeatmap,
  leftyFlip = false,
  onRightClickDrag,
  isDrumTrack,
  drumMode = "4lane",
}: TrackLaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  const isDrums = isDrumTrack ?? trackKey.includes("Drums");
  const numCols = isDrums ? (drumMode === "5lane" ? 5 : 4) : NUM_FRETS;

  // Right-click drag state for sustain creation
  const rightDragRef = useRef({ active: false, startTick: 0, startFret: 0, currentTick: 0 });

  // Off-screen canvas + ImageData reused across frames for spectrogram rendering
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrogramImgRef    = useRef<{ data: ImageData; w: number; h: number } | null>(null);

  // Cached gradients and pre-allocated arrays to avoid per-frame allocations
  const gradientCacheRef = useRef<{
    hw: CanvasGradient | null;
    vigL: CanvasGradient | null;
    vigR: CanvasGradient | null;
    W: number; H: number;
  }>({ hw: null, vigL: null, vigR: null, W: 0, H: 0 });
  // Pre-allocated waveform arrays (reused across frames)
  const waveformBufRef = useRef<{ lx: number[]; rx: number[]; y: number[]; cap: number }>({ lx: [], rx: [], y: [], cap: 0 });

  // Drag (note move)
  const dragRef = useRef({ active: false, noteId: "", startTick: 0, startFret: 0 });
  // Lasso (rubber band selection)
  const lassoRef = useRef({ active: false, x1: 0, y1: 0, x2: 0, y2: 0 });
  // Phrase draw
  const phraseDrawRef = useRef({ active: false, startTick: 0, currentTick: 0 });
  // Sustain resize
  const resizeRef = useRef({ active: false, noteId: "", startY: 0, originalLength: 0, startTick: 0 });

  const [lassoRect, setLassoRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [phraseDraw, setPhraseDraw] = useState<{ startTick: number; endTick: number } | null>(null);

  const propsRef = useRef({
    chart, trackKey, currentTick, isPlaying, currentTickRef,
    zoom, renderDistance, snapDivision,
    selectedNoteIds, onSelectNotes, onAddNote, onDeleteNotes, onMoveNotes,
    waveform, vizMode, spectrogram, editMode, phraseType, sections,
    onAddPhrase, onDeletePhrase, onResizeNote, lyrics, ghostNotes, densityHeatmap,
    leftyFlip, numCols, isDrums,
    lassoRect: null as { x1: number; y1: number; x2: number; y2: number } | null,
    phraseDraw: null as { startTick: number; endTick: number } | null,
  });
  propsRef.current = {
    chart, trackKey, currentTick, isPlaying, currentTickRef,
    zoom, renderDistance, snapDivision,
    selectedNoteIds, onSelectNotes, onAddNote, onDeleteNotes, onMoveNotes,
    waveform, vizMode, spectrogram, editMode, phraseType, sections,
    onAddPhrase, onDeletePhrase, onResizeNote, lyrics, ghostNotes, densityHeatmap,
    leftyFlip, numCols, isDrums,
    lassoRect,
    phraseDraw,
  };

  // Trigger re-render when fret images finish loading
  const [imagesReady, setImagesReady] = useState(0);
  useEffect(() => {
    preloadFretImages(() => setImagesReady((n) => n + 1));
  }, []);

  // Resize canvas to fill container
  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        canvas.width  = e.contentRect.width;
        canvas.height = e.contentRect.height;
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Render ─────────────────────────────────────────────────────
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width < 10) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { chart, trackKey, currentTickRef: ctRef, currentTick: propTick,
            zoom, renderDistance, selectedNoteIds, waveform, editMode, sections, lyrics,
            ghostNotes, densityHeatmap, lassoRect, phraseDraw, leftyFlip,
            numCols: pNumCols, isDrums: pIsDrums } = propsRef.current;
    const currentTick = ctRef?.current ?? propTick;
    const isDrums = pIsDrums;
    const numCols = pNumCols;
    const track      = chart.tracks[trackKey];
    const resolution = chart.metadata.resolution || 192;
    const vt         = visibleTicksFromZoom(zoom, resolution, renderDistance);

    // Lefty-flip helper: mirror the fret index
    const flipFret = (fi: number) => leftyFlip ? (numCols - 1 - fi) : fi;

    // Visible note range via binary search (notes are sorted by tick)
    const visStart = track ? lowerBound(track.notes, currentTick - vt) : 0;

    const W = canvas.width;
    const H = canvas.height;
    const hy = H * HORIZON_Y_RATIO;
    const sy = H * STRIKE_Y_RATIO;
    const vpX = W / 2;
    const laneStrike = laneAt(1, W, H, numCols);
    const noteColors = isDrums ? DRUM_COLORS : NOTE_COLORS;
    const darkColors = isDrums ? DRUM_COLORS_DARK : NOTE_COLORS_DARK;

    // Zoom-dependent note sizing
    const zoomScale      = zoom / DEFAULT_ZOOM;
    const noteThickTicks = Math.max(4, (resolution / 12) * zoomScale);
    const COL_PAD        = Math.max(0.01, 0.05 - zoomScale * 0.01);

    // ── 1. Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    // ── 2. Highway surface (cached gradients)
    const gc = gradientCacheRef.current;
    if (!gc.hw || gc.W !== W || gc.H !== H) {
      gc.hw = ctx.createLinearGradient(0, hy, 0, sy);
      gc.hw.addColorStop(0, "#08080f");
      gc.hw.addColorStop(1, "#0e0e1c");
      const vigLBase = laneStrike.left;
      const vigLInner = laneStrike.left + laneStrike.width * 0.12;
      gc.vigL = ctx.createLinearGradient(vigLBase, 0, vigLInner, 0);
      gc.vigL.addColorStop(0, "rgba(0,0,0,0.5)");
      gc.vigL.addColorStop(1, "rgba(0,0,0,0)");
      const vigRBase = laneStrike.right;
      const vigRInner = laneStrike.right - laneStrike.width * 0.12;
      gc.vigR = ctx.createLinearGradient(vigRBase, 0, vigRInner, 0);
      gc.vigR.addColorStop(0, "rgba(0,0,0,0.5)");
      gc.vigR.addColorStop(1, "rgba(0,0,0,0)");
      gc.W = W; gc.H = H;
    }
    ctx.fillStyle = gc.hw;
    ctx.beginPath();
    ctx.moveTo(vpX, hy);
    ctx.lineTo(laneStrike.right, sy);
    ctx.lineTo(laneStrike.left, sy);
    ctx.closePath();
    ctx.fill();

    // Vignette (cached gradients)
    const hwPath = () => { ctx.beginPath(); ctx.moveTo(vpX, hy); ctx.lineTo(laneStrike.right, sy); ctx.lineTo(laneStrike.left, sy); ctx.closePath(); };
    ctx.fillStyle = gc.vigL!;
    hwPath(); ctx.fill();
    ctx.fillStyle = gc.vigR!;
    hwPath(); ctx.fill();

    // ── 3. Lane edges
    ctx.strokeStyle = EDGE_COLOR;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(vpX, hy); ctx.lineTo(laneStrike.left, sy);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vpX, hy); ctx.lineTo(laneStrike.right, sy); ctx.stroke();

    // ── 4. Column dividers
    ctx.strokeStyle = DIV_COLOR;
    ctx.lineWidth   = 1;
    for (let i = 1; i < numCols; i++) {
      const bx = laneStrike.left + (i / numCols) * laneStrike.width;
      ctx.beginPath(); ctx.moveTo(vpX, hy); ctx.lineTo(bx, sy); ctx.stroke();
    }

    // ── 5. Beat grid
    const beatTicks     = resolution;
    const halfBeatTicks = resolution / 2;
    const firstBeat     = Math.ceil(currentTick / halfBeatTicks) * halfBeatTicks;
    for (let tick = firstBeat; tick <= currentTick + vt * 1.05; tick += halfBeatTicks) {
      const dt = tick - currentTick;
      if (dt < 0) continue;
      const lane    = laneAt(depthAt(dt, vt), W, H, numCols);
      const isBeat  = tick % beatTicks === 0;
      ctx.strokeStyle = isBeat ? BEAT_COLOR : HALF_COLOR;
      ctx.lineWidth   = isBeat ? 1.2 : 0.6;
      ctx.beginPath(); ctx.moveTo(lane.left, lane.y); ctx.lineTo(lane.right, lane.y); ctx.stroke();
    }

    // ── Clip to highway triangle
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(vpX, hy);
    ctx.lineTo(laneStrike.right + 2, sy);
    ctx.lineTo(laneStrike.left  - 2, sy);
    ctx.closePath();
    ctx.clip();

    // ── 6. Audio overlay (waveform or mel spectrogram)
    const { vizMode, spectrogram } = propsRef.current;

    if (vizMode === "spectrogram" && spectrogram && spectrogram.numBuckets > 0) {
      // ── Mel spectrogram: scanline ImageData renderer ─────────────────────
      // For each screen row between horizon and strike, invert the perspective
      // to find the tick at that row, look up the spectrogram color, and write
      // pixels directly. This avoids 300+ canvas fill() calls per frame, giving
      // smooth, artifact-free output even at 60 fps.

      // Lazily create/resize the offscreen canvas
      if (!spectrogramCanvasRef.current) {
        spectrogramCanvasRef.current = document.createElement("canvas");
      }
      const sc = spectrogramCanvasRef.current;
      if (sc.width !== W || sc.height !== H) {
        sc.width = W;
        sc.height = H;
        spectrogramImgRef.current = null; // force ImageData realloc
      }
      const sCtx = sc.getContext("2d");
      if (sCtx) {
        // Reuse the ImageData allocation when dimensions haven't changed
        if (!spectrogramImgRef.current || spectrogramImgRef.current.w !== W || spectrogramImgRef.current.h !== H) {
          spectrogramImgRef.current = { data: sCtx.createImageData(W, H), w: W, h: H };
        }
        const imgData = spectrogramImgRef.current.data;
        const px = imgData.data;

        // Zero only the highway band (hy → sy rows) rather than the whole buffer
        const rowStart = Math.ceil(hy) * W * 4;
        const rowEnd   = Math.ceil(sy) * W * 4;
        px.fill(0, rowStart, rowEnd);

        for (let screenY = Math.ceil(hy) + 1; screenY < sy; screenY++) {
          const dt = yToTickOffset(screenY, W, H, vt);
          if (dt < 0 || dt > vt) continue;

          const [r, g, b] = getSpectrogramRgb(spectrogram, currentTick + dt);
          const energy = (r + g + b) / (3 * 255);
          if (energy < 0.015) continue;

          const d    = depthAt(dt, vt);
          const lane = laneAt(d, W, H, numCols);
          const hw   = lane.width * 0.42 * energy;
          const xL   = Math.max(0,     Math.round(lane.cx - hw));
          const xR   = Math.min(W - 1, Math.round(lane.cx + hw));
          const a    = Math.round((0.12 + energy * 0.38) * 255);

          const base = screenY * W;
          for (let x = xL; x <= xR; x++) {
            const i = (base + x) << 2;
            px[i]     = r;
            px[i + 1] = g;
            px[i + 2] = b;
            px[i + 3] = a;
          }
        }

        sCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(sc, 0, 0);
      }

    } else if (vizMode === "waveform" && waveform && waveform.peaks.length > 0) {
      // ── Waveform: classic symmetric blue shape (pre-allocated buffers)
      const tickStep = Math.max(waveform.ticksPerSample, Math.ceil(vt / 500));
      const needed = Math.ceil((vt + tickStep) / tickStep) + 1;
      const wb = waveformBufRef.current;
      if (wb.cap < needed) {
        wb.lx = new Array(needed); wb.rx = new Array(needed); wb.y = new Array(needed); wb.cap = needed;
      }
      let n = 0;
      for (let dt = 0; dt <= vt + tickStep; dt += tickStep) {
        const d    = depthAt(dt, vt);
        const lane = laneAt(d, W, H, numCols);
        const hw   = lane.width * 0.42 * getWaveformPeak(waveform, currentTick + dt);
        wb.lx[n] = lane.cx - hw; wb.rx[n] = lane.cx + hw; wb.y[n] = lane.y;
        n++;
      }
      if (n >= 2) {
        ctx.fillStyle = "rgba(80,200,255,0.10)";
        ctx.beginPath();
        ctx.moveTo(wb.lx[0], wb.y[0]);
        for (let i = 1; i < n; i++) ctx.lineTo(wb.lx[i], wb.y[i]);
        for (let i = n - 1; i >= 0; i--) ctx.lineTo(wb.rx[i], wb.y[i]);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(100,220,255,0.35)";
        ctx.lineWidth   = 1;
        ctx.beginPath(); ctx.moveTo(wb.lx[0], wb.y[0]);
        for (let i = 1; i < n; i++) ctx.lineTo(wb.lx[i], wb.y[i]);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wb.rx[0], wb.y[0]);
        for (let i = 1; i < n; i++) ctx.lineTo(wb.rx[i], wb.y[i]);
        ctx.stroke();
      }
    }

    // ── 6a2. Density heatmap overlay
    if (densityHeatmap && densityHeatmap.length > 0) {
      const measureTicks = resolution * 4;
      ctx.save();
      ctx.globalAlpha = 0.15;
      for (let mi = 0; mi < densityHeatmap.length; mi++) {
        const mStart = mi * measureTicks;
        const mEnd = (mi + 1) * measureTicks;
        const dtS = mStart - currentTick;
        const dtE = mEnd - currentTick;
        if (dtE < 0 || dtS > vt) continue;
        const lS = laneAt(depthAt(Math.max(0, dtS), vt), W, H, numCols);
        const lE = laneAt(depthAt(Math.min(vt, dtE), vt), W, H, numCols);
        const d = densityHeatmap[mi]; // 0..1
        // Green → Yellow → Red
        const r = Math.round(d < 0.5 ? d * 2 * 255 : 255);
        const g = Math.round(d < 0.5 ? 255 : (1 - (d - 0.5) * 2) * 255);
        ctx.fillStyle = `rgb(${r},${g},0)`;
        ctx.beginPath();
        ctx.moveTo(lE.left, lE.y); ctx.lineTo(lE.right, lE.y);
        ctx.lineTo(lS.right, lS.y); ctx.lineTo(lS.left, lS.y);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    // ── 6b. Phrase highlights (all phrase types)
    if (track) {
      for (const phrase of track.phrases) {
        const dtS = phrase.tick - currentTick;
        const dtE = dtS + phrase.length;
        if (dtE < 0 || dtS > vt) continue;
        const clampedDtS = Math.max(0, dtS);
        const clampedDtE = Math.min(vt, dtE);
        const lS = laneAt(depthAt(clampedDtS, vt), W, H, numCols);
        const lE = laneAt(depthAt(clampedDtE, vt), W, H, numCols);

        // Fill
        ctx.fillStyle = getPhraseColor(phrase.type);
        ctx.beginPath();
        ctx.moveTo(lE.left, lE.y); ctx.lineTo(lE.right, lE.y);
        ctx.lineTo(lS.right, lS.y); ctx.lineTo(lS.left, lS.y);
        ctx.closePath(); ctx.fill();

        const borderColor = getPhraseBorderColor(phrase.type);

        // Boundary lines — always drawn
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = editMode === "phrase" ? 2.5 : 1.5;

        // Start boundary (if visible)
        if (dtS >= 0 && dtS <= vt) {
          ctx.beginPath();
          ctx.moveTo(lS.left, lS.y); ctx.lineTo(lS.right, lS.y);
          ctx.stroke();
          // Triangular markers at start boundary edges
          const triH = Math.max(4, lS.colW * 0.4);
          ctx.fillStyle = borderColor;
          ctx.beginPath();
          ctx.moveTo(lS.left, lS.y);
          ctx.lineTo(lS.left + triH, lS.y);
          ctx.lineTo(lS.left, lS.y - triH);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(lS.right, lS.y);
          ctx.lineTo(lS.right - triH, lS.y);
          ctx.lineTo(lS.right, lS.y - triH);
          ctx.closePath(); ctx.fill();
        }

        // End boundary (if visible)
        if (dtE >= 0 && dtE <= vt) {
          ctx.beginPath();
          ctx.moveTo(lE.left, lE.y); ctx.lineTo(lE.right, lE.y);
          ctx.stroke();
          // Triangular markers at end boundary edges
          const triH = Math.max(4, lE.colW * 0.35);
          ctx.fillStyle = borderColor;
          ctx.beginPath();
          ctx.moveTo(lE.left, lE.y);
          ctx.lineTo(lE.left + triH, lE.y);
          ctx.lineTo(lE.left, lE.y + triH);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(lE.right, lE.y);
          ctx.lineTo(lE.right - triH, lE.y);
          ctx.lineTo(lE.right, lE.y + triH);
          ctx.closePath(); ctx.fill();
        }

        // Duration label (in phrase edit mode, when enough vertical space)
        if (editMode === "phrase") {
          const midDt = (clampedDtS + clampedDtE) / 2;
          const lM = laneAt(depthAt(midDt, vt), W, H, numCols);
          const vertSpace = Math.abs(lS.y - lE.y);
          if (vertSpace > 20) {
            const beats = phrase.length / resolution;
            const label = beats >= 1 ? `${beats.toFixed(beats % 1 === 0 ? 0 : 1)}b` : `${phrase.length}t`;
            ctx.font = `${Math.max(9, Math.min(11, lM.colW * 0.3))}px monospace`;
            ctx.fillStyle = borderColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, lM.cx, lM.y);
          }

          // Dashed guide lines extending from boundaries outside the lane
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (dtS >= 0 && dtS <= vt) {
            ctx.moveTo(lS.left - 20, lS.y); ctx.lineTo(lS.left, lS.y);
            ctx.moveTo(lS.right, lS.y); ctx.lineTo(lS.right + 20, lS.y);
          }
          if (dtE >= 0 && dtE <= vt) {
            ctx.moveTo(lE.left - 20, lE.y); ctx.lineTo(lE.left, lE.y);
            ctx.moveTo(lE.right, lE.y); ctx.lineTo(lE.right + 20, lE.y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // ── 6c. Section markers (linear x in the highway area)
    if (sections && sections.length > 0) {
      for (const section of sections) {
        const dt = section.tick - currentTick;
        if (dt < 0 || dt > vt) continue;
        const d = depthAt(dt, vt);
        const lane = laneAt(d, W, H, numCols);

        ctx.strokeStyle = section.type === "solo" ? "rgba(245,158,11,0.6)" : "rgba(168,85,247,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lane.left, lane.y);
        ctx.lineTo(lane.right, lane.y);
        ctx.stroke();
      }
    }

    // ── 6d. Ghost notes (transparent overlay from another difficulty)
    if (ghostNotes && ghostNotes.length > 0) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      const ghostStart = lowerBound(ghostNotes, currentTick - noteThickTicks);
      for (let gi = ghostStart; gi < ghostNotes.length; gi++) {
        const gn = ghostNotes[gi];
        if (gn.tick > currentTick + vt) break;
        const dt = gn.tick - currentTick;
        if (dt + noteThickTicks < 0 || dt > vt) continue;

        const fi = isDrums ? gn.fret - 1 : gn.fret;
        if (fi < 0 || fi >= numCols) continue;

        const d = depthAt(Math.max(0, dt), vt);
        const lane = laneAt(d, W, H, numCols);
        const cx = lane.left + (fi + 0.5) * lane.colW;
        const halfW = lane.colW * 0.35;
        const halfH = halfW * 0.45;

        // Draw as rounded rect with gray tone
        ctx.fillStyle = "#888";
        ctx.beginPath();
        ctx.ellipse(cx, lane.y, halfW, halfH, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── 7. Sustain tails
    if (track) {
      for (let _ni = visStart; _ni < track.notes.length; _ni++) {
        const note = track.notes[_ni];
        if (note.tick > currentTick + vt) break;
        if (note.length <= 0) continue;
        const dt    = note.tick - currentTick;
        const dtEnd = dt + note.length;
        if (dtEnd < 0 || dt > vt) continue;
        if (isDrums && note.fret === 0) continue;

        const rawFi2 = isDrums ? note.fret - 1 : note.fret;
        if (rawFi2 < 0) continue;
        const fi = flipFret(rawFi2);

        const color      = noteColors[note.fret] ?? "#888";
        const isSelected = selectedNoteIds.has(note.id);
        const dtStart    = Math.max(0, dt + noteThickTicks * 0.5);
        const dtStop     = Math.min(vt, dtEnd);
        const segCount   = Math.max(4, Math.min(40, Math.ceil(note.length / (resolution / 4))));
        const segLen     = (dtStop - dtStart) / segCount;
        const barFrac    = 0.16;

        for (let s = 0; s < segCount; s++) {
          const dt0 = dtStart + s * segLen;
          const dt1 = dtStart + (s + 1) * segLen;
          const l0  = laneAt(depthAt(dt0, vt), W, H, numCols);
          const l1  = laneAt(depthAt(dt1, vt), W, H, numCols);
          const mid = (fi + 0.5) / numCols;
          const x0L = l0.left + (mid - barFrac / 2) * l0.width;
          const x0R = l0.left + (mid + barFrac / 2) * l0.width;
          const x1L = l1.left + (mid - barFrac / 2) * l1.width;
          const x1R = l1.left + (mid + barFrac / 2) * l1.width;
          ctx.fillStyle = isSelected ? color + "cc" : color + "88";
          ctx.beginPath();
          ctx.moveTo(x1L, l1.y); ctx.lineTo(x1R, l1.y);
          ctx.lineTo(x0R, l0.y); ctx.lineTo(x0L, l0.y);
          ctx.closePath(); ctx.fill();
        }

        // Center spine
        const lNear = laneAt(depthAt(dtStart, vt), W, H, numCols);
        const lFar  = laneAt(depthAt(dtStop, vt), W, H, numCols);
        const mid   = (fi + 0.5) / numCols;
        ctx.shadowColor = color; ctx.shadowBlur = 3 * lNear.y / sy;
        ctx.strokeStyle = lightenColor(color, 0.3) + "99";
        ctx.lineWidth   = Math.max(0.5, lNear.colW * barFrac * 0.2);
        ctx.beginPath();
        ctx.moveTo(lFar.left + mid * lFar.width, lFar.y);
        ctx.lineTo(lNear.left + mid * lNear.width, lNear.y);
        ctx.stroke(); ctx.shadowBlur = 0;

        // End cap
        if (dtEnd <= vt && dtEnd > 0) {
          const lEnd  = laneAt(depthAt(Math.max(0, dtEnd), vt), W, H, numCols);
          const capCx = lEnd.left + mid * lEnd.width;
          const capW  = lEnd.colW * barFrac;
          ctx.fillStyle = color;
          ctx.fillRect(capCx - capW / 2, lEnd.y - 1.5, capW, 3);
        }
      }
    }

    // ── 8. Note heads (sorted back-to-front)
    if (track) {
      let visEnd = visStart;
      while (visEnd < track.notes.length && track.notes[visEnd].tick <= currentTick + vt) visEnd++;
      const sorted = track.notes.slice(visStart, visEnd).sort((a, b) => (b.tick - currentTick) - (a.tick - currentTick));

      for (const note of sorted) {
        const dt = note.tick - currentTick;
        if (dt + noteThickTicks < -noteThickTicks || dt > vt) continue;

        const isSelected = selectedNoteIds.has(note.id);

        // ── Kick drum: full-width bar (no image)
        if (isDrums && note.fret === 0) {
          const dK = depthAt(Math.max(0, dt), vt);
          const lK = laneAt(dK, W, H, numCols);
          ctx.shadowColor = DRUM_COLORS[0]; ctx.shadowBlur = 6 * dK;
          ctx.strokeStyle = isSelected ? "#fff" : DRUM_COLORS[0];
          ctx.lineWidth   = Math.max(2, 4 * dK);
          ctx.beginPath(); ctx.moveTo(lK.left, lK.y); ctx.lineTo(lK.right, lK.y); ctx.stroke();
          ctx.shadowBlur = 0;
          continue;
        }

        const rawFi = isDrums ? note.fret - 1 : note.fret;
        if (rawFi < 0 || rawFi >= numCols) continue;
        const fi = flipFret(rawFi);

        // Trapezoid corners
        const dtF  = Math.max(0, dt);
        const dF   = depthAt(dtF, vt);
        const lF   = laneAt(dF, W, H, numCols);
        const dtB  = Math.max(0, dt + noteThickTicks);
        const dB   = depthAt(dtB, vt);
        const lB   = laneAt(dB, W, H, numCols);

        const fracL = (fi      + COL_PAD) / numCols;
        const fracR = (fi + 1  - COL_PAD) / numCols;

        const fxFL = lF.left + fracL * lF.width;
        const fxFR = lF.left + fracR * lF.width;
        const fxBL = lB.left + fracL * lB.width;
        const fxBR = lB.left + fracR * lB.width;
        const yF   = lF.y;
        const yB   = lB.y;

        const imgName = isDrums ? DRUM_FRET_IMG[note.fret] : GUITAR_FRET_IMG[note.fret];
        const img     = imgName ? IMAGE_CACHE.get(imgName) : undefined;

        if (img && img.complete && img.naturalWidth > 0) {
          if (isSelected) {
            ctx.shadowColor = "#fff";
            ctx.shadowBlur  = 12 * dF;
          } else {
            const color     = noteColors[note.fret] ?? "#888";
            ctx.shadowColor = color;
            ctx.shadowBlur  = 8 * dF;
          }

          drawPerspectiveImage(ctx, img, fxBL, yB, fxBR, fxFL, yF, fxFR);
          ctx.shadowBlur = 0;

          if (isSelected) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(fxFL, yF); ctx.lineTo(fxFR, yF);
            ctx.lineTo(fxBR, yB); ctx.lineTo(fxBL, yB);
            ctx.closePath();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth   = 2;
            ctx.shadowColor = "#fff";
            ctx.shadowBlur  = 10;
            ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,0.12)";
            ctx.fill();
            ctx.restore();
          }
        } else {
          const color     = noteColors[note.fret] ?? "#888";
          const darkColor = darkColors[note.fret] ?? "#333";

          ctx.shadowColor = color;
          ctx.shadowBlur  = (isSelected ? 18 : 8) * dF;
          ctx.fillStyle   = color;
          ctx.beginPath();
          ctx.moveTo(fxFL, yF); ctx.lineTo(fxFR, yF);
          ctx.lineTo(fxBR, yB); ctx.lineTo(fxBL, yB);
          ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 0;

          const bevel = ctx.createLinearGradient(0, yB, 0, yF);
          bevel.addColorStop(0,    "rgba(0,0,0,0.20)");
          bevel.addColorStop(0.6,  "rgba(0,0,0,0)");
          bevel.addColorStop(0.85, "rgba(255,255,255,0.08)");
          bevel.addColorStop(1,    "rgba(255,255,255,0.18)");
          ctx.fillStyle = bevel;
          ctx.beginPath();
          ctx.moveTo(fxFL, yF); ctx.lineTo(fxFR, yF);
          ctx.lineTo(fxBR, yB); ctx.lineTo(fxBL, yB);
          ctx.closePath(); ctx.fill();

          ctx.strokeStyle = darkColor;
          ctx.lineWidth   = Math.max(0.5, 1.2 * dF);
          ctx.beginPath();
          ctx.moveTo(fxFL, yF); ctx.lineTo(fxFR, yF);
          ctx.lineTo(fxBR, yB); ctx.lineTo(fxBL, yB);
          ctx.closePath(); ctx.stroke();

          if (isSelected) {
            ctx.shadowColor = "#fff"; ctx.shadowBlur = 10;
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(fxFL, yF); ctx.lineTo(fxFR, yF);
            ctx.lineTo(fxBR, yB); ctx.lineTo(fxBL, yB);
            ctx.closePath(); ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }

        // ── HOPO / flag indicators
        if (note.flags) {
          const gemCx = (fxFL + fxFR) / 2;
          const gemCy = yF;
          const gemW  = fxFR - fxFL;

          if (note.flags.tap) {
            const radius = Math.max(3, gemW * 0.35);
            ctx.strokeStyle = "rgba(255,255,255,0.85)";
            ctx.lineWidth   = Math.max(1, dF * 2);
            ctx.shadowColor = "#fff"; ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(gemCx, gemCy - (yF - yB) * 0.5, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          if (note.flags.forceHopo) {
            const triSize = Math.max(4, gemW * 0.25);
            const triY    = yF - (yF - yB) * 0.1 - triSize;
            ctx.fillStyle   = "#fff";
            ctx.shadowColor = "#fff"; ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.moveTo(gemCx, triY);
            ctx.lineTo(gemCx - triSize * 0.6, triY + triSize);
            ctx.lineTo(gemCx + triSize * 0.6, triY + triSize);
            ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0;
          }

          if (note.flags.forceStrum) {
            const fontSize = Math.max(6, Math.round(gemW * 0.4));
            ctx.fillStyle = "#fbbf24";
            ctx.font      = `bold ${fontSize}px sans-serif`;
            ctx.fillText("S", fxFR + 1, yF - (yF - yB) * 0.3);
          }

          // Open note indicator: purple horizontal bar spanning full width
          if (note.flags.open && !isDrums) {
            const dO = depthAt(Math.max(0, dt), vt);
            const lO = laneAt(dO, W, H, numCols);
            ctx.save();
            ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 10 * dO;
            ctx.fillStyle = "rgba(168,85,247,0.6)";
            ctx.fillRect(lO.left, lO.y - 2, lO.width, 4);
            ctx.restore();
          }

          // Cymbal indicator: diamond shape above note (drums)
          if (note.flags.cymbal && isDrums) {
            const diaSize = Math.max(3, gemW * 0.2);
            const diaY = yB - diaSize * 1.2;
            ctx.fillStyle = "#fde047";
            ctx.beginPath();
            ctx.moveTo(gemCx, diaY - diaSize);
            ctx.lineTo(gemCx + diaSize, diaY);
            ctx.lineTo(gemCx, diaY + diaSize);
            ctx.lineTo(gemCx - diaSize, diaY);
            ctx.closePath(); ctx.fill();
          }

          // Accent indicator: upward arrow (drums)
          if (note.flags.accent && isDrums) {
            const arrowSize = Math.max(3, gemW * 0.18);
            const arrowY = yB - arrowSize * 0.5;
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = Math.max(1.5, dF * 2);
            ctx.beginPath();
            ctx.moveTo(gemCx - arrowSize, arrowY + arrowSize);
            ctx.lineTo(gemCx, arrowY);
            ctx.lineTo(gemCx + arrowSize, arrowY + arrowSize);
            ctx.stroke();
          }

          // Ghost indicator: parentheses around note (drums)
          if (note.flags.ghost && isDrums) {
            const fontSize = Math.max(8, Math.round(gemW * 0.5));
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.font = `${fontSize}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const cy = yF - (yF - yB) * 0.5;
            ctx.fillText("(", fxFL - 2, cy);
            ctx.fillText(")", fxFR + 2, cy);
          }

          // Double kick indicator: "2x" label (drums)
          if (note.flags.doubleKick && isDrums && note.fret === 0) {
            const dK = depthAt(Math.max(0, dt), vt);
            const lK = laneAt(dK, W, H, numCols);
            const fontSize = Math.max(7, Math.round(lK.colW * 0.3));
            ctx.fillStyle = "#ef4444";
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText("2x", lK.right + 3, lK.y);
          }
        }
      }
    }

    // ── End clip
    ctx.restore();

    // ── 8b. Section labels at top of canvas (above highway)
    if (sections && sections.length > 0) {
      for (const section of sections) {
        const dt = section.tick - currentTick;
        if (dt < 0 || dt > vt) continue;
        const x = (dt / vt) * W;  // Linear x position for labels at top

        ctx.strokeStyle = section.type === "solo" ? "rgba(245,158,11,0.5)" : "rgba(168,85,247,0.5)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H * HORIZON_Y_RATIO);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = "bold 9px sans-serif";
        const textW = ctx.measureText(section.name).width;
        ctx.fillStyle = section.type === "solo" ? "rgba(245,158,11,0.25)" : "rgba(168,85,247,0.25)";
        ctx.fillRect(x + 2, 2, textW + 4, 12);
        ctx.fillStyle = section.type === "solo" ? "#fcd34d" : "#d8b4fe";
        ctx.fillText(section.name, x + 4, 11);
      }
    }

    // ── 8c. Lyrics overlay (Vocals track only)
    if (lyrics && lyrics.length > 0) {
      const sy2 = H * STRIKE_Y_RATIO;
      ctx.save();
      for (const lyric of lyrics) {
        if (lyric.tick === null) continue;
        const dt = lyric.tick - currentTick;
        if (dt < 0 || dt > vt) continue;
        const d    = depthAt(dt, vt);
        const lane = laneAt(d, W, H, numCols);
        const y    = lane.y - 6;
        const fontSize = Math.max(8, Math.round(11 * d));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        const tw = ctx.measureText(lyric.text).width;
        // Background pill
        ctx.fillStyle = "rgba(0,0,0,0.60)";
        ctx.beginPath();
        ctx.roundRect(lane.cx - tw / 2 - 3, y - fontSize - 1, tw + 6, fontSize + 3, 3);
        ctx.fill();
        // Text
        const alpha = Math.min(1, d * 1.4 + 0.2);
        ctx.fillStyle = `rgba(255,160,220,${alpha})`;
        ctx.fillText(lyric.text, lane.cx, y);
      }
      ctx.restore();
    }

    // ── 9. Strikeline
    ctx.shadowColor = STRIKE_COLOR; ctx.shadowBlur = 40;
    ctx.fillStyle   = STRIKE_COLOR + "25";
    ctx.fillRect(laneStrike.left - 8, sy - 14, laneStrike.width + 16, 28);
    ctx.shadowBlur = 0;
    ctx.shadowColor = STRIKE_COLOR; ctx.shadowBlur = 18;
    ctx.fillStyle   = STRIKE_COLOR;
    ctx.fillRect(laneStrike.left, sy - 2, laneStrike.width, 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.fillRect(laneStrike.left, sy - 0.5, laneStrike.width, 1);

    // ── 10. Bottom panel
    const panelGrad = ctx.createLinearGradient(0, sy, 0, H);
    panelGrad.addColorStop(0, "#0a0a14");
    panelGrad.addColorStop(1, "#050508");
    ctx.fillStyle = panelGrad;
    ctx.fillRect(laneStrike.left, sy + 2, laneStrike.width, H - sy - 2);

    // ── 11. Fret buttons
    const btnGap    = 4;
    const btnTop    = sy + 10;
    const btnBot    = H - 8;
    const btnH      = Math.max(24, btnBot - btnTop);
    const btnTotalW = laneStrike.width - btnGap * (numCols - 1);
    const btnW      = btnTotalW / numCols;

    for (let i = 0; i < numCols; i++) {
      const fretIdx   = isDrums ? i + 1 : i;
      const bx        = laneStrike.left + i * (btnW + btnGap);
      const color     = noteColors[fretIdx] ?? "#888";
      const darkColor = darkColors[fretIdx] ?? "#333";

      ctx.fillStyle = "#0a0a14";
      ctx.beginPath(); ctx.roundRect(bx, btnTop, btnW, btnH, 5); ctx.fill();

      ctx.fillStyle = darkColor + "66";
      ctx.beginPath(); ctx.roundRect(bx + 1, btnTop + 1, btnW - 2, btnH - 2, 4); ctx.fill();

      ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.strokeStyle = color + "99"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(bx + 1, btnTop + 1, btnW - 2, btnH - 2, 4); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ── 12. Lasso rect overlay
    if (lassoRect) {
      const x = Math.min(lassoRect.x1, lassoRect.x2);
      const y = Math.min(lassoRect.y1, lassoRect.y2);
      const w = Math.abs(lassoRect.x2 - lassoRect.x1);
      const h = Math.abs(lassoRect.y2 - lassoRect.y1);
      ctx.fillStyle   = "rgba(100,200,255,0.08)";
      ctx.strokeStyle = "rgba(100,200,255,0.6)";
      ctx.lineWidth   = 1;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }

    // ── 13. Phrase draw preview
    if (phraseDraw) {
      const { startTick, endTick } = phraseDraw;
      const dtS = (Math.min(startTick, endTick)) - currentTick;
      const dtE = (Math.max(startTick, endTick)) - currentTick;
      if (!(dtE < 0 || dtS > vt)) {
        const lS = laneAt(depthAt(Math.max(0, dtS), vt), W, H, numCols);
        const lE = laneAt(depthAt(Math.min(vt, dtE), vt), W, H, numCols);
        ctx.fillStyle   = "rgba(255,255,255,0.08)";
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(lE.left, lE.y); ctx.lineTo(lE.right, lE.y);
        ctx.lineTo(lS.right, lS.y); ctx.lineTo(lS.left, lS.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Static re-render: fires when any non-tick prop changes
  useEffect(() => {
    renderCanvas();
  }, [
    chart, trackKey, zoom, renderDistance, selectedNoteIds, waveform, vizMode, spectrogram,
    editMode, sections, lyrics, isPlaying, imagesReady, lassoRect, phraseDraw, renderCanvas,
  ]);

  // Playback RAF: smooth 60fps canvas updates driven by currentTickRef
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    function loop() {
      renderCanvas();
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, renderCanvas]);

  // ── Hit-test ────────────────────────────────────────────────
  const getNoteAt = useCallback(
    (cx: number, cy: number, W: number, H: number): Note | null => {
      const { chart, trackKey, currentTick, zoom, renderDistance } = propsRef.current;
      const track = chart.tracks[trackKey];
      if (!track) return null;
      const isDrums    = trackKey.includes("Drums");
      const numCols    = isDrums ? 4 : NUM_FRETS;
      const resolution = chart.metadata.resolution || 192;
      const vt         = visibleTicksFromZoom(zoom, resolution, renderDistance);
      const zoomScale  = zoom / DEFAULT_ZOOM;
      const noteThickTicks = Math.max(4, (resolution / 12) * zoomScale);
      const COL_PAD    = Math.max(0.01, 0.05 - zoomScale * 0.01);

      for (const note of track.notes) {
        const dt = note.tick - currentTick;
        if (dt + noteThickTicks < 0 || dt > vt) continue;

        const d    = depthAt(Math.max(0, dt), vt);
        const lane = laneAt(d, W, H, numCols);

        if (isDrums && note.fret === 0) {
          if (Math.abs(cy - lane.y) < 10 && cx >= lane.left && cx <= lane.right) return note;
          continue;
        }

        const fi = isDrums ? note.fret - 1 : note.fret;
        if (fi < 0 || fi >= numCols) continue;

        const dB    = depthAt(Math.max(0, dt + noteThickTicks), vt);
        const lB    = laneAt(dB, W, H, numCols);
        const fracL = (fi + COL_PAD) / numCols;
        const fracR = (fi + 1 - COL_PAD) / numCols;
        const nxL   = lane.left + fracL * lane.width;
        const nxR   = lane.left + fracR * lane.width;

        if (cx >= nxL - 4 && cx <= nxR + 4 && cy >= lB.y - 4 && cy <= lane.y + 4) return note;

        // Sustain hit zone
        if (note.length > 0) {
          const dEnd  = depthAt(Math.max(0, Math.min(vt, dt + note.length)), vt);
          const lEnd  = laneAt(dEnd, W, H, numCols);
          const mid   = (fi + 0.5) / numCols;
          const barFrac = 0.16;
          const barL  = lEnd.left + (mid - barFrac / 2) * lEnd.width;
          const barR  = lEnd.left + (mid + barFrac / 2) * lEnd.width;
          if (cx >= barL - 4 && cx <= barR + 4 && cy >= lEnd.y - 4 && cy <= lane.y + 4) return note;
        }
      }
      return null;
    },
    []
  );

  // ── Hit-test sustain end cap for resize ───────────────────────
  const getSustainResizeAt = useCallback(
    (cx: number, cy: number, W: number, H: number): Note | null => {
      const { chart, trackKey, currentTick, zoom, renderDistance } = propsRef.current;
      const track = chart.tracks[trackKey];
      if (!track) return null;
      const isDrums    = trackKey.includes("Drums");
      const numCols    = isDrums ? 4 : NUM_FRETS;
      const resolution = chart.metadata.resolution || 192;
      const vt         = visibleTicksFromZoom(zoom, resolution, renderDistance);
      const barFrac    = 0.16;

      for (const note of track.notes) {
        if (note.length <= 0) continue;
        if (isDrums && note.fret === 0) continue;
        const fi = isDrums ? note.fret - 1 : note.fret;
        if (fi < 0 || fi >= numCols) continue;

        const dtEnd = note.tick + note.length - currentTick;
        if (dtEnd < 0 || dtEnd > vt) continue;

        const dEnd  = depthAt(Math.max(0, dtEnd), vt);
        const lEnd  = laneAt(dEnd, W, H, numCols);
        const mid   = (fi + 0.5) / numCols;
        const capCx = lEnd.left + mid * lEnd.width;
        const capW  = lEnd.colW * barFrac;

        if (
          Math.abs(cy - lEnd.y) <= 6 &&
          cx >= capCx - capW - 4 &&
          cx <= capCx + capW + 4
        ) {
          return note;
        }
      }
      return null;
    },
    []
  );

  // ── Get notes in lasso rect ────────────────────────────────────
  const getNotesInLassoRect = useCallback(
    (rect: { x1: number; y1: number; x2: number; y2: number }, W: number, H: number): string[] => {
      const { chart, trackKey, currentTick, zoom, renderDistance } = propsRef.current;
      const track = chart.tracks[trackKey];
      if (!track) return [];
      const isDrums    = trackKey.includes("Drums");
      const numCols    = isDrums ? 4 : NUM_FRETS;
      const resolution = chart.metadata.resolution || 192;
      const vt         = visibleTicksFromZoom(zoom, resolution, renderDistance);
      const zoomScale  = zoom / DEFAULT_ZOOM;
      const noteThickTicks = Math.max(4, (resolution / 12) * zoomScale);

      const minX = Math.min(rect.x1, rect.x2);
      const maxX = Math.max(rect.x1, rect.x2);
      const minY = Math.min(rect.y1, rect.y2);
      const maxY = Math.max(rect.y1, rect.y2);

      const ids: string[] = [];
      for (const note of track.notes) {
        const dt = note.tick - currentTick;
        if (dt + noteThickTicks < 0 || dt > vt) continue;

        const fi = isDrums ? note.fret - 1 : note.fret;
        if (isDrums && note.fret === 0) {
          const d    = depthAt(Math.max(0, dt), vt);
          const lane = laneAt(d, W, H, numCols);
          const gemCx = lane.cx;
          const gemY  = lane.y;
          if (gemCx >= minX && gemCx <= maxX && gemY >= minY && gemY <= maxY) {
            ids.push(note.id);
          }
          continue;
        }
        if (fi < 0 || fi >= numCols) continue;

        const d    = depthAt(Math.max(0, dt), vt);
        const lane = laneAt(d, W, H, numCols);
        const gemCx = lane.left + ((fi + 0.5) / numCols) * lane.width;
        const gemY  = lane.y;

        if (gemCx >= minX && gemCx <= maxX && gemY >= minY && gemY <= maxY) {
          ids.push(note.id);
        }
      }
      return ids;
    },
    []
  );

  // ── Mouse handlers ─────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Right-click drag for sustain creation
      if (e.button === 2) {
        const rect = canvas.getBoundingClientRect();
        const cx2 = e.clientX - rect.left, cy2 = e.clientY - rect.top;
        const { chart, trackKey, currentTick, zoom, renderDistance, snapDivision, numCols, isDrums, leftyFlip } = propsRef.current;
        const resolution = chart.metadata.resolution || 192;
        const vt = visibleTicksFromZoom(zoom, resolution, renderDistance);
        const gridTicks = snapDivisionToTicks(resolution, snapDivision);
        const rawDt = yToTickOffset(cy2, canvas.width, canvas.height, vt);
        const tick = Math.max(0, snapToGrid(currentTick + rawDt, gridTicks));
        const colIdx = xyToFret(cx2, cy2, canvas.width, canvas.height, vt, numCols);
        const fret = isDrums ? colIdx + 1 : (leftyFlip ? (numCols - 1 - colIdx) : colIdx);
        rightDragRef.current = { active: true, startTick: tick, startFret: fret, currentTick: tick };
        return;
      }

      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const { selectedNoteIds, onSelectNotes, editMode, currentTick, chart, trackKey, zoom, renderDistance, snapDivision, onAddPhrase } = propsRef.current;

      // Eraser mode: click to delete note directly
      if (editMode === "eraser") {
        const note = getNoteAt(cx, cy, canvas.width, canvas.height);
        if (note) {
          const { onDeleteNotes } = propsRef.current;
          onDeleteNotes([note.id]);
        }
        return;
      }

      if (editMode === "phrase") {
        // In phrase mode: start drawing a new phrase
        const resolution = chart.metadata.resolution || 192;
        const vt         = visibleTicksFromZoom(zoom, resolution, renderDistance);
        const gridTicks  = snapDivisionToTicks(resolution, snapDivision);
        const rawDt      = yToTickOffset(cy, canvas.width, canvas.height, vt);
        const tick       = Math.max(0, snapToGrid(currentTick + rawDt, gridTicks));
        phraseDrawRef.current = { active: true, startTick: tick, currentTick: tick };
        setPhraseDraw({ startTick: tick, endTick: tick });
        return;
      }

      // Check for sustain resize handle first
      const resizeNote = getSustainResizeAt(cx, cy, canvas.width, canvas.height);
      if (resizeNote) {
        resizeRef.current = {
          active: true,
          noteId: resizeNote.id,
          startY: cy,
          originalLength: resizeNote.length,
          startTick: resizeNote.tick,
        };
        return;
      }

      const note = getNoteAt(cx, cy, canvas.width, canvas.height);
      if (note) {
        if (!selectedNoteIds.has(note.id))
          onSelectNotes(e.shiftKey ? [...selectedNoteIds, note.id] : [note.id]);
        dragRef.current = { active: true, noteId: note.id, startTick: note.tick, startFret: note.fret };
      } else {
        // Start lasso
        lassoRef.current = { active: true, x1: cx, y1: cy, x2: cx, y2: cy };
        onSelectNotes([]);
      }
    },
    [getNoteAt, getSustainResizeAt]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const { chart, trackKey, currentTick, zoom, renderDistance, snapDivision, onResizeNote } = propsRef.current;

      // Update lasso
      if (lassoRef.current.active) {
        lassoRef.current.x2 = cx;
        lassoRef.current.y2 = cy;
        setLassoRect({ ...lassoRef.current });
        return;
      }

      // Update phrase draw
      if (phraseDrawRef.current.active) {
        const resolution = chart.metadata.resolution || 192;
        const vt         = visibleTicksFromZoom(zoom, resolution, renderDistance);
        const gridTicks  = snapDivisionToTicks(resolution, snapDivision);
        const rawDt      = yToTickOffset(cy, canvas.width, canvas.height, vt);
        const tick       = Math.max(0, snapToGrid(currentTick + rawDt, gridTicks));
        phraseDrawRef.current.currentTick = tick;
        setPhraseDraw({ startTick: phraseDrawRef.current.startTick, endTick: tick });
        return;
      }

      // Update resize
      if (resizeRef.current.active) {
        const resolution  = chart.metadata.resolution || 192;
        const vt          = visibleTicksFromZoom(zoom, resolution, renderDistance);
        const H           = canvas.height;
        const gridTicks   = snapDivisionToTicks(resolution, snapDivision);

        // Compute tick at current Y
        const rawDt   = yToTickOffset(cy, canvas.width, H, vt);
        const endTick = Math.max(resizeRef.current.startTick, snapToGrid(currentTick + rawDt, gridTicks));
        const newLength = Math.max(0, endTick - resizeRef.current.startTick);

        if (onResizeNote) {
          onResizeNote(resizeRef.current.noteId, newLength);
        }
        return;
      }

      // Update right-click drag
      if (rightDragRef.current.active) {
        const resolution = chart.metadata.resolution || 192;
        const vt = visibleTicksFromZoom(zoom, resolution, renderDistance);
        const gridTicks = snapDivisionToTicks(resolution, snapDivision);
        const rawDt = yToTickOffset(cy, canvas.width, canvas.height, vt);
        const tick = Math.max(0, snapToGrid(currentTick + rawDt, gridTicks));
        rightDragRef.current.currentTick = tick;
        return;
      }

      // Hover cursor check for resize handles
      const resizeNote = getSustainResizeAt(cx, cy, canvas.width, canvas.height);
      const editMode = propsRef.current.editMode;
      const newCursor = resizeNote ? "ns-resize" : (editMode === "eraser" ? "not-allowed" : "crosshair");
      if (canvasRef.current) canvasRef.current.style.cursor = newCursor;
    },
    [getSustainResizeAt]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { selectedNoteIds, onSelectNotes, onAddPhrase, phraseType } = propsRef.current;

      // Handle right-click drag completion (sustain creation)
      if (rightDragRef.current.active) {
        const { startTick, startFret, currentTick: endTick } = rightDragRef.current;
        const length = Math.max(0, endTick - startTick);
        if (length > 0) {
          const { onAddNote } = propsRef.current;
          // We need a special add-note-with-sustain, but we can just add note then
          // rely on ChartEditor to handle this
          if (onRightClickDrag) {
            onRightClickDrag(startTick, startFret, endTick);
          }
        }
        rightDragRef.current.active = false;
        return;
      }

      // Handle lasso completion
      if (lassoRef.current.active) {
        const rect = lassoRef.current;
        const ids = getNotesInLassoRect(rect, canvas.width, canvas.height);
        if (ids.length > 0) {
          onSelectNotes(e.shiftKey ? [...selectedNoteIds, ...ids] : ids);
        } else if (!e.shiftKey) {
          onSelectNotes([]);
        }
        lassoRef.current.active = false;
        setLassoRect(null);
        return;
      }

      // Handle phrase draw completion
      if (phraseDrawRef.current.active) {
        const { startTick, currentTick: endTick } = phraseDrawRef.current;
        const start  = Math.min(startTick, endTick);
        const length = Math.abs(endTick - startTick);
        if (length > 0 && onAddPhrase) {
          onAddPhrase(start, length);
        }
        phraseDrawRef.current.active = false;
        setPhraseDraw(null);
        return;
      }

      // Handle resize completion
      if (resizeRef.current.active) {
        resizeRef.current.active = false;
        return;
      }

      // Handle note drag completion
      const drag = dragRef.current;
      if (!drag.active || !drag.noteId) { dragRef.current.active = false; return; }

      const { chart, trackKey, currentTick, zoom, renderDistance, snapDivision, onMoveNotes, numCols: nc, isDrums: isd, leftyFlip: lf } = propsRef.current;
      const resolution = chart.metadata.resolution || 192;
      const vt         = visibleTicksFromZoom(zoom, resolution, renderDistance);
      const gridTicks  = snapDivisionToTicks(resolution, snapDivision);
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;

      const rawDt   = yToTickOffset(cy, canvas.width, canvas.height, vt);
      const newTick = Math.max(0, snapToGrid(currentTick + rawDt, gridTicks));
      const colIdx  = xyToFret(cx, cy, canvas.width, canvas.height, vt, nc);
      const rawCol  = lf ? (nc - 1 - colIdx) : colIdx;
      const newFret = isd ? rawCol + 1 : rawCol;

      const deltaTick = newTick - drag.startTick;
      const deltaFret = newFret - drag.startFret;
      if (deltaTick !== 0 || deltaFret !== 0) {
        const ids = selectedNoteIds.has(drag.noteId) ? [...selectedNoteIds] : [drag.noteId];
        onMoveNotes(ids, deltaTick, deltaFret);
      }
      dragRef.current.active = false;

      // Suppress click if we moved (for drag detection)
      void phraseType;
    },
    [getNotesInLassoRect]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // If drag was active (we just dropped a note), skip click
      if (dragRef.current.active) return;
      // If lasso was completed, skip click
      if (lassoRef.current.active) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;

      const { editMode } = propsRef.current;
      if (editMode === "phrase" || editMode === "eraser") return;

      if (cy <= canvas.height * HORIZON_Y_RATIO || cy >= canvas.height * STRIKE_Y_RATIO) return;
      if (getNoteAt(cx, cy, canvas.width, canvas.height)) return;

      const { chart, currentTick, zoom, renderDistance, snapDivision, onAddNote, numCols: nc, isDrums: isd, leftyFlip: lf } = propsRef.current;
      const resolution = chart.metadata.resolution || 192;
      const vt         = visibleTicksFromZoom(zoom, resolution, renderDistance);
      const gridTicks  = snapDivisionToTicks(resolution, snapDivision);

      const rawDt = yToTickOffset(cy, canvas.width, canvas.height, vt);
      const tick  = Math.max(0, snapToGrid(currentTick + rawDt, gridTicks));
      const colIdx = xyToFret(cx, cy, canvas.width, canvas.height, vt, nc);
      const rawCol = lf ? (nc - 1 - colIdx) : colIdx;
      const fret   = isd ? rawCol + 1 : rawCol;
      onAddNote(tick, fret);
    },
    [getNoteAt]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      // Skip context menu if right-click drag was used
      if (rightDragRef.current.active) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const { onDeleteNotes, selectedNoteIds, editMode, onDeletePhrase } = propsRef.current;

      if (editMode === "phrase") {
        // In phrase mode: check if a phrase is under cursor and delete it
        const { chart, trackKey, currentTick, zoom, renderDistance } = propsRef.current;
        const track = chart.tracks[trackKey];
        if (track) {
          const resolution = chart.metadata.resolution || 192;
          const vt         = visibleTicksFromZoom(zoom, resolution, renderDistance);
          const H          = canvas.height;

          for (const phrase of track.phrases) {
            const dtS = phrase.tick - currentTick;
            const dtE = dtS + phrase.length;
            if (dtE < 0 || dtS > vt) continue;
            const lS = laneAt(depthAt(Math.max(0, dtS), vt), canvas.width, H, numCols);
            const lE = laneAt(depthAt(Math.min(vt, dtE), vt), canvas.width, H, numCols);
            // Check if cy is in the phrase band
            if (cy >= lE.y - 4 && cy <= lS.y + 4 && cx >= lS.left && cx <= lS.right) {
              if (onDeletePhrase) onDeletePhrase(phrase.id);
              return;
            }
          }
        }
        return;
      }

      const note = getNoteAt(cx, cy, canvas.width, canvas.height);
      if (note) {
        const ids = selectedNoteIds.has(note.id) ? [...selectedNoteIds] : [note.id];
        onDeleteNotes(ids);
      }
    },
    [getNoteAt, numCols]
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", cursor: "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
});
