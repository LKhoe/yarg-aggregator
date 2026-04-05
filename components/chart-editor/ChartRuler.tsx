"use client";

import React, { memo, useRef, useEffect, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Section } from "@/lib/chart/types";

export interface ChartRulerProps {
  bpmEvents: { tick: number; bpm: number }[];
  timeSignatures: { tick: number; numerator: number; denominator: number }[];
  sections: Section[];
  currentTick: number;
  zoom: number;
  resolution: number;
  renderDistance: number;
  onAddBpm: (tick: number, bpm: number) => void;
  onDeleteBpm: (tick: number) => void;
  onAddTimeSignature: (tick: number, numerator: number, denominator: number) => void;
  onDeleteTimeSignature: (tick: number) => void;
  onAddSection: (id: string, tick: number, name: string) => void;
  onDeleteSection: (id: string) => void;
  onSeek: (tick: number) => void;
  currentTickRef?: React.MutableRefObject<number>;
  isPlaying?: boolean;
}

interface Popover {
  x: number;
  tick: number;
  kind: "bpm" | "section" | "ts";
}

const RULER_HEIGHT = 36;
const MARKER_HIT_PX = 8;

function tickToX(tick: number, currentTick: number, visibleTicks: number, W: number): number {
  return ((tick - currentTick) / visibleTicks) * W;
}

function xToTick(x: number, currentTick: number, visibleTicks: number, W: number): number {
  return currentTick + (x / W) * visibleTicks;
}

export const ChartRuler = memo(function ChartRuler({
  bpmEvents,
  timeSignatures,
  sections,
  currentTick,
  zoom,
  resolution,
  renderDistance,
  onAddBpm,
  onDeleteBpm,
  onAddSection,
  onDeleteSection,
  onSeek,
  currentTickRef,
  isPlaying,
}: ChartRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute visible ticks (same formula as TrackLane) — used by interaction callbacks
  const visibleTicks = ((resolution * 960) / zoom) * renderDistance;

  // Stable ref so renderCanvas can always read current props
  const propsRef = useRef({ bpmEvents, timeSignatures, sections, currentTick, currentTickRef, zoom, resolution, renderDistance });
  propsRef.current = { bpmEvents, timeSignatures, sections, currentTick, currentTickRef, zoom, resolution, renderDistance };

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width < 10) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { bpmEvents, timeSignatures, sections, currentTickRef: ctRef, currentTick: propTick, zoom, resolution, renderDistance } = propsRef.current;
    const currentTick = ctRef?.current ?? propTick;
    const visibleTicks = ((resolution * 960) / zoom) * renderDistance;

    const W = canvas.width;
    const H = canvas.height;

    // Background
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, W, H);

    // Bottom border
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 0.5);
    ctx.lineTo(W, H - 0.5);
    ctx.stroke();

    // Beat grid lines (thin) — batch strokes
    const beatTicks = resolution;
    const firstBeat = Math.ceil(currentTick / beatTicks) * beatTicks;
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let tick = firstBeat; tick <= currentTick + visibleTicks; tick += beatTicks) {
      const x = tickToX(tick, currentTick, visibleTicks, W);
      if (x < 0 || x > W) continue;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    ctx.stroke();

    // Beat number labels
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.font = "9px monospace";
    for (let tick = firstBeat; tick <= currentTick + visibleTicks; tick += beatTicks) {
      const x = tickToX(tick, currentTick, visibleTicks, W);
      if (x < 0 || x > W) continue;
      ctx.fillText(String(Math.round(tick / resolution) + 1), x + 2, H - 4);
    }

    // BPM events — batch dashed lines, then labels
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (const ev of bpmEvents) {
      const x = tickToX(ev.tick, currentTick, visibleTicks, W);
      if (x < -20 || x > W + 20) continue;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H - 10);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#60a5fa";
    ctx.font = "bold 9px monospace";
    for (const ev of bpmEvents) {
      const x = tickToX(ev.tick, currentTick, visibleTicks, W);
      if (x < -20 || x > W + 20) continue;
      ctx.fillText(`${Math.round(ev.bpm)}`, x + 2, 10);
    }

    // Time signatures
    ctx.fillStyle = "#a78bfa";
    ctx.font = "9px sans-serif";
    for (const ts of timeSignatures) {
      const x = tickToX(ts.tick, currentTick, visibleTicks, W);
      if (x < -40 || x > W + 40) continue;
      ctx.fillText(`${ts.numerator}/${ts.denominator}`, x + 2, H - 14);
    }

    // Section markers — batch vertical lines by type, then draw labels
    ctx.font = "bold 9px sans-serif";
    ctx.lineWidth = 2;
    for (const section of sections) {
      const x = tickToX(section.tick, currentTick, visibleTicks, W);
      if (x < -100 || x > W + 100) continue;

      ctx.strokeStyle = section.type === "solo" ? "#f59e0b" : "#a855f7";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();

      const label = section.name;
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = section.type === "solo" ? "rgba(245,158,11,0.25)" : "rgba(168,85,247,0.25)";
      ctx.fillRect(x + 2, 2, textW + 4, 12);

      ctx.fillStyle = section.type === "solo" ? "#fcd34d" : "#d8b4fe";
      ctx.fillText(label, x + 4, 11);
    }

    // Playhead (current tick position = x=0 in linear space)
    const playheadX = tickToX(currentTick, currentTick, visibleTicks, W);
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, H);
    ctx.stroke();

    // Small triangle indicator at top
    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.moveTo(playheadX - 5, 0);
    ctx.lineTo(playheadX + 5, 0);
    ctx.lineTo(playheadX, 7);
    ctx.closePath();
    ctx.fill();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Static re-render: fires when any non-tick prop changes
  useEffect(() => {
    renderCanvas();
  }, [bpmEvents, timeSignatures, sections, zoom, resolution, renderDistance, renderCanvas]);

  // Playback RAF: smooth 60fps updates driven by currentTickRef
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

  // Canvas resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        canvas.width = e.contentRect.width;
        canvas.height = RULER_HEIGHT;
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Focus input when popover opens
  useEffect(() => {
    if (popover) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [popover]);

  const findNearbyBpm = useCallback(
    (x: number, W: number): { tick: number; bpm: number } | null => {
      for (const ev of bpmEvents) {
        const ex = tickToX(ev.tick, currentTick, visibleTicks, W);
        if (Math.abs(ex - x) <= MARKER_HIT_PX) return ev;
      }
      return null;
    },
    [bpmEvents, currentTick, visibleTicks]
  );

  const findNearbySection = useCallback(
    (x: number, W: number): Section | null => {
      for (const s of sections) {
        const sx = tickToX(s.tick, currentTick, visibleTicks, W);
        if (Math.abs(sx - x) <= MARKER_HIT_PX) return s;
      }
      return null;
    },
    [sections, currentTick, visibleTicks]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const W = canvas.width;

      const tick = xToTick(cx, currentTick, visibleTicks, W);

      if (e.button === 2) {
        // Right-click: check for nearby BPM, else open BPM popover
        const nearBpm = findNearbyBpm(cx, W);
        if (nearBpm) {
          onDeleteBpm(nearBpm.tick);
          return;
        }
        const nearSection = findNearbySection(cx, W);
        if (nearSection) {
          onDeleteSection(nearSection.id);
          return;
        }
        setPopover({ x: cx, tick, kind: "bpm" });
        setInputValue("120");
        return;
      }

      if (e.button === 0) {
        // Left-click: check for nearby section (seek), else open section popover
        const nearSection = findNearbySection(cx, W);
        if (nearSection) {
          onSeek(nearSection.tick);
          return;
        }
        const nearBpm = findNearbyBpm(cx, W);
        if (nearBpm) {
          onSeek(nearBpm.tick);
          return;
        }
        // Open section name input
        setPopover({ x: cx, tick, kind: "section" });
        setInputValue("");
      }
    },
    [currentTick, visibleTicks, findNearbyBpm, findNearbySection, onDeleteBpm, onDeleteSection, onSeek]
  );

  const handlePopoverSubmit = useCallback(() => {
    if (!popover) return;
    const val = inputValue.trim();
    if (!val) {
      setPopover(null);
      return;
    }
    if (popover.kind === "bpm") {
      const bpm = parseFloat(val);
      if (!isNaN(bpm) && bpm > 0) {
        onAddBpm(Math.round(popover.tick), bpm);
      }
    } else if (popover.kind === "section") {
      onAddSection(uuidv4(), Math.round(popover.tick), val);
    }
    setPopover(null);
    setInputValue("");
  }, [popover, inputValue, onAddBpm, onAddSection]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handlePopoverSubmit();
      } else if (e.key === "Escape") {
        setPopover(null);
        setInputValue("");
      }
    },
    [handlePopoverSubmit]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full shrink-0"
      style={{ height: RULER_HEIGHT }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Inline popover */}
      {popover && (
        <div
          className="absolute z-50 bg-background border rounded shadow-lg p-2 flex flex-col gap-1.5"
          style={{
            left: Math.min(popover.x, (canvasRef.current?.width ?? 300) - 160),
            top: RULER_HEIGHT + 2,
            minWidth: 150,
          }}
        >
          <span className="text-xs text-muted-foreground font-medium">
            {popover.kind === "bpm" ? "Add BPM at tick " : "Add Section at tick "}
            {Math.round(popover.tick)}
          </span>
          <input
            ref={inputRef}
            type={popover.kind === "bpm" ? "number" : "text"}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={popover.kind === "bpm" ? "BPM value" : "Section name"}
            className="h-6 text-xs px-2 rounded border bg-background outline-none focus:ring-1 ring-primary"
            min={popover.kind === "bpm" ? 1 : undefined}
            step={popover.kind === "bpm" ? 0.1 : undefined}
          />
          <div className="flex gap-1">
            <button
              className="flex-1 text-xs py-0.5 px-2 rounded bg-primary text-primary-foreground hover:opacity-90"
              onClick={handlePopoverSubmit}
            >
              Add
            </button>
            <button
              className="flex-1 text-xs py-0.5 px-2 rounded border hover:bg-muted"
              onClick={() => setPopover(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Dismiss popover on outside click */}
      {popover && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setPopover(null)}
        />
      )}
    </div>
  );
});
