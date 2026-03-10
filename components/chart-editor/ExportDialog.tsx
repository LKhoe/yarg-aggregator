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
import { FileText, Music } from "lucide-react";
import type { ChartData } from "@/lib/chart/types";
import { downloadChart } from "@/lib/chart/serializer-chart";
import { downloadMidi } from "@/lib/chart/serializer-midi";
import { cn } from "@/lib/utils";

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chart: ChartData;
}

type Format = "chart" | "midi";

export function ExportDialog({ open, onOpenChange, chart }: ExportDialogProps) {
  const [format, setFormat] = useState<Format>("chart");

  const handleExport = () => {
    const name = chart.metadata.name || "notes";
    if (format === "chart") {
      downloadChart(chart, `${name}.chart`);
    } else {
      downloadMidi(chart, `${name}.mid`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Chart</DialogTitle>
          <DialogDescription>
            Choose a format to export your chart file.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-2">
          {(
            [
              {
                value: "chart" as Format,
                label: ".chart",
                sub: "Clone Hero format",
                Icon: FileText,
              },
              {
                value: "midi" as Format,
                label: ".mid",
                sub: "MIDI format",
                Icon: Music,
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

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport}>Download</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
