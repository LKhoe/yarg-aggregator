"use client";

import { memo, useState, useEffect, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  onToggleFlag?: (id: string, flag: "forceHopo" | "forceStrum" | "tap" | "open" | "cymbal" | "accent" | "ghost" | "doubleKick") => void;
  isVocals?: boolean;
}

interface FlagToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  shortcut: string;
  color?: string;
}

const FlagToggle = memo(function FlagToggle({ checked, onChange, label, shortcut, color }: FlagToggleProps) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "flex items-center gap-2 w-full px-2 py-1 rounded text-xs transition-colors",
        checked
          ? "bg-primary/15 text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <div
        className={cn(
          "w-3 h-3 rounded-sm border flex items-center justify-center shrink-0",
          checked ? "bg-primary border-primary" : "border-muted-foreground/40",
        )}
        style={checked && color ? { backgroundColor: color, borderColor: color } : undefined}
      >
        {checked && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span className="flex-1 text-left">{label}</span>
      <kbd className="text-[10px] text-muted-foreground/60 font-mono">{shortcut}</kbd>
    </button>
  );
});

export const PropertiesPanel = memo(function PropertiesPanel({
  chart,
  trackKey,
  selectedNoteIds,
  onUpdateNote,
  onDeleteNotes,
  onToggleFlag,
  isVocals = false,
}: PropertiesPanelProps) {
  const isDrums = trackKey?.includes("Drums") ?? false;

  const selectedNotes = useMemo<Note[]>(() => {
    if (!trackKey || selectedNoteIds.size === 0) return [];
    const track = chart.tracks[trackKey];
    if (!track) return [];
    const result: Note[] = [];
    for (const note of track.notes) {
      if (selectedNoteIds.has(note.id)) {
        result.push(note);
        if (result.length === selectedNoteIds.size) break;
      }
    }
    return result;
  }, [chart, trackKey, selectedNoteIds]);

  const singleNote = selectedNotes.length === 1 ? selectedNotes[0] : null;

  // Local editable state — only used when user is typing; synced from note when selection changes
  const [editState, setEditState] = useState<{ tick: number; fret: number; length: number; noteId: string | null }>({ tick: 0, fret: 0, length: 0, noteId: null });

  // Sync edit state when selected note changes identity or values
  useEffect(() => {
    if (singleNote && singleNote.id !== editState.noteId) {
      setEditState({ tick: singleNote.tick, fret: singleNote.fret, length: singleNote.length, noteId: singleNote.id });
    }
  }, [singleNote, editState.noteId]);

  // Also update when the note's values change externally (e.g. undo)
  useEffect(() => {
    if (singleNote && singleNote.id === editState.noteId) {
      setEditState({ tick: singleNote.tick, fret: singleNote.fret, length: singleNote.length, noteId: singleNote.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleNote?.tick, singleNote?.fret, singleNote?.length]);

  const handleApply = useCallback(() => {
    if (!singleNote) return;
    onUpdateNote(singleNote.id, editState.tick, editState.fret, editState.length);
  }, [singleNote, editState, onUpdateNote]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleApply(); }
  }, [handleApply]);

  const fretColor = isDrums
    ? DRUM_COLORS[editState.fret] ?? "#888"
    : FRET_COLORS[editState.fret] ?? "#888";

  // Multi-select stats (computed only when needed)
  const multiStats = useMemo(() => {
    if (selectedNotes.length <= 1) return null;
    let minTick = Infinity, maxTick = -Infinity;
    for (const n of selectedNotes) {
      if (n.tick < minTick) minTick = n.tick;
      if (n.tick > maxTick) maxTick = n.tick;
    }
    return { minTick, maxTick };
  }, [selectedNotes]);

  return (
    <div className="p-3 bg-muted/10 min-w-[180px] w-full max-w-[260px] flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Properties</h3>
        {selectedNotes.length > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            {selectedNotes.length} sel
          </span>
        )}
      </div>

      {selectedNotes.length === 0 && (
        <p className="text-xs text-muted-foreground/60 italic">Click a note to inspect</p>
      )}

      {singleNote && (
        <div className="space-y-3">
          {/* Fret/Pitch color indicator */}
          <div className="flex items-center gap-2 px-1">
            {!isVocals && (
              <div
                className="w-3.5 h-3.5 rounded-sm ring-1 ring-white/10"
                style={{ backgroundColor: fretColor }}
              />
            )}
            <span className="text-xs font-medium">
              {isVocals ? midiToName(editState.fret) : isDrums ? getDrumLabel(editState.fret) : `Fret ${editState.fret}`}
            </span>
          </div>

          {/* Numeric fields */}
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <Label className="text-[10px] text-muted-foreground">Tick</Label>
              <Input
                type="number"
                value={editState.tick}
                onChange={(e) => setEditState(s => ({ ...s, tick: Number(e.target.value) }))}
                onKeyDown={handleKeyDown}
                className="h-7 text-xs mt-0.5 font-mono"
                min={0}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">{isVocals ? "Pitch" : "Fret"}</Label>
              <Input
                type="number"
                value={editState.fret}
                onChange={(e) => setEditState(s => ({ ...s, fret: Number(e.target.value) }))}
                onKeyDown={handleKeyDown}
                className="h-7 text-xs mt-0.5 font-mono"
                min={isVocals ? 36 : 0}
                max={isVocals ? 97 : 4}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Length</Label>
              <Input
                type="number"
                value={editState.length}
                onChange={(e) => setEditState(s => ({ ...s, length: Number(e.target.value) }))}
                onKeyDown={handleKeyDown}
                className="h-7 text-xs mt-0.5 font-mono"
                min={0}
              />
            </div>
          </div>

          <Button size="sm" className="w-full h-7 text-xs" onClick={handleApply}>
            Apply
          </Button>

          {/* Note Flags */}
          {onToggleFlag && !isVocals && (
            <div className="space-y-1 pt-1 border-t border-border/30">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Flags</span>
              <div className="space-y-0.5">
                {!isDrums && (
                  <>
                    <FlagToggle checked={singleNote.flags?.forceHopo ?? false} onChange={() => onToggleFlag(singleNote.id, "forceHopo")} label="Force HOPO" shortcut="H" />
                    <FlagToggle checked={singleNote.flags?.forceStrum ?? false} onChange={() => onToggleFlag(singleNote.id, "forceStrum")} label="Force Strum" shortcut="S" />
                    <FlagToggle checked={singleNote.flags?.tap ?? false} onChange={() => onToggleFlag(singleNote.id, "tap")} label="Tap" shortcut="T" />
                    <FlagToggle checked={singleNote.flags?.open ?? false} onChange={() => onToggleFlag(singleNote.id, "open")} label="Open Note" shortcut="F" color="#9333ea" />
                  </>
                )}
                {isDrums && (
                  <>
                    <FlagToggle checked={singleNote.flags?.cymbal ?? false} onChange={() => onToggleFlag(singleNote.id, "cymbal")} label="Cymbal" shortcut="C" color="#eab308" />
                    <FlagToggle checked={singleNote.flags?.accent ?? false} onChange={() => onToggleFlag(singleNote.id, "accent")} label="Accent" shortcut="A" color="#ef4444" />
                    <FlagToggle checked={singleNote.flags?.ghost ?? false} onChange={() => onToggleFlag(singleNote.id, "ghost")} label="Ghost" shortcut="^G" />
                    <FlagToggle checked={singleNote.flags?.doubleKick ?? false} onChange={() => onToggleFlag(singleNote.id, "doubleKick")} label="Double Kick" shortcut="^K" color="#f97316" />
                  </>
                )}
              </div>
            </div>
          )}
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
      {multiStats && (
        <div className="text-[10px] text-muted-foreground font-mono px-1">
          Ticks: {multiStats.minTick} &ndash; {multiStats.maxTick}
        </div>
      )}
    </div>
  );
});

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

function midiToName(pitch: number): string {
  if (pitch === 96) return "Perc (playable)";
  if (pitch === 97) return "Perc (non-play)";
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(pitch / 12) - 1;
  const note = noteNames[pitch % 12];
  return `${note}${octave} (${pitch})`;
}
