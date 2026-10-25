"use client";

import React, { memo, useRef, useEffect, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Section } from "@/lib/chart/types";
import { formatPosition, snapDivisionToTicks, snapToGrid, type TempoPoint } from "@/lib/chart/tempo-utils";

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
  onRenameSection: (id: string, name: string) => void;
  onMoveBpm: (from: number, to: number) => void;
  onMoveTimeSignature: (from: number, to: number) => void;
  onMoveSection: (id: string, tick: number) => void;
  snapDivision: number;
  tempoMap: TempoPoint[];
  onSeek: (tick: number) => void;
  currentTickRef?: React.MutableRefObject<number>;
  isPlaying?: boolean;
}

type MarkerKind = "bpm" | "section" | "ts";

interface Marker {
  kind: MarkerKind;
  tick: number;
  id?: string; // sections only
}

interface Popover {
  mode: "add" | "edit";
  kind: MarkerKind;
  x: number;
  tick: number;
  id?: string;
}

const RULER_HEIGHT = 36;
const MARKER_HIT_PX = 8;
// Time signature labels sit in the bottom strip of the ruler
const TS_STRIP_PX = 22;
const DRAG_THRESHOLD_PX = 3;
const DENOMINATORS = [1, 2, 4, 8, 16, 32];
const MAX_SECTION_NAME = 100;
const KIND_LABEL: Record<MarkerKind, string> = { bpm: "BPM", ts: "time signature", section: "section" };

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
  onAddTimeSignature,
  onDeleteTimeSignature,
  onAddSection,
  onDeleteSection,
  onRenameSection,
  onMoveBpm,
  onMoveTimeSignature,
  onMoveSection,
  snapDivision,
  tempoMap,
  onSeek,
  currentTickRef,
  isPlaying,
}: ChartRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [tsNumerator, setTsNumerator] = useState("4");
  const [tsDenominator, setTsDenominator] = useState("4");
  const inputRef = useRef<HTMLInputElement>(null);

  // Marker drag: preview tick while dragging, committed on pointerup
  const dragRef = useRef<{ marker: Marker; startX: number; moved: boolean; tick: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ kind: MarkerKind; tick: number } | null>(null);

  // Compute visible ticks (same formula as TrackLane) — used by interaction callbacks
  const visibleTicks = ((resolution * 960) / zoom) * renderDistance;

  // Stable ref so renderCanvas can always read current props
  const propsRef = useRef({ bpmEvents, timeSignatures, sections, currentTick, currentTickRef, zoom, resolution, renderDistance, dragPreview });
  propsRef.current = { bpmEvents, timeSignatures, sections, currentTick, currentTickRef, zoom, resolution, renderDistance, dragPreview };

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width < 10) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { bpmEvents, timeSignatures, sections, currentTickRef: ctRef, currentTick: propTick, zoom, resolution, renderDistance, dragPreview } = propsRef.current;
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

    // Marker being dragged: where it will land
    if (dragPreview) {
      const x = tickToX(dragPreview.tick, currentTick, visibleTicks, W);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.setLineDash([]);
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

  // Static re-render: fires on prop changes, including seeks while paused
  useEffect(() => {
    renderCanvas();
  }, [bpmEvents, timeSignatures, sections, currentTick, zoom, resolution, renderDistance, dragPreview, renderCanvas]);

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


  const gridTicks = snapDivisionToTicks(resolution, snapDivision);

  // Snapped tick under an x position
  const tickAtX = useCallback(
    (x: number, W: number) => Math.max(0, snapToGrid(xToTick(x, currentTick, visibleTicks, W), gridTicks)),
    [currentTick, visibleTicks, gridTicks]
  );

  // Marker under a point. Labels overlap at the same tick (e.g. BPM and 4/4 at 0),
  // so the bottom strip prefers time signatures and the rest prefers sections, then BPM.
  const findMarkerAt = useCallback(
    (x: number, y: number, W: number, H: number): Marker | null => {
      const near = (tick: number) => Math.abs(tickToX(tick, currentTick, visibleTicks, W) - x) <= MARKER_HIT_PX;
      const section = sections.find((s) => near(s.tick));
      const bpm = bpmEvents.find((e) => near(e.tick));
      const ts = timeSignatures.find((e) => near(e.tick));
      const order: (Marker | null)[] = [
        section ? { kind: "section", tick: section.tick, id: section.id } : null,
        bpm ? { kind: "bpm", tick: bpm.tick } : null,
        ts ? { kind: "ts", tick: ts.tick } : null,
      ];
      if (y >= H - TS_STRIP_PX) order.unshift(order.pop() ?? null);
      return order.find((m) => m !== null) ?? null;
    },
    [sections, bpmEvents, timeSignatures, currentTick, visibleTicks]
  );

  const bpmAt = useCallback(
    (tick: number) => {
      let bpm = bpmEvents[0]?.bpm ?? 120;
      for (const e of bpmEvents) {
        if (e.tick <= tick) bpm = e.bpm;
        else break;
      }
      return bpm;
    },
    [bpmEvents]
  );

  const tsAt = useCallback(
    (tick: number) => {
      let ts = timeSignatures[0] ?? { tick: 0, numerator: 4, denominator: 4 };
      for (const e of timeSignatures) {
        if (e.tick <= tick) ts = e;
        else break;
      }
      return ts;
    },
    [timeSignatures]
  );

  // Open the popover, pre-filled with the marker's value (edit) or the value in effect there (add)
  const openPopover = useCallback(
    (next: Popover) => {
      if (next.kind === "bpm") {
        setInputValue(String(Math.round(bpmAt(next.tick) * 1000) / 1000));
      } else if (next.kind === "ts") {
        const ts = tsAt(next.tick);
        setTsNumerator(String(ts.numerator));
        setTsDenominator(String(ts.denominator));
      } else {
        setInputValue(next.mode === "edit" ? sections.find((s) => s.id === next.id)?.name ?? "" : "");
      }
      setPopover(next);
    },
    [bpmAt, tsAt, sections]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (e.button !== 0 && e.button !== 2) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const W = canvas.width;
      const marker = findMarkerAt(x, y, W, canvas.height);

      if (e.button === 2) {
        // Right-click: edit/delete a marker, or add a BPM / time signature
        if (marker) openPopover({ mode: "edit", kind: marker.kind, x, tick: marker.tick, id: marker.id });
        else openPopover({ mode: "add", kind: "bpm", x, tick: tickAtX(x, W) });
        return;
      }

      if (marker) {
        // Left on a marker: drag it, or seek to it if the pointer doesn't move
        canvas.setPointerCapture(e.pointerId);
        dragRef.current = { marker, startX: x, moved: false, tick: marker.tick };
        return;
      }

      openPopover({ mode: "add", kind: "section", x, tick: tickAtX(x, W) });
    },
    [findMarkerAt, openPopover, tickAtX]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      const canvas = canvasRef.current;
      if (!drag || !canvas) return;
      const x = e.clientX - canvas.getBoundingClientRect().left;
      if (!drag.moved && Math.abs(x - drag.startX) < DRAG_THRESHOLD_PX) return;
      // The tempo map and the first time signature start at tick 0: those stay put
      if (drag.marker.kind !== "section" && drag.marker.tick === 0) return;
      drag.moved = true;
      const tick = tickAtX(x, canvas.width);
      drag.tick = drag.marker.kind === "section" ? tick : Math.max(gridTicks, tick);
      setDragPreview({ kind: drag.marker.kind, tick: drag.tick });
    },
    [tickAtX, gridTicks]
  );

  const handlePointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDragPreview(null);
    const { marker } = drag;
    if (!drag.moved) {
      onSeek(marker.tick);
      return;
    }
    if (drag.tick === marker.tick) return;
    if (marker.kind === "bpm") onMoveBpm(marker.tick, drag.tick);
    else if (marker.kind === "ts") onMoveTimeSignature(marker.tick, drag.tick);
    else if (marker.id) onMoveSection(marker.id, drag.tick);
  }, [onSeek, onMoveBpm, onMoveTimeSignature, onMoveSection]);

  const closePopover = useCallback(() => {
    setPopover(null);
    setInputValue("");
  }, []);

  const handlePopoverSubmit = useCallback(() => {
    if (!popover) return;
    const tick = Math.round(popover.tick);
    if (popover.kind === "bpm") {
      const bpm = parseFloat(inputValue);
      if (!Number.isFinite(bpm) || bpm <= 0 || bpm > 1000) return;
      onAddBpm(tick, bpm); // replaces an existing event at the same tick
    } else if (popover.kind === "ts") {
      const numerator = parseInt(tsNumerator, 10);
      const denominator = parseInt(tsDenominator, 10);
      if (!Number.isInteger(numerator) || numerator < 1 || numerator > 32) return;
      if (!DENOMINATORS.includes(denominator)) return;
      onAddTimeSignature(tick, numerator, denominator);
    } else {
      const name = inputValue.trim().slice(0, MAX_SECTION_NAME);
      if (!name) return;
      if (popover.mode === "edit" && popover.id) onRenameSection(popover.id, name);
      else onAddSection(uuidv4(), tick, name);
    }
    closePopover();
  }, [popover, inputValue, tsNumerator, tsDenominator, onAddBpm, onAddTimeSignature, onAddSection, onRenameSection, closePopover]);

  const handlePopoverDelete = useCallback(() => {
    if (!popover || popover.mode !== "edit") return;
    if (popover.kind === "bpm") onDeleteBpm(popover.tick);
    else if (popover.kind === "ts") onDeleteTimeSignature(popover.tick);
    else if (popover.id) onDeleteSection(popover.id);
    closePopover();
  }, [popover, onDeleteBpm, onDeleteTimeSignature, onDeleteSection, closePopover]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handlePopoverSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closePopover();
      }
    },
    [handlePopoverSubmit, closePopover]
  );

  // The first BPM and time signature define the start of the song: edit only
  const canDelete = popover?.mode === "edit" && (popover.kind === "section" || popover.tick > 0);
  const inputClass = "h-6 text-xs px-2 rounded border bg-background outline-none focus:ring-1 ring-primary";

  return (
    <div
      ref={containerRef}
      className="relative w-full shrink-0"
      style={{ height: RULER_HEIGHT }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }}
        title="Click: add section · Right-click: add BPM / time signature · Drag a marker to move it · Right-click a marker to edit"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Dismiss popover on outside click */}
      {popover && (
        <div
          className="fixed inset-0 z-40"
          onClick={closePopover}
          onContextMenu={(e) => { e.preventDefault(); closePopover(); }}
        />
      )}

      {/* Inline popover */}
      {popover && (
        <div
          role="dialog"
          aria-label={`${popover.mode === "add" ? "Add" : "Edit"} ${KIND_LABEL[popover.kind]}`}
          className="absolute z-50 bg-background border rounded shadow-lg p-2 flex flex-col gap-1.5"
          style={{
            left: Math.max(0, Math.min(popover.x, (canvasRef.current?.width ?? 300) - 200)),
            top: RULER_HEIGHT + 2,
            minWidth: 190,
          }}
          onKeyDown={handleKeyDown}
        >
          <span className="text-xs text-muted-foreground font-medium">
            {popover.mode === "add" ? "Add " : "Edit "}
            {KIND_LABEL[popover.kind]} at {formatPosition(popover.tick, tempoMap, timeSignatures, resolution)}
          </span>

          {/* Right-click on empty space can add either tempo marker */}
          {popover.mode === "add" && popover.kind !== "section" && (
            <div className="flex rounded border p-0.5 text-[11px]">
              {(["bpm", "ts"] as const).map((kind) => (
                <button
                  key={kind}
                  className={`flex-1 rounded px-1.5 py-0.5 ${popover.kind === kind ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => openPopover({ ...popover, kind })}
                >
                  {kind === "bpm" ? "BPM" : "Time signature"}
                </button>
              ))}
            </div>
          )}

          {popover.kind === "ts" ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="number"
                aria-label="Beats per measure"
                value={tsNumerator}
                onChange={(e) => setTsNumerator(e.target.value)}
                className={`${inputClass} w-14`}
                min={1}
                max={32}
                step={1}
              />
              <span className="text-xs text-muted-foreground">/</span>
              <select
                aria-label="Beat unit"
                value={tsDenominator}
                onChange={(e) => setTsDenominator(e.target.value)}
                className={`${inputClass} w-14`}
              >
                {DENOMINATORS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          ) : (
            <input
              ref={inputRef}
              type={popover.kind === "bpm" ? "number" : "text"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={popover.kind === "bpm" ? "BPM value" : "Section name"}
              className={inputClass}
              min={popover.kind === "bpm" ? 1 : undefined}
              max={popover.kind === "bpm" ? 1000 : undefined}
              step={popover.kind === "bpm" ? 0.001 : undefined}
              maxLength={popover.kind === "section" ? MAX_SECTION_NAME : undefined}
            />
          )}

          <div className="flex gap-1">
            <button
              className="flex-1 text-xs py-0.5 px-2 rounded bg-primary text-primary-foreground hover:opacity-90"
              onClick={handlePopoverSubmit}
            >
              {popover.mode === "add" ? "Add" : "Save"}
            </button>
            {canDelete && (
              <button
                className="flex-1 text-xs py-0.5 px-2 rounded border border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={handlePopoverDelete}
              >
                Delete
              </button>
            )}
            <button
              className="flex-1 text-xs py-0.5 px-2 rounded border hover:bg-muted"
              onClick={closePopover}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
