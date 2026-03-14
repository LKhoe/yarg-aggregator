"use client";

import { memo, useRef, useCallback, useState } from "react";
import type { Section } from "@/lib/chart/types";
import type { TempoPoint } from "@/lib/chart/tempo-utils";
import { tickToSeconds } from "@/lib/chart/tempo-utils";

export interface TimelineBarProps {
  currentTick: number;
  totalTicks: number;
  sections: Section[];
  tempoMap: TempoPoint[];
  onSeek: (tick: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const TimelineBar = memo(function TimelineBar({
  currentTick,
  totalTicks,
  sections,
  tempoMap,
  onSeek,
}: TimelineBarProps) {
  const barRef      = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hovering,   setHovering]   = useState(false);
  const [hoverFrac,  setHoverFrac]  = useState(0);

  const progress = totalTicks > 0 ? Math.min(1, Math.max(0, currentTick / totalTicks)) : 0;

  // ── Tick ↔ position helpers ────────────────────────────────────────────────

  const fractionFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent<Element>) => {
      const bar = barRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    },
    []
  );

  const tickFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent<Element>) =>
      Math.round(fractionFromEvent(e) * totalTicks),
    [fractionFromEvent, totalTicks]
  );

  // ── Mouse handlers ─────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
      onSeek(tickFromEvent(e));

      // Cache the rect once to avoid forced layout recalc on every mousemove
      const rect = barRef.current!.getBoundingClientRect();
      const onMove = (me: MouseEvent) => {
        const frac = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width));
        setHoverFrac(frac);
        onSeek(Math.round(frac * totalTicks));
      };
      const onUp = () => {
        setIsDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [tickFromEvent, onSeek, totalTicks]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setHoverFrac(fractionFromEvent(e));
    },
    [fractionFromEvent]
  );

  // ── Derived values for display ─────────────────────────────────────────────

  const hoverTick      = Math.round(hoverFrac * totalTicks);
  const hoverSeconds   = tickToSeconds(hoverTick, tempoMap);
  const currentSeconds = tickToSeconds(Math.max(0, currentTick), tempoMap);
  const totalSeconds   = tickToSeconds(Math.max(0, totalTicks), tempoMap);

  // Keep tooltip inside bounds (clamp so it doesn't overflow left/right edge)
  const tooltipLeft = `clamp(24px, ${hoverFrac * 100}%, calc(100% - 24px))`;

  const active = hovering || isDragging;

  return (
    <div
      ref={barRef}
      className="relative w-full cursor-pointer select-none"
      style={{ height: 28 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); }}
    >
      {/* ── Inner track (grows on hover/drag) ─────────────────────────────── */}
      <div className="absolute inset-x-0 flex items-center" style={{ top: "50%", transform: "translateY(-50%)" }}>
        <div
          className="relative w-full rounded-full overflow-hidden transition-all duration-100"
          style={{ height: active ? 8 : 4 }}
        >
          {/* Background */}
          <div className="absolute inset-0 bg-white/10" />

          {/* Section marker slots (behind fill so fill covers "played" sections) */}
          {sections.map((section) => {
            const pct = totalTicks > 0 ? (section.tick / totalTicks) * 100 : 0;
            if (pct < 0 || pct > 100) return null;
            return (
              <div
                key={section.id}
                className="absolute inset-y-0 w-px"
                style={{
                  left: `${pct}%`,
                  background: section.type === "solo" ? "#f59e0b" : "#a855f7",
                  opacity: 0.85,
                  zIndex: 1,
                }}
              />
            );
          })}

          {/* Progress fill */}
          <div
            className="absolute inset-y-0 left-0 bg-pink-500 transition-none"
            style={{ width: `${progress * 100}%`, zIndex: 2 }}
          />

          {/* Hover ghost (shows where you'd seek to) */}
          {active && hoverFrac > progress && (
            <div
              className="absolute inset-y-0 left-0 bg-white/15"
              style={{ width: `${hoverFrac * 100}%`, zIndex: 1 }}
            />
          )}
        </div>

        {/* ── Playhead circle ──────────────────────────────────────────────── */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-pink-500 shadow pointer-events-none transition-all duration-100"
          style={{
            left:    `${progress * 100}%`,
            width:   active ? 14 : 0,
            height:  active ? 14 : 0,
            opacity: active ? 1  : 0,
            zIndex:  10,
          }}
        />
      </div>

      {/* ── Hover tooltip ─────────────────────────────────────────────────── */}
      {active && (
        <div
          className="absolute bottom-full mb-1.5 px-1.5 py-0.5 bg-popover text-popover-foreground text-[11px] rounded shadow-lg pointer-events-none font-mono"
          style={{ left: tooltipLeft, transform: "translateX(-50%)" }}
        >
          {formatTime(hoverSeconds)}
        </div>
      )}

      {/* ── Time display ──────────────────────────────────────────────────── */}
      <div
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono tabular-nums pointer-events-none"
        style={{ zIndex: 5 }}
      >
        {formatTime(currentSeconds)} / {formatTime(totalSeconds)}
      </div>
    </div>
  );
});
