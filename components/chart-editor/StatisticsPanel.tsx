"use client";

import { memo, useMemo, useRef, useEffect } from "react";
import type { ChartData, TrackKey } from "@/lib/chart/types";
import type { TempoPoint } from "@/lib/chart/tempo-utils";
import {
  computeNPS,
  computeChordDistribution,
  computeTrackSummary,
  type NpsDataPoint,
} from "@/lib/chart/statistics";

export interface StatisticsPanelProps {
  chart: ChartData;
  trackKey: TrackKey | null;
  tempoMap: TempoPoint[];
}

/**
 * Tiny canvas sparkline for NPS over time.
 */
function NpsSparkline({ data }: { data: NpsDataPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || data.length === 0) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth;
    const h = cvs.clientHeight;
    cvs.width = w * dpr;
    cvs.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const maxNps = Math.max(...data.map((d) => d.nps), 1);
    const stepX = w / Math.max(data.length - 1, 1);

    // Fill area
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = h - (data[i].nps / maxNps) * (h - 2);
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo((data.length - 1) * stepX, h);
    ctx.closePath();
    ctx.fillStyle = "rgba(236, 72, 153, 0.2)";
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = h - (data[i].nps / maxNps) * (h - 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgb(236, 72, 153)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: 48 }}
    />
  );
}

function ChordBar({ size, count, maxCount }: { size: number; count: number; maxCount: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-6 text-right shrink-0">{size}n</span>
      <div className="flex-1 h-3 bg-muted/30 rounded overflow-hidden">
        <div
          className="h-full bg-pink-500/60 rounded"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-muted-foreground w-10 text-right tabular-nums">{count}</span>
    </div>
  );
}

export const StatisticsPanel = memo(function StatisticsPanel({
  chart,
  trackKey,
  tempoMap,
}: StatisticsPanelProps) {
  const resolution = chart.metadata.resolution || 192;
  const track = trackKey ? chart.tracks[trackKey] : undefined;

  const npsData = useMemo(() => {
    if (!track) return [];
    return computeNPS(track, tempoMap, resolution);
  }, [track, tempoMap, resolution]);

  const summary = useMemo(() => {
    if (!track) return null;
    return computeTrackSummary(track, tempoMap, resolution);
  }, [track, tempoMap, resolution]);

  const chordDist = useMemo(() => {
    if (!track) return new Map<number, number>();
    return computeChordDistribution(track);
  }, [track]);

  if (!track || !summary) {
    return (
      <div className="p-3 text-xs text-muted-foreground text-center">
        No track selected
      </div>
    );
  }

  const maxChordCount = Math.max(...chordDist.values(), 1);
  const chordEntries = [...chordDist.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="flex flex-col gap-3 text-xs p-3">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <Stat label="Notes" value={summary.totalNotes} />
        <Stat label="Sustains" value={summary.totalSustains} />
        <Stat label="Avg NPS" value={summary.avgNps.toFixed(1)} />
        <Stat label="Peak NPS" value={summary.peakNps.toFixed(1)} />
        <Stat label="Chords" value={summary.chordCount} />
        <Stat label="HOPOs" value={summary.hopoCount} />
        <Stat label="Taps" value={summary.tapCount} />
        <Stat label="Duration" value={`${summary.durationSeconds.toFixed(0)}s`} />
      </div>

      {/* NPS graph */}
      {npsData.length > 0 && (
        <div>
          <h4 className="text-muted-foreground mb-1">Notes per Second</h4>
          <NpsSparkline data={npsData} />
        </div>
      )}

      {/* Chord distribution */}
      {chordEntries.length > 0 && (
        <div>
          <h4 className="text-muted-foreground mb-1">Chord Distribution</h4>
          <div className="space-y-0.5">
            {chordEntries.map(([size, count]) => (
              <ChordBar key={size} size={size} count={count} maxCount={maxChordCount} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}
