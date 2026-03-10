"use client";

import { useRef, useCallback } from "react";
import { FileMusic, Music, Upload, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileUploadProps {
  onChartFile: (file: File) => void;
  onAudioFiles: (files: File[]) => void;
  chartFileName?: string;
  // stems map just to show loaded state (label → anything)
  stems: Map<string, unknown>;
}

function ChartDropZone({
  fileName,
  onFile,
}: {
  fileName?: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
        "hover:border-primary/50 hover:bg-primary/5",
        fileName ? "border-primary/40 bg-primary/5" : "border-border"
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".chart,.mid,.midi"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      <FileMusic
        className={cn("h-8 w-8", fileName ? "text-primary" : "text-muted-foreground")}
      />
      <div className="text-center">
        <p className="text-sm font-medium">
          {fileName ?? "Chart file (.chart / .mid)"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {fileName ? "Click to replace" : "Click or drag & drop"}
        </p>
      </div>
      <Upload className="h-3 w-3 text-muted-foreground" />
    </div>
  );
}

function AudioDropZone({
  stems,
  onFiles,
}: {
  stems: Map<string, unknown>;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        /\.(ogg|mp3|wav|flac|opus)$/i.test(f.name)
      );
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length) onFiles(files);
      e.target.value = "";
    },
    [onFiles]
  );

  const stemLabels = [...stems.keys()];
  const hasStems = stemLabels.length > 0;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
        "hover:border-primary/50 hover:bg-primary/5",
        hasStems ? "border-primary/40 bg-primary/5" : "border-border"
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".ogg,.mp3,.wav,.flac,.opus"
        multiple
        className="hidden"
        onChange={handleChange}
      />
      <Music
        className={cn("h-8 w-8", hasStems ? "text-primary" : "text-muted-foreground")}
      />
      <div className="text-center">
        <p className="text-sm font-medium">
          {hasStems ? "Audio stems loaded" : "Audio stems (.ogg, mp3…)"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {hasStems
            ? "Click to add more"
            : "Drop multiple files at once — one per instrument"}
        </p>
      </div>

      {hasStems ? (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {stemLabels.map((label) => (
            <span
              key={label}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs"
            >
              <CheckCircle2 className="h-3 w-3" />
              {label}
            </span>
          ))}
        </div>
      ) : (
        <Upload className="h-3 w-3 text-muted-foreground" />
      )}
    </div>
  );
}

export function FileUpload({
  onChartFile,
  onAudioFiles,
  chartFileName,
  stems,
}: FileUploadProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Chart Editor</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a chart file to get started. Audio stems are optional.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        <ChartDropZone fileName={chartFileName} onFile={onChartFile} />
        <AudioDropZone stems={stems} onFiles={onAudioFiles} />
      </div>

      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>
          Chart: <code>.chart</code> (Clone Hero) or <code>.mid</code> (MIDI)
        </p>
        <p>
          Audio: drop individual stem files named{" "}
          <code>song.ogg</code>, <code>guitar.ogg</code>,{" "}
          <code>drums.ogg</code>, <code>bass.ogg</code>,{" "}
          <code>keys.ogg</code>, <code>vocals.ogg</code>
        </p>
      </div>
    </div>
  );
}
