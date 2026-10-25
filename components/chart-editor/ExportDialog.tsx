"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, FileText, Music, Settings, XCircle } from "lucide-react";
import type { ChartData } from "@/lib/chart/types";
import { downloadChart } from "@/lib/chart/serializer-chart";
import { downloadMidi } from "@/lib/chart/serializer-midi";
import { generateSongIni } from "@/lib/chart/song-ini";
import { validateChart } from "@/lib/chart/validation";
import { cn } from "@/lib/utils";

export type ExportFormat = "chart" | "midi" | "songini";

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chart: ChartData;
  // Name the chart was loaded from; exports keep its base name ("notes" by default)
  fileName?: string;
  onExported?: (format: ExportFormat) => void;
  onShowValidation?: () => void;
}

const MAX_LISTED_ISSUES = 3;

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportDialog({ open, onOpenChange, chart, fileName, onExported, onShowValidation }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("chart");

  // Check the chart before it leaves the editor
  const issues = useMemo(() => (open ? validateChart(chart) : []), [open, chart]);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const listed = [...errors, ...warnings].slice(0, MAX_LISTED_ISSUES);

  // YARG and Clone Hero read notes.chart / notes.mid from the song folder
  const baseName = fileName?.replace(/\.[^.]+$/, "") || "notes";
  const outputName = format === "chart" ? `${baseName}.chart` : format === "midi" ? `${baseName}.mid` : "song.ini";

  const handleExport = () => {
    if (format === "chart") {
      downloadChart(chart, outputName);
    } else if (format === "midi") {
      downloadMidi(chart, outputName);
    } else {
      downloadTextFile(generateSongIni(chart), outputName);
    }
    onExported?.(format);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Chart</DialogTitle>
          <DialogDescription>
            Choose a format. Put the files in the song folder next to the audio stems.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 mt-2">
          {(
            [
              {
                value: "chart" as ExportFormat,
                label: ".chart",
                sub: "Clone Hero format",
                Icon: FileText,
              },
              {
                value: "midi" as ExportFormat,
                label: ".mid",
                sub: "MIDI format",
                Icon: Music,
              },
              {
                value: "songini" as ExportFormat,
                label: "song.ini",
                sub: "CH metadata",
                Icon: Settings,
              },
            ] as const
          ).map(({ value, label, sub, Icon }) => (
            <button
              key={value}
              onClick={() => setFormat(value)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 border rounded-lg transition-colors text-left",
                format === value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              )}
            >
              <Icon className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Validation summary */}
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs space-y-1",
            errors.length > 0
              ? "border-destructive/40 bg-destructive/5"
              : warnings.length > 0
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-border"
          )}
        >
          <div className="flex items-center gap-1.5 font-medium">
            {errors.length > 0 ? (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            ) : warnings.length > 0 ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            )}
            {errors.length === 0 && warnings.length === 0
              ? "No problems found"
              : [
                  errors.length > 0 && `${errors.length} error${errors.length === 1 ? "" : "s"}`,
                  warnings.length > 0 && `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`,
                ].filter(Boolean).join(", ")}
          </div>
          {listed.map((issue) => (
            <p key={issue.id} className="text-muted-foreground pl-5">
              {issue.message}
            </p>
          ))}
          {issues.length > listed.length && onShowValidation && (
            <button className="pl-5 underline text-muted-foreground hover:text-foreground" onClick={onShowValidation}>
              See all in the Validation panel
            </button>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            variant={errors.length > 0 ? "destructive" : "default"}
            title={`Download ${outputName}`}
          >
            {errors.length > 0 ? "Download anyway" : `Download ${outputName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
