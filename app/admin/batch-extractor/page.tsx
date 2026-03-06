"use client";

import React, { useCallback, useState, useRef } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useTranslations } from "@/hooks/use-translations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DifficultyMedal } from "@/components/ui/difficulty-medal";
import { InstrumentIcon } from "@/components/ui/instrument-icon";
import {
  Upload,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Music,
  FileArchive,
  Download,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  ExtractFileSuccess,
  ExtractFileError,
} from "@/services/batch-extractor/types";
type TranslationValues = Record<string, string | number>;

interface FileState {
  id: string;
  name: string;
  size: number;
  status: "queued" | "processing" | "done" | "error";
  progressMessage: string;
  progressValue: number; // 0–100
  songs: ExtractFileSuccess[];
  fileErrors: ExtractFileError[];
  errorMessage?: string;
  zipFile?: Uint8Array;
}

// Note: INSTRUMENTS will be defined inside the component to access translations

function getDiff(song: ExtractFileSuccess, key: string): number {
  switch (key) {
    case "guitar":
      return song.guitar_diff;
    case "bass":
      return song.bass_diff;
    case "drums":
      return song.drums_diff;
    case "keys":
      return song.keys_diff;
    case "vocals":
      return song.vocals_diff;
    default:
      return 0;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function SongRow({
  song,
  instruments,
  t,
}: {
  song: ExtractFileSuccess;
  instruments: Array<{ key: string; label: string }>;
  t: (key: string, values?: TranslationValues) => string;
}) {
  const charted = instruments.filter((i) => getDiff(song, i.key) > 0);

  return (
    <div className="flex items-center gap-4 p-3 bg-muted/40 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{song.song_name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {song.artist_name}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {charted.length > 0 ? (
          charted.map(({ key }) => (
            <div key={key} className="flex flex-col items-center">
              <DifficultyMedal
                level={getDiff(song, key)}
                size="sm"
                icon={<InstrumentIcon instrument={key} />}
              />
            </div>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("batchExtractor.instruments.noInstruments")}
          </span>
        )}
      </div>
    </div>
  );
}

function FileItem({
  file,
  instruments,
  t,
}: {
  file: FileState;
  instruments: Array<{ key: string; label: string }>;
  t: (key: string, values?: TranslationValues) => string;
}) {
  const handleDownload = () => {
    if (!file.zipFile) return;
    const blob = new Blob([file.zipFile.buffer as ArrayBuffer], {
      type: "application/zip",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/\.[^.]+$/, "") + ".zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* File header row */}
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {file.status === "done" && file.fileErrors.length === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : file.status === "error" ||
            (file.status === "done" && file.fileErrors.length > 0) ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <div
              className={cn(
                "h-4 w-4 rounded-full",
                file.status === "processing"
                  ? "bg-primary animate-pulse"
                  : "bg-muted-foreground/30",
              )}
            />
          )}
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {formatSize(file.size)}
              </span>
              {file.status === "done" &&
                file.zipFile &&
                file.zipFile.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleDownload}
                    title={t("batchExtractor.fileStatus.downloadZip")}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
            </div>
          </div>

          {/* Progress bar */}
          {(file.status === "processing" ||
            (file.status === "done" && file.progressValue < 100)) && (
            <div className="mt-1.5 h-1.5 w-full bg-primary/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${file.progressValue}%` }}
              />
            </div>
          )}

          {/* Status messages */}
          {file.status === "processing" && file.progressMessage && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("batchExtractor.fileStatus.processing")}
            </p>
          )}
          {file.status === "done" && file.songs.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {file.songs.length === 1
                ? t("batchExtractor.fileStatus.songsExtracted", {
                    count: file.songs.length,
                  })
                : t("batchExtractor.fileStatus.songsExtracted_plural", {
                    count: file.songs.length,
                  })}
            </p>
          )}
          {file.status === "error" && file.errorMessage && (
            <p className="text-xs text-destructive mt-0.5">
              {file.errorMessage}
            </p>
          )}
        </div>
      </div>

      {/* Per-file extraction errors */}
      {file.fileErrors.length > 0 && (
        <div className="ml-7 space-y-1.5">
          {file.fileErrors.map((err, i) => (
            <Alert key={i} variant="destructive" className="py-2">
              <AlertCircle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">{err.log}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Extracted songs */}
      {file.songs.length > 0 && (
        <div className="ml-7 space-y-1.5">
          {file.songs.map((song, i) => (
            <SongRow key={i} song={song} instruments={instruments} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function BatchExtractorContent() {
  const { t } = useTranslations();
  const [files, setFiles] = useState<FileState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const instruments = [
    { key: "guitar", label: t("batchExtractor.instruments.guitar") },
    { key: "bass", label: t("batchExtractor.instruments.bass") },
    { key: "drums", label: t("batchExtractor.instruments.drums") },
    { key: "keys", label: t("batchExtractor.instruments.keys") },
    { key: "vocals", label: t("batchExtractor.instruments.vocals") },
  ];

  const processFile = useCallback(
    async (fileState: FileState, file: File) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileState.id
            ? { ...f, status: "processing", progressValue: 0 }
            : f,
        ),
      );

      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        // Dynamically import to keep it out of the initial bundle
        const { default: batchExtract } =
          await import("@/services/batch-extractor/extractor");

        const result = await batchExtract(
          { fileName: file.name, data },
          (message, value) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileState.id
                  ? { ...f, progressMessage: message, progressValue: value }
                  : f,
              ),
            );
          },
        );

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileState.id
              ? {
                  ...f,
                  status: "done",
                  progressValue: 100,
                  songs: result.success,
                  fileErrors: result.error,
                  zipFile: result.zipFile,
                  progressMessage: "",
                }
              : f,
          ),
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileState.id
              ? {
                  ...f,
                  status: "error",
                  progressValue: 100,
                  errorMessage:
                    err instanceof Error
                      ? err.message
                      : t("batchExtractor.fileStatus.failedToProcess"),
                  progressMessage: "",
                }
              : f,
          ),
        );
      }
    },
    [t],
  );

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const fileStates: FileState[] = newFiles.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        status: "queued" as const,
        progressMessage: "",
        progressValue: 0,
        songs: [],
        fileErrors: [],
      }));

      setFiles((prev) => [...prev, ...fileStates]);

      // Process all in parallel
      fileStates.forEach((fileState, i) => {
        processFile(fileState, newFiles[i]);
      });
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length > 0) addFiles(dropped);
    },
    [addFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files || []);
      if (selected.length > 0) addFiles(selected);
      e.target.value = "";
    },
    [addFiles],
  );

  const totalSongs = files.reduce((acc, f) => acc + f.songs.length, 0);
  const allDone =
    files.length > 0 &&
    files.every((f) => f.status === "done" || f.status === "error");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex flex-1 items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
            <FileArchive className="h-5 w-5 text-primary" />
          </div>
          <div className="w-full">
            <div className="flex justify-between gap-2">
              <h1 className="text-2xl font-bold leading-none">
                {t("batchExtractor.title")}
              </h1>
              <a
                href="https://github.com/trojannemo/Nautilus"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  role="img"
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 fill-current"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
                trojannemo/Nautilus
              </a>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("batchExtractor.description")}
            </p>
          </div>
        </div>
      </div>

      {/* Dropzone */}
      <Card>
        <CardHeader>
          <CardTitle>{t("batchExtractor.dropFiles.title")}</CardTitle>
          <CardDescription>
            {t("batchExtractor.dropFiles.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="button"
            tabIndex={0}
            className={cn(
              "relative border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer select-none",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="flex flex-col items-center gap-4">
              <div
                className={cn(
                  "flex items-center justify-center h-14 w-14 rounded-full transition-colors",
                  isDragging ? "bg-primary/20" : "bg-muted",
                )}
              >
                <Upload
                  className={cn(
                    "h-7 w-7 transition-colors",
                    isDragging ? "text-primary" : "text-muted-foreground",
                  )}
                />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isDragging
                    ? t("batchExtractor.dragDrop.release")
                    : t("batchExtractor.dragDrop.drag")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("batchExtractor.dragDrop.browse")}
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </CardContent>
      </Card>

      {/* Processing queue */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("batchExtractor.processingQueue.title")}</CardTitle>
              {allDone && totalSongs > 0 && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1.5"
                >
                  <Music className="h-3 w-3" />
                  {totalSongs === 1
                    ? t("batchExtractor.processingQueue.songsExtracted", {
                        count: totalSongs,
                      })
                    : t(
                        "batchExtractor.processingQueue.songsExtracted_plural",
                        { count: totalSongs },
                      )}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-5 divide-y divide-border">
              {files.map((file, i) => (
                <div key={file.id} className={i > 0 ? "pt-5" : ""}>
                  <FileItem file={file} instruments={instruments} t={t} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BatchExtractorPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <BatchExtractorContent />
    </ProtectedRoute>
  );
}
