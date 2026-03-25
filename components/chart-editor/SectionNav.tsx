"use client";

import { memo, useMemo } from "react";
import type { Section } from "@/lib/chart/types";
import type { TempoPoint } from "@/lib/chart/tempo-utils";
import { tickToSeconds } from "@/lib/chart/tempo-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin } from "lucide-react";

export interface SectionNavProps {
  sections: Section[];
  currentTick: number;
  tempoMap: TempoPoint[];
  onSeek: (tick: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const SectionNav = memo(function SectionNav({
  sections,
  currentTick,
  tempoMap,
  onSeek,
}: SectionNavProps) {
  const sorted = useMemo(
    () => [...sections].sort((a, b) => a.tick - b.tick),
    [sections],
  );

  // Find the current section (last section whose tick <= currentTick)
  const currentSectionId = useMemo(() => {
    let id = "";
    for (const s of sorted) {
      if (s.tick <= currentTick) id = s.id;
      else break;
    }
    return id;
  }, [sorted, currentTick]);

  if (sorted.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
      <Select
        value={currentSectionId}
        onValueChange={(id) => {
          const section = sorted.find((s) => s.id === id);
          if (section) onSeek(section.tick);
        }}
      >
        <SelectTrigger className="h-7 w-[10rem] text-xs">
          <SelectValue placeholder="Sections" />
        </SelectTrigger>
        <SelectContent>
          {sorted.map((section) => (
            <SelectItem key={section.id} value={section.id}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      section.type === "solo" ? "#f59e0b" : "#a855f7",
                  }}
                />
                <span className="truncate">{section.name}</span>
                <span className="text-muted-foreground ml-auto tabular-nums">
                  {formatTime(tickToSeconds(section.tick, tempoMap))}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});
