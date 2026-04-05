"use client";

import { memo, useRef, useEffect, useCallback } from "react";
import type { ChartData, TrackKey } from "@/lib/chart/types";
import type { TempoPoint } from "@/lib/chart/tempo-utils";
import type { Section } from "@/lib/chart/types";

export interface GlobalViewProps {
  chart: ChartData;
  trackKey: TrackKey | null;
  totalTicks: number;
  currentTick: number;
  viewportTicks: number; // how many ticks are visible in the main lane
  tempoMap: TempoPoint[];
  sections: Section[];
  onSeek: (tick: number) => void;
  currentTickRef?: React.RefObject<number>;
  isPlaying?: boolean;
}

const BAR_HEIGHT = 48;
const DENSITY_BINS = 400; // horizontal resolution for density histogram

/** Build a density histogram: number of notes per bin across totalTicks. */
function buildDensityHistogram(
  notes: readonly { tick: number }[],
  totalTicks: number,
  bins: number,
): Float32Array {
  const hist = new Float32Array(bins);
  if (totalTicks <= 0 || notes.length === 0) return hist;
  const ticksPerBin = totalTicks / bins;
  for (const n of notes) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(n.tick / ticksPerBin)));
    hist[idx]++;
  }
  return hist;
}

export const GlobalView = memo(function GlobalView({
  chart,
  trackKey,
  totalTicks,
  currentTick,
  viewportTicks,
  tempoMap,
  sections,
  onSeek,
  currentTickRef,
  isPlaying,
}: GlobalViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Cache density histogram to avoid recomputing every frame
  const histCacheRef = useRef<{ trackKey: TrackKey | null; notesLen: number; totalTicks: number; bins: number; hist: Float32Array; maxVal: number } | null>(null);

  const propsRef = useRef({
    chart, trackKey, totalTicks, currentTick, viewportTicks,
    tempoMap, sections, onSeek, currentTickRef, isPlaying,
  });
  propsRef.current = {
    chart, trackKey, totalTicks, currentTick, viewportTicks,
    tempoMap, sections, onSeek, currentTickRef, isPlaying,
  };

  // Resize canvas to fill container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        const h = Math.round(e.contentRect.height);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Shared draw function used by both static and RAF paths
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const {
      chart: c, trackKey: tk, totalTicks: total, viewportTicks: vpTicks,
      tempoMap: tmap, sections: secs, currentTickRef: ctRef, currentTick: propTick,
    } = propsRef.current;

    const tick = ctRef?.current ?? propTick;
    const W = canvas.width;
    const H = canvas.height;
    if (W === 0 || H === 0 || total <= 0) return;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#0c0c12";
    ctx.fillRect(0, 0, W, H);

    const tickToX = (t: number) => (t / total) * W;

    // ── 1. BPM regions (colored bands) ──
    if (tmap.length > 0) {
      let minBpm = Infinity, maxBpm = -Infinity;
      for (const p of tmap) { if (p.bpm < minBpm) minBpm = p.bpm; if (p.bpm > maxBpm) maxBpm = p.bpm; }
      const bpmRange = maxBpm - minBpm || 1;

      for (let i = 0; i < tmap.length; i++) {
        const x1 = tickToX(tmap[i].tick);
        const x2 = i + 1 < tmap.length ? tickToX(tmap[i + 1].tick) : W;
        const t = (tmap[i].bpm - minBpm) / bpmRange;
        const hue = 220 - t * 220;
        ctx.fillStyle = `hsla(${hue}, 60%, 30%, 0.25)`;
        ctx.fillRect(x1, 0, x2 - x1, H);
      }
    }

    // ── 2. Note density histogram (cached) ──
    if (tk) {
      const track = c.tracks[tk];
      if (track && track.notes.length > 0) {
        const bins = Math.min(DENSITY_BINS, W);
        const cache = histCacheRef.current;
        let hist: Float32Array;
        let maxVal: number;
        if (cache && cache.trackKey === tk && cache.notesLen === track.notes.length && cache.totalTicks === total && cache.bins === bins) {
          hist = cache.hist;
          maxVal = cache.maxVal;
        } else {
          hist = buildDensityHistogram(track.notes, total, bins);
          maxVal = 1;
          for (let i = 0; i < hist.length; i++) { if (hist[i] > maxVal) maxVal = hist[i]; }
          histCacheRef.current = { trackKey: tk, notesLen: track.notes.length, totalTicks: total, bins, hist, maxVal };
        }
        const binW = W / bins;
        const histH = H * 0.6;

        for (let i = 0; i < bins; i++) {
          if (hist[i] === 0) continue;
          const barH = (hist[i] / maxVal) * histH;
          const intensity = hist[i] / maxVal;
          const hue = (1 - intensity) * 120;
          ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.5)`;
          ctx.fillRect(i * binW, H - barH, binW + 0.5, barH);
        }
      }
    }

    // ── 3. Section markers ──
    ctx.font = "9px ui-monospace, monospace";
    ctx.textBaseline = "top";
    for (const sec of secs) {
      const x = tickToX(sec.tick);
      ctx.strokeStyle = "rgba(168,130,255,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.fillStyle = "rgba(168,130,255,0.85)";
      const label = sec.name.length > 12 ? sec.name.slice(0, 11) + "\u2026" : sec.name;
      ctx.fillText(label, x + 2, 2);
    }

    // ── 4. Viewport indicator ──
    const vpX1 = tickToX(tick);
    const vpX2 = tickToX(tick + vpTicks);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(vpX1, 0, vpX2 - vpX1, H);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(vpX1, 0);
    ctx.lineTo(vpX1, H);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vpX2, 0);
    ctx.lineTo(vpX2, H);
    ctx.stroke();

    // ── 5. Playhead ──
    const px = tickToX(tick);
    ctx.strokeStyle = "#ff4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
    ctx.stroke();

    // ── 6. Bottom border ──
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 0.5);
    ctx.lineTo(W, H - 0.5);
    ctx.stroke();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Static re-render: when non-tick props change
  useEffect(() => {
    renderCanvas();
  }, [chart, trackKey, totalTicks, viewportTicks, tempoMap, sections, currentTick, renderCanvas]);

  // Playback RAF: smooth 60fps updates only when playing
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const loop = () => {
      renderCanvas();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, renderCanvas]);

  // Click to seek
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = x / canvas.width;
    const tick = Math.max(0, Math.round(fraction * propsRef.current.totalTicks));
    propsRef.current.onSeek(tick);
  }, []);

  // Drag to scrub
  const dragging = useRef(false);
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    dragging.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    // Also seek on initial click
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const tick = Math.max(0, Math.round((x / canvas.width) * propsRef.current.totalTicks));
    propsRef.current.onSeek(tick);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const tick = Math.max(0, Math.round((x / canvas.width) * propsRef.current.totalTicks));
    propsRef.current.onSeek(tick);
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full bg-[#0c0c12] border-b border-border/50"
      style={{ height: BAR_HEIGHT }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
});
