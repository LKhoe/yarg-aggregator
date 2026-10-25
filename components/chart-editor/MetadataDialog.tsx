"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChartData } from "@/lib/chart/types";

type Metadata = ChartData["metadata"];

export interface MetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: Metadata;
  onSave: (metadata: Metadata) => void;
}

const MAX_TEXT = 200;
// Offsets beyond this are almost certainly a typo (ms typed as seconds)
const MAX_OFFSET_SECONDS = 30;

const TEXT_FIELDS: { key: "name" | "artist" | "album" | "genre" | "year" | "charter"; label: string; placeholder?: string }[] = [
  { key: "name", label: "Song" },
  { key: "artist", label: "Artist" },
  { key: "album", label: "Album" },
  { key: "genre", label: "Genre" },
  { key: "year", label: "Year", placeholder: "1982" },
  { key: "charter", label: "Charter" },
];

export function MetadataDialog({ open, onOpenChange, metadata, onSave }: MetadataDialogProps) {
  const [draft, setDraft] = useState<Metadata>(metadata);
  const [offsetText, setOffsetText] = useState(String(metadata.offset));

  // Start every edit from the chart's current values (reset when the dialog opens)
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setDraft(metadata);
      setOffsetText(String(metadata.offset));
    }
  }

  const offset = Number(offsetText);
  const offsetValid = offsetText.trim() !== "" && Number.isFinite(offset) && Math.abs(offset) <= MAX_OFFSET_SECONDS;

  const handleSave = () => {
    if (!offsetValid) return;
    const cleaned: Metadata = { ...draft, offset };
    for (const { key } of TEXT_FIELDS) cleaned[key] = draft[key].trim().slice(0, MAX_TEXT);
    onSave(cleaned);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Song info</DialogTitle>
          <DialogDescription>Saved in the chart file and in song.ini.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            {TEXT_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`meta-${key}`} className="text-xs">{label}</Label>
                <Input
                  id={`meta-${key}`}
                  value={draft[key]}
                  maxLength={MAX_TEXT}
                  placeholder={placeholder}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  className="h-8 text-sm"
                  autoFocus={key === "name"}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="meta-offset" className="text-xs">Audio offset (seconds)</Label>
              <Input
                id="meta-offset"
                type="number"
                step={0.001}
                value={offsetText}
                onChange={(e) => setOffsetText(e.target.value)}
                className="h-8 text-sm font-mono"
                aria-invalid={!offsetValid}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Resolution</Label>
              <p className="h-8 flex items-center text-sm font-mono text-muted-foreground">
                {metadata.resolution} ticks/beat
              </p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Audio time at the start of the chart. If notes land after the sound, lower it; if before, raise it.
            {!offsetValid && (
              <span className="block text-destructive">Enter a number between -{MAX_OFFSET_SECONDS} and {MAX_OFFSET_SECONDS}.</span>
            )}
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!offsetValid}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
