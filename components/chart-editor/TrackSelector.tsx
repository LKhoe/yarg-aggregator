"use client";

import { Button } from "@/components/ui/button";
import type { ChartData, Difficulty, Instrument, TrackKey } from "@/lib/chart/types";
import {
  DIFFICULTY_ORDER,
  INSTRUMENT_ORDER,
  INSTRUMENT_LABELS,
  makeTrackKey,
} from "@/lib/chart/types";

export interface TrackSelectorProps {
  chart: ChartData;
  selectedTrack: TrackKey | null;
  onSelectTrack: (key: TrackKey) => void;
}

export function TrackSelector({
  chart,
  selectedTrack,
  onSelectTrack,
}: TrackSelectorProps) {
  // Find which instruments have at least one difficulty
  const availableInstruments = INSTRUMENT_ORDER.filter((inst) =>
    DIFFICULTY_ORDER.some((diff) => chart.tracks[makeTrackKey(diff, inst)])
  );

  const selectedParsed = selectedTrack
    ? {
        instrument: INSTRUMENT_ORDER.find((inst) =>
          DIFFICULTY_ORDER.some(
            (diff) => makeTrackKey(diff, inst) === selectedTrack
          )
        ),
        difficulty: DIFFICULTY_ORDER.find((diff) =>
          INSTRUMENT_ORDER.some(
            (inst) => makeTrackKey(diff, inst) === selectedTrack
          )
        ),
      }
    : null;

  const selectedInstrument = selectedParsed?.instrument ?? null;
  const selectedDifficulty = selectedParsed?.difficulty ?? null;

  return (
    <div className="flex flex-col gap-2 p-3 border-b bg-muted/20">
      {/* Instrument tabs */}
      <div className="flex gap-1 flex-wrap">
        {availableInstruments.map((inst) => (
          <Button
            key={inst}
            variant={selectedInstrument === inst ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              // Switch to same difficulty in new instrument, or first available
              const diff =
                selectedDifficulty &&
                chart.tracks[makeTrackKey(selectedDifficulty, inst)]
                  ? selectedDifficulty
                  : DIFFICULTY_ORDER.find(
                      (d) => chart.tracks[makeTrackKey(d, inst)]
                    );
              if (diff) {
                onSelectTrack(makeTrackKey(diff, inst));
              }
            }}
          >
            {INSTRUMENT_LABELS[inst]}
          </Button>
        ))}
      </div>

      {/* Difficulty tabs */}
      {selectedInstrument && (
        <div className="flex gap-1">
          {DIFFICULTY_ORDER.map((diff) => {
            const key = makeTrackKey(diff, selectedInstrument);
            const exists = !!chart.tracks[key];
            return (
              <Button
                key={diff}
                variant={selectedDifficulty === diff ? "secondary" : "ghost"}
                size="sm"
                className="text-xs h-6"
                disabled={!exists}
                onClick={() => onSelectTrack(key)}
              >
                {diff}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
