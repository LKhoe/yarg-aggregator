"use client";

import { memo, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ChartData, Difficulty, Instrument, TrackKey } from "@/lib/chart/types";
import {
  DIFFICULTY_ORDER,
  makeTrackKey,
  parseTrackKey,
} from "@/lib/chart/types";

export interface AutoReduceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chart: ChartData;
  selectedTrack: TrackKey | null;
  onGenerate: (sourceTrackKey: TrackKey, targetDifficulties: Difficulty[]) => void;
}

export const AutoReduceDialog = memo(function AutoReduceDialog({
  open,
  onOpenChange,
  chart,
  selectedTrack,
  onGenerate,
}: AutoReduceDialogProps) {
  const [selected, setSelected] = useState<Set<Difficulty>>(new Set());

  const parsed = selectedTrack ? parseTrackKey(selectedTrack) : null;
  const instrument = parsed?.instrument;
  const sourceDifficulty = parsed?.difficulty;

  // Determine which difficulties can be generated (below the source)
  const targetDifficulties = useMemo(() => {
    if (!sourceDifficulty || !instrument) return [];
    const sourceIdx = DIFFICULTY_ORDER.indexOf(sourceDifficulty);
    return DIFFICULTY_ORDER.filter((_, i) => i < sourceIdx);
  }, [sourceDifficulty, instrument]);

  // Check which already exist
  const existingDiffs = useMemo(() => {
    if (!instrument) return new Set<Difficulty>();
    const existing = new Set<Difficulty>();
    for (const diff of targetDifficulties) {
      const key = makeTrackKey(diff, instrument);
      if (chart.tracks[key] && chart.tracks[key]!.notes.length > 0) {
        existing.add(diff);
      }
    }
    return existing;
  }, [chart.tracks, instrument, targetDifficulties]);

  const toggleDiff = (diff: Difficulty) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(diff)) next.delete(diff);
      else next.add(diff);
      return next;
    });
  };

  const handleGenerate = () => {
    if (!selectedTrack || selected.size === 0) return;
    onGenerate(selectedTrack, [...selected].sort(
      (a, b) => DIFFICULTY_ORDER.indexOf(b) - DIFFICULTY_ORDER.indexOf(a),
    ));
    setSelected(new Set());
    onOpenChange(false);
  };

  if (targetDifficulties.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Auto-reduce Difficulties</DialogTitle>
            <DialogDescription>
              Select an Expert or Hard track as the source to generate lower difficulties.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const hasOverwrite = [...selected].some((d) => existingDiffs.has(d));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Auto-reduce Difficulties</DialogTitle>
          <DialogDescription>
            Generate lower difficulties from {sourceDifficulty}. Select which to create:
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {targetDifficulties.map((diff) => {
            const exists = existingDiffs.has(diff);
            const isSelected = selected.has(diff);
            return (
              <button
                key={diff}
                onClick={() => toggleDiff(diff)}
                className={`flex items-center justify-between px-3 py-2 rounded border text-sm transition-colors ${
                  isSelected
                    ? "border-pink-500 bg-pink-500/10 text-foreground"
                    : "border-border hover:border-muted-foreground/50 text-muted-foreground"
                }`}
              >
                <span>{diff}</span>
                {exists && (
                  <span className="text-xs text-amber-400">will overwrite</span>
                )}
              </button>
            );
          })}
        </div>

        {hasOverwrite && (
          <p className="text-xs text-amber-400">
            Selected difficulties with existing notes will be replaced. This can be undone.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0}
            onClick={handleGenerate}
          >
            Generate {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
