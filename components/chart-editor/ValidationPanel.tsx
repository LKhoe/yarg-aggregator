"use client";

import { memo, useMemo } from "react";
import type { ChartData, TrackKey } from "@/lib/chart/types";
import { validateChart, type ValidationWarning } from "@/lib/chart/validation";
import { AlertTriangle, AlertCircle, Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ValidationPanelProps {
  chart: ChartData;
  onSeek?: (tick: number) => void;
  onSelectNotes?: (trackKey: TrackKey, ids: string[]) => void;
  onSelectTrack?: (trackKey: TrackKey) => void;
}

const SEVERITY_ICON = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const SEVERITY_COLOR = {
  error: "text-red-400",
  warning: "text-amber-400",
  info: "text-blue-400",
} as const;

export const ValidationPanel = memo(function ValidationPanel({
  chart,
  onSeek,
  onSelectNotes,
  onSelectTrack,
}: ValidationPanelProps) {
  const warnings = useMemo(() => validateChart(chart), [chart]);

  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0 };
    for (const w of warnings) c[w.severity]++;
    return c;
  }, [warnings]);

  const handleClick = (w: ValidationWarning) => {
    if (w.trackKey && onSelectTrack) onSelectTrack(w.trackKey);
    if (w.tick != null && onSeek) onSeek(w.tick);
    if (w.trackKey && w.noteIds && w.noteIds.length > 0 && onSelectNotes) {
      onSelectNotes(w.trackKey, w.noteIds);
    }
  };

  if (warnings.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground text-center">
        No issues found
      </div>
    );
  }

  return (
    <div className="flex flex-col text-xs">
      {/* Summary */}
      <div className="flex gap-3 px-3 py-2 border-b text-xs">
        {counts.error > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertCircle className="h-3 w-3" />
            {counts.error}
          </span>
        )}
        {counts.warning > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            {counts.warning}
          </span>
        )}
        {counts.info > 0 && (
          <span className="flex items-center gap-1 text-blue-400">
            <Info className="h-3 w-3" />
            {counts.info}
          </span>
        )}
      </div>

      {/* Warning list */}
      <div className="max-h-[300px] overflow-y-auto">
        {warnings.map((w) => {
          const Icon = SEVERITY_ICON[w.severity];
          return (
            <button
              key={w.id}
              onClick={() => handleClick(w)}
              className={cn(
                "flex items-start gap-2 w-full text-left px-3 py-1.5 hover:bg-muted/40 transition-colors",
                w.tick != null && "cursor-pointer",
              )}
            >
              <Icon
                className={cn("h-3 w-3 mt-0.5 shrink-0", SEVERITY_COLOR[w.severity])}
              />
              <span className="flex-1 leading-snug">{w.message}</span>
              {w.tick != null && (
                <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
