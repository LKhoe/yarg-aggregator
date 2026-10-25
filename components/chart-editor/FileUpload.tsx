"use client";

import { useRef, useCallback, useEffect } from "react";
import { FileMusic, Music, Upload, CheckCircle2, FolderOpen, FilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FileUploadProps {
  onChartFile: (file: File) => void;
  onAudioFiles: (files: File[]) => void;
  // A song folder: chart + stems + song.ini, sorted by the editor
  onSongFiles: (files: File[]) => void;
  // Start an empty chart (e.g. charting a song from its audio)
  onNewChart: () => void;
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

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
        "hover:border-primary/50 hover:bg-primary/5",
        fileName ? "border-primary/40 bg-primary/5" : "border-border"
      )}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".chart,.mid,.midi"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
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
  onSongFiles,
  onNewChart,
  chartFileName,
  stems,
}: FileUploadProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  // webkitdirectory isn't in React's input props; set it on the element
  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  const handleFolder = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      // Top level of the folder only (sub-folders hold other songs or backups)
      const topLevel = files.filter((f) => f.webkitRelativePath.split("/").length <= 2);
      if (topLevel.length) onSongFiles(topLevel);
      e.target.value = "";
    },
    [onSongFiles]
  );

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Chart Editor</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Open a song folder, or drop it (or its files) anywhere on this page.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <input ref={folderInputRef} type="file" multiple className="hidden" onChange={handleFolder} />
        <Button onClick={() => folderInputRef.current?.click()} className="gap-2">
          <FolderOpen className="h-4 w-4" />
          Open song folder…
        </Button>
        <Button variant="outline" onClick={onNewChart} className="gap-2" title="120 BPM, 4/4 and an empty Expert Guitar track">
          <FilePlus className="h-4 w-4" />
          New empty chart
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        <ChartDropZone fileName={chartFileName} onFile={onChartFile} />
        <AudioDropZone stems={stems} onFiles={onAudioFiles} />
      </div>

      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>
          Chart: <code>notes.chart</code> (Clone Hero) or <code>notes.mid</code> (MIDI); <code>song.ini</code> fills in the song info
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
