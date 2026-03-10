"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ChartData, Note, TrackKey } from "@/lib/chart/types";
import { FRET_COLORS, DRUM_COLORS } from "@/lib/chart/types";

export interface PropertiesPanelProps {
  chart: ChartData;
  trackKey: TrackKey | null;
  selectedNoteIds: Set<string>;
  onUpdateNote: (
    id: string,
    tick: number,
    fret: number,
    length: number
  ) => void;
  onDeleteNotes: (ids: string[]) => void;
}

export function PropertiesPanel({
  chart,
  trackKey,
  selectedNoteIds,
  onUpdateNote,
  onDeleteNotes,
}: PropertiesPanelProps) {
  const isDrums = trackKey?.includes("Drums") ?? false;

  const selectedNotes: Note[] = [];
  if (trackKey) {
    const track = chart.tracks[trackKey];
    if (track) {
      for (const note of track.notes) {
        if (selectedNoteIds.has(note.id)) {
          selectedNotes.push(note);
        }
      }
    }
  }

  const singleNote = selectedNotes.length === 1 ? selectedNotes[0] : null;

  const [tick, setTick] = useState(singleNote?.tick ?? 0);
  const [fret, setFret] = useState(singleNote?.fret ?? 0);
  const [length, setLength] = useState(singleNote?.length ?? 0);

  useEffect(() => {
    if (singleNote) {
      setTick(singleNote.tick);
      setFret(singleNote.fret);
      setLength(singleNote.length);
    }
  }, [singleNote?.id, singleNote?.tick, singleNote?.fret, singleNote?.length]);

  const handleApply = () => {
    if (!singleNote) return;
    onUpdateNote(singleNote.id, tick, fret, length);
  };

  const fretColor = isDrums
    ? DRUM_COLORS[fret] ?? "#888"
    : FRET_COLORS[fret] ?? "#888";

  return (
    <div className="p-4 border-l bg-muted/10 min-w-[200px] max-w-[240px] flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold mb-1">Properties</h3>
        {selectedNotes.length === 0 && (
          <p className="text-xs text-muted-foreground">No notes selected</p>
        )}
        {selectedNotes.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {selectedNotes.length} notes selected
          </p>
        )}
      </div>

      {singleNote && (
        <div className="space-y-3">
          {/* Fret color indicator */}
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: fretColor }}
            />
            <span className="text-xs text-muted-foreground">
              {isDrums ? getDrumLabel(fret) : `Fret ${fret}`}
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs">Tick</Label>
              <Input
                type="number"
                value={tick}
                onChange={(e) => setTick(Number(e.target.value))}
                className="h-7 text-xs mt-1"
                min={0}
              />
            </div>
            <div>
              <Label className="text-xs">Fret</Label>
              <Input
                type="number"
                value={fret}
                onChange={(e) => setFret(Number(e.target.value))}
                className="h-7 text-xs mt-1"
                min={0}
                max={4}
              />
            </div>
            <div>
              <Label className="text-xs">Length (ticks)</Label>
              <Input
                type="number"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="h-7 text-xs mt-1"
                min={0}
              />
            </div>
          </div>

          <Button size="sm" className="w-full h-7 text-xs" onClick={handleApply}>
            Apply
          </Button>
        </div>
      )}

      {selectedNotes.length > 0 && (
        <Button
          variant="destructive"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => onDeleteNotes([...selectedNoteIds])}
        >
          Delete ({selectedNotes.length})
        </Button>
      )}

      {/* Chord info for multi-select */}
      {selectedNotes.length > 1 && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Ticks: {Math.min(...selectedNotes.map((n) => n.tick))} – {Math.max(...selectedNotes.map((n) => n.tick))}</p>
        </div>
      )}
    </div>
  );
}

function getDrumLabel(fret: number): string {
  const labels: Record<number, string> = {
    0: "Kick",
    1: "Red (Snare)",
    2: "Yellow (HH)",
    3: "Blue (Mid)",
    4: "Green (Floor)",
  };
  return labels[fret] ?? `Pad ${fret}`;
}
