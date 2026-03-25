"use client";

import React, { memo, useEffect, useRef, useCallback } from "react";
import type { ChartData, LyricEvent, Note, TrackKey } from "@/lib/chart/types";
import {
  snapDivisionToTicks,
  snapToGrid,
} from "@/lib/chart/tempo-utils";
import { getActiveLyricIndex } from "@/lib/chart/lyrics-utils";
import { type WaveformData, getWaveformPeak } from "@/lib/chart/waveform";
import { type SpectrogramData, getSpectrogramRgb } from "@/lib/chart/spectrogram";

// ── Layout ────────────────────────────────────────────────────────
const PLAYHEAD_X_RATIO = 0.15;
const PIANO_LABEL_W    = 38;   // left gutter for pitch labels
const PITCHED_MIN      = 36;   // C1
const PITCHED_MAX      = 83;   // B4
const PITCHED_ROWS     = 48;   // PITCHED_MAX - PITCHED_MIN + 1
const PERC_DIVIDER_H   = 6;
const PERC_ROWS        = 2;    // MIDI 96 (playable), 97 (non-playable)
const TOTAL_ROWS       = PITCHED_ROWS + PERC_ROWS;
const PAD              = 8;    // top + bottom padding
const LYRICS_H         = 40;
const RESIZE_HANDLE_PX = 8;
const MIN_NOTE_W_PX    = 6;

// ── Colors ────────────────────────────────────────────────────────
const BG           = "#0b1225";
const ROW_LINE     = "rgba(255,255,255,0.07)";
const BEAT_LINE    = "rgba(255,255,255,0.06)";
const BAR_LINE     = "rgba(255,255,255,0.14)";
const NOTE_CYAN    = "#00cfff";
const NOTE_ORANGE  = "#ff8c00";
const NOTE_PINK    = "#ff6ec7";
const LYRIC_DIM    = "rgba(255,255,255,0.65)";
const LYRIC_ACT    = "#00cfff";
const PLAYHEAD_C   = "rgba(255,255,255,0.90)";

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// ── Shared props subset (compatible with TrackLaneProps) ──────────
export interface VocalsLaneProps {
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
  onResizeNote?: (id: string, newLength: number) => void;
  onSeekToTick?: (tick: number) => void;
  lyrics?: LyricEvent[];
  sections?: { id: string; tick: number; name: string; type: string }[];
  waveform?: WaveformData;
  vizMode?: "waveform" | "spectrogram" | "none";
  spectrogram?: SpectrogramData;
  ghostNotes?: Note[];
}

// ── Helpers ───────────────────────────────────────────────────────
function visibleTicks(zoom: number, resolution: number, renderDistance: number): number {
  return ((resolution * 960) / zoom) * renderDistance;
}

function calcRowH(canvasH: number): number {
  const available = canvasH - LYRICS_H - PAD - PERC_DIVIDER_H;
  return Math.max(6, Math.floor(available / TOTAL_ROWS));
}

function pitchedZoneTop(): number {
  return PAD / 2;
}

/** y coordinate of top edge of a given pitch row */
function rowTop(pitch: number, rH: number): number {
  if (pitch === 96 || pitch === 97) {
    // Percussion rows below the divider
    const percStart = pitchedZoneTop() + PITCHED_ROWS * rH + PERC_DIVIDER_H;
    const percRow   = pitch === 96 ? 0 : 1;
    return percStart + percRow * rH;
  }
  // Pitched: pitch 83 = top row (row 0), pitch 36 = bottom row (row 47)
  const row = PITCHED_MAX - Math.max(PITCHED_MIN, Math.min(PITCHED_MAX, pitch));
  return pitchedZoneTop() + row * rH;
}

/** Convert canvas y to MIDI pitch */
function yToPitch(y: number, rH: number): number {
  const percStart = pitchedZoneTop() + PITCHED_ROWS * rH + PERC_DIVIDER_H;
  if (y >= percStart) {
    const percRow = Math.floor((y - percStart) / rH);
    return percRow === 0 ? 96 : 97;
  }
  const row = Math.floor((y - pitchedZoneTop()) / rH);
  return Math.max(PITCHED_MIN, Math.min(PITCHED_MAX, PITCHED_MAX - row));
}

function pitchAreaH(rH: number): number {
  return pitchedZoneTop() + PITCHED_ROWS * rH + PERC_DIVIDER_H + PERC_ROWS * rH;
}

// ── Hit test ──────────────────────────────────────────────────────
function hitTest(
  mx: number, my: number,
  notes: Note[],
  pxPerTick: number,
  currentTick: number,
  playheadX: number,
  rH: number,
): { note: Note; mode: "move" | "resize" } | null {
  for (let i = notes.length - 1; i >= 0; i--) {
    const n  = notes[i];
    const nx = playheadX + (n.tick - currentTick) * pxPerTick;
    const nw = Math.max(MIN_NOTE_W_PX, n.length * pxPerTick);
    const ny = rowTop(n.fret, rH);
    if (mx >= nx && mx <= nx + nw && my >= ny && my <= ny + rH) {
      return { note: n, mode: mx >= nx + nw - RESIZE_HANDLE_PX ? "resize" : "move" };
    }
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────
export const VocalsLane = memo(function VocalsLane({
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
  onResizeNote,
  onSeekToTick,
  lyrics,
  sections = [],
  waveform,
  vizMode = "waveform",
  spectrogram,
  ghostNotes,
}: VocalsLaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const dragRef      = useRef({
    active: false,
    mode: "move" as "move" | "resize",
    noteId: "",
    startX: 0,
    startPitch: 0,
    originalLength: 0,
    lastDeltaTick: 0,
  });


  const propsRef = useRef({
    chart, trackKey, currentTick, isPlaying, currentTickRef,
    zoom, renderDistance, snapDivision,
    selectedNoteIds, onSelectNotes, onAddNote, onDeleteNotes, onMoveNotes,
    onResizeNote, onSeekToTick, lyrics, sections, waveform, vizMode, spectrogram, ghostNotes,
  });
  propsRef.current = {
    chart, trackKey, currentTick, isPlaying, currentTickRef,
    zoom, renderDistance, snapDivision,
    selectedNoteIds, onSelectNotes, onAddNote, onDeleteNotes, onMoveNotes,
    onResizeNote, onSeekToTick, lyrics, sections, waveform, vizMode, spectrogram, ghostNotes,
  };

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

  // ── Canvas render ───────────────────────────────────────────────
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width < 10) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const {
      chart, trackKey, currentTickRef: ctRef, currentTick: propTick,
      zoom, renderDistance,
      selectedNoteIds, lyrics, sections, waveform, vizMode, spectrogram, ghostNotes,
    } = propsRef.current;
    const currentTick = ctRef?.current ?? propTick;

    const track      = chart.tracks[trackKey];
    const resolution = chart.metadata.resolution || 192;
    const vt         = visibleTicks(zoom, resolution, renderDistance);
    const W          = canvas.width;
    const H          = canvas.height;
    const rH         = calcRowH(H);
    const playheadX  = W * PLAYHEAD_X_RATIO;
    const pxPerTick  = (W - PIANO_LABEL_W) / vt;
    const noteAreaLeft = PIANO_LABEL_W;

    // Notes are drawn starting from noteAreaLeft; tickToX accounts for that
    function tickToX(tick: number): number {
      return noteAreaLeft + playheadX + (tick - currentTick) * pxPerTick;
    }

    const pH = pitchAreaH(rH);

    // ── 1. Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // ── 2. Pitch row backgrounds (pitched zone)
    for (let row = 0; row < PITCHED_ROWS; row++) {
      const pitch = PITCHED_MAX - row;
      const y     = pitchedZoneTop() + row * rH;
      const isC   = pitch % 12 === 0;
      if (isC) {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
      } else if (row % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.00)";
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.02)";
      }
      ctx.fillRect(PIANO_LABEL_W, y, W - PIANO_LABEL_W, rH);
    }

    // Percussion divider
    const percDivY = pitchedZoneTop() + PITCHED_ROWS * rH;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, percDivY, W, PERC_DIVIDER_H);
    ctx.fillStyle = "rgba(255,140,0,0.5)";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PERC", PIANO_LABEL_W / 2, percDivY + PERC_DIVIDER_H / 2);

    // Percussion rows
    const percStart = percDivY + PERC_DIVIDER_H;
    ctx.fillStyle = "rgba(255,140,0,0.06)";
    ctx.fillRect(PIANO_LABEL_W, percStart, W - PIANO_LABEL_W, rH);
    ctx.fillStyle = "rgba(255,110,199,0.06)";
    ctx.fillRect(PIANO_LABEL_W, percStart + rH, W - PIANO_LABEL_W, rH);

    // ── 3. Audio overlay (waveform or spectrogram) — drawn per-column before grid lines
    if (vizMode === "spectrogram" && spectrogram && spectrogram.numBuckets > 0) {
      // Use ImageData for efficient per-pixel spectrogram rendering
      const imgData = ctx.createImageData(W, Math.ceil(pH));
      const px = imgData.data;
      for (let x = Math.max(0, noteAreaLeft); x < W; x++) {
        const tick = currentTick + (x - noteAreaLeft - playheadX) / pxPerTick;
        const [r, g, b] = getSpectrogramRgb(spectrogram, tick);
        const energy = (r + g + b) / (3 * 255);
        if (energy < 0.015) continue;
        const a = Math.round((0.08 + energy * 0.28) * 255);
        for (let y = 0; y < pH; y++) {
          const i = (y * W + x) << 2;
          px[i] = r;
          px[i + 1] = g;
          px[i + 2] = b;
          px[i + 3] = a;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (vizMode === "waveform" && waveform && waveform.peaks.length > 0) {
      const step = Math.max(1, Math.round(1 / pxPerTick));
      for (let x = noteAreaLeft; x < W; x += step) {
        const tick = currentTick + (x - noteAreaLeft - playheadX) / pxPerTick;
        const peak = getWaveformPeak(waveform, tick);
        if (peak < 0.01) continue;
        const alpha = 0.06 + peak * 0.22;
        ctx.fillStyle = `rgba(0,207,255,${alpha.toFixed(2)})`;
        ctx.fillRect(x, 0, step, pH);
      }
    }

    // ── 3. Horizontal row dividers
    ctx.strokeStyle = ROW_LINE;
    ctx.lineWidth   = 0.5;
    for (let row = 0; row <= PITCHED_ROWS; row++) {
      const y = pitchedZoneTop() + row * rH;
      ctx.beginPath(); ctx.moveTo(PIANO_LABEL_W, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let row = 0; row <= PERC_ROWS; row++) {
      const y = percStart + row * rH;
      ctx.beginPath(); ctx.moveTo(PIANO_LABEL_W, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── 4. Piano label gutter
    ctx.fillStyle = "rgba(10,14,30,0.9)";
    ctx.fillRect(0, 0, PIANO_LABEL_W, pH);

    // Gutter divider line
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(PIANO_LABEL_W, 0); ctx.lineTo(PIANO_LABEL_W, pH); ctx.stroke();

    // Note labels
    ctx.font = "9px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let row = 0; row < PITCHED_ROWS; row++) {
      const pitch   = PITCHED_MAX - row;
      const noteName = NOTE_NAMES[pitch % 12];
      const isC     = pitch % 12 === 0;
      // Show label on every C, and every 4th note if row height allows
      if (isC || (rH >= 8 && row % 4 === 0)) {
        ctx.fillStyle = isC ? "rgba(0,207,255,0.9)" : "rgba(255,255,255,0.45)";
        const y = pitchedZoneTop() + row * rH + rH / 2;
        ctx.fillText(noteName, PIANO_LABEL_W - 4, y);
      }
    }
    // Percussion labels
    ctx.fillStyle = "rgba(255,140,0,0.8)";
    ctx.fillText("96", PIANO_LABEL_W - 4, percStart + rH / 2);
    ctx.fillStyle = "rgba(255,110,199,0.8)";
    ctx.fillText("97", PIANO_LABEL_W - 4, percStart + rH + rH / 2);

    // ── 5. Vertical beat / bar grid
    const beatsPerBar = chart.syncTrack.timeSignatures[0]?.numerator ?? 4;
    const beatTicks   = resolution;
    const barTicks    = resolution * beatsPerBar;

    const leftTick  = currentTick - (playheadX) / pxPerTick;
    const rightTick = currentTick + (W - PIANO_LABEL_W - playheadX) / pxPerTick;
    const firstBeat = Math.floor(leftTick / beatTicks) * beatTicks;

    for (let t = firstBeat; t <= rightTick + beatTicks; t += beatTicks) {
      const x = tickToX(t);
      if (x < PIANO_LABEL_W || x > W) continue;
      const isBar = t % barTicks === 0;
      ctx.strokeStyle = isBar ? BAR_LINE : BEAT_LINE;
      ctx.lineWidth   = isBar ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, pH);
      ctx.stroke();
    }

    // ── 6. Section markers
    for (const section of sections) {
      const x = tickToX(section.tick);
      if (x < PIANO_LABEL_W || x > W) continue;
      const color = section.type === "solo"
        ? "rgba(245,158,11,0.7)"
        : "rgba(168,85,247,0.7)";
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, pH); ctx.stroke();
      ctx.font      = "bold 9px sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(section.name, x + 3, 2);
    }

    // ── 6b. Ghost notes (transparent overlay from another difficulty)
    if (ghostNotes && ghostNotes.length > 0) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      for (const gn of ghostNotes) {
        const gx = tickToX(gn.tick);
        const gw = Math.max(MIN_NOTE_W_PX, gn.length * pxPerTick);
        if (gx + gw < PIANO_LABEL_W || gx > W) continue;
        const gy = rowTop(gn.fret, rH);
        const gh = rH - 2;
        ctx.fillStyle = "#888";
        ctx.beginPath();
        ctx.roundRect(gx, gy + 1, gw, gh, 3);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── 7. Notes
    if (track) {
      for (const note of track.notes) {
        const nx  = tickToX(note.tick);
        const nw  = Math.max(MIN_NOTE_W_PX, note.length * pxPerTick);
        if (nx + nw < PIANO_LABEL_W || nx > W) continue;

        const ny         = rowTop(note.fret, rH);
        const nh         = rH - 2;
        const isSelected = selectedNoteIds.has(note.id);

        let color: string;
        if (note.fret === 97) color = NOTE_PINK;
        else if (note.fret === 96) color = NOTE_ORANGE;
        else color = NOTE_CYAN;

        const drawColor = isSelected ? "#ffffff" : color;

        ctx.save();
        ctx.shadowColor = drawColor;
        ctx.shadowBlur  = isSelected ? 18 : 10;

        ctx.fillStyle   = drawColor;
        ctx.globalAlpha = isSelected ? 1 : 0.85;
        ctx.beginPath();
        ctx.roundRect(nx, ny + 1, nw, nh, 3);
        ctx.fill();

        // Inner highlight gradient
        ctx.globalAlpha = 1;
        const grad = ctx.createLinearGradient(nx, ny + 1, nx, ny + 1 + nh);
        grad.addColorStop(0,   "rgba(255,255,255,0.35)");
        grad.addColorStop(0.5, "rgba(255,255,255,0.05)");
        grad.addColorStop(1,   "rgba(0,0,0,0.10)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(nx, ny + 1, nw, nh, 3);
        ctx.fill();

        ctx.restore();
      }
    }

    // ── 8. Playhead line
    const phX = noteAreaLeft + playheadX;
    ctx.save();
    ctx.strokeStyle  = PLAYHEAD_C;
    ctx.lineWidth    = 2;
    ctx.shadowColor  = "rgba(255,255,255,0.7)";
    ctx.shadowBlur   = 14;
    ctx.beginPath(); ctx.moveTo(phX, 0); ctx.lineTo(phX, pH); ctx.stroke();
    ctx.restore();

    // Playhead arrow marker
    const arrowCy = pitchedZoneTop() + (PITCHED_ROWS * rH) / 2;
    ctx.save();
    ctx.fillStyle   = PLAYHEAD_C;
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.moveTo(phX - 8, arrowCy - 6);
    ctx.lineTo(phX + 4, arrowCy);
    ctx.lineTo(phX - 8, arrowCy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ── 9. Lyrics strip
    const lyricsTop = pH;
    ctx.fillStyle = "rgba(5,8,20,0.85)";
    ctx.fillRect(0, lyricsTop, W, LYRICS_H);

    ctx.strokeStyle = "rgba(0,207,255,0.20)";
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(0, lyricsTop); ctx.lineTo(W, lyricsTop); ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(phX, lyricsTop); ctx.lineTo(phX, lyricsTop + LYRICS_H); ctx.stroke();
    ctx.setLineDash([]);

    if (lyrics && lyrics.length > 0) {
      const activeLyricIdx = getActiveLyricIndex(lyrics, currentTick);
      ctx.font = "bold 16px sans-serif";
      ctx.textBaseline = "middle";
      const textY = lyricsTop + LYRICS_H / 2;

      for (let i = 0; i < lyrics.length; i++) {
        const lyric = lyrics[i];
        if (lyric.tick === null) continue;
        const x = tickToX(lyric.tick);
        if (x < -120 || x > W + 20) continue;

        const isActive = i === activeLyricIdx;
        ctx.save();
        ctx.textAlign = "left";
        if (isActive) {
          ctx.fillStyle   = LYRIC_ACT;
          ctx.shadowColor = LYRIC_ACT;
          ctx.shadowBlur  = 12;
          ctx.font = "bold 18px sans-serif";
        } else {
          const pastFade = x < phX
            ? Math.max(0.25, 1 - (phX - x) / (W * 0.3))
            : 1;
          ctx.fillStyle   = LYRIC_DIM;
          ctx.globalAlpha = pastFade;
        }
        ctx.fillText(lyric.text, x, textY);
        ctx.restore();
      }
    }

  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Static re-render: fires when any non-tick prop changes
  useEffect(() => {
    renderCanvas();
  }, [
    chart, trackKey, zoom, renderDistance,
    selectedNoteIds, lyrics, sections, isPlaying,
    waveform, vizMode, spectrogram, renderCanvas,
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

  // ── Pointer helpers ─────────────────────────────────────────────
  function getLayout(canvas: HTMLCanvasElement) {
    const W          = canvas.width;
    const H          = canvas.height;
    const resolution = propsRef.current.chart.metadata.resolution || 192;
    const vt         = visibleTicks(
      propsRef.current.zoom,
      resolution,
      propsRef.current.renderDistance,
    );
    const rH        = calcRowH(H);
    const pxPerTick = (W - PIANO_LABEL_W) / vt;
    const playheadX = W * PLAYHEAD_X_RATIO;
    return { W, H, resolution, vt, pxPerTick, playheadX, rH };
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const { pxPerTick, playheadX, rH } = getLayout(canvas);
    const noteAreaLeft = PIANO_LABEL_W;
    const drag = dragRef.current;

    if (drag.active) {
      const deltaTick = Math.round((mx - drag.startX) / pxPerTick);
      if (drag.mode === "resize") {
        const newLen = Math.max(0, drag.originalLength + deltaTick);
        propsRef.current.onResizeNote?.(drag.noteId, newLen);
      } else {
        const newPitch  = yToPitch(my, rH);
        const df        = newPitch - drag.startPitch;
        const dd        = deltaTick - drag.lastDeltaTick;
        if (dd !== 0 || df !== 0) {
          propsRef.current.onMoveNotes([drag.noteId], dd, df);
          drag.lastDeltaTick = deltaTick;
          drag.startPitch    = newPitch;
        }
      }
      return;
    }

    if (mx < noteAreaLeft) { if (canvasRef.current) canvasRef.current.style.cursor = "default"; return; }

    const { chart, trackKey } = propsRef.current;
    const { currentTick }     = propsRef.current;
    const track = chart.tracks[trackKey];
    const adjMx = mx - noteAreaLeft;
    const adjPlayheadX = playheadX;
    if (track) {
      const hit = hitTest(adjMx + noteAreaLeft, my, track.notes, pxPerTick, currentTick, adjPlayheadX + noteAreaLeft, rH);
      if (hit) { if (canvasRef.current) canvasRef.current.style.cursor = hit.mode === "resize" ? "ew-resize" : "grab"; return; }
    }
    if (canvasRef.current) canvasRef.current.style.cursor = "crosshair";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const { resolution, pxPerTick, playheadX, rH } = getLayout(canvas);
    const noteAreaLeft = PIANO_LABEL_W;

    if (mx < noteAreaLeft) return; // click in gutter — ignore

    const { chart, trackKey, currentTick, snapDivision,
            onAddNote, onDeleteNotes, onSelectNotes } = propsRef.current;
    const track = chart.tracks[trackKey];
    const phX   = noteAreaLeft + playheadX;
    const hit   = hitTest(mx, my, track?.notes ?? [], pxPerTick, currentTick, phX, rH);

    if (e.button === 2) {
      if (hit) { onDeleteNotes([hit.note.id]); onSelectNotes([]); }
      return;
    }

    if (hit) {
      onSelectNotes([hit.note.id]);
      dragRef.current = {
        active: true,
        mode: hit.mode,
        noteId: hit.note.id,
        startX: mx,
        startPitch: hit.note.fret,
        originalLength: hit.note.length,
        lastDeltaTick: 0,
      };
      if (canvasRef.current) canvasRef.current.style.cursor = hit.mode === "resize" ? "ew-resize" : "grabbing";
      return;
    }

    const pH = pitchAreaH(rH);
    if (my >= 0 && my <= pH) {
      const rawTick     = currentTick + (mx - phX) / pxPerTick;
      const gridTicks   = snapDivisionToTicks(resolution, snapDivision);
      const snappedTick = Math.max(0, snapToGrid(rawTick, gridTicks));
      const pitch       = yToPitch(my, rH);
      onAddNote(snappedTick, pitch);
      onSelectNotes([]);
    } else {
      const tick = Math.max(0, currentTick + (mx - phX) / pxPerTick);
      propsRef.current.onSeekToTick?.(tick);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseUp = useCallback(() => {
    dragRef.current.active = false;
    if (canvasRef.current) canvasRef.current.style.cursor = "crosshair";
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
});
