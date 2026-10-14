"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useTranslations } from "@/hooks/use-translations";
import {
  CloudDownload,
  ChevronRight,
  Clock,
  Music,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Upload,
  RefreshCcw,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import type { FetchRunSnapshot, FetchSongDetail, ProviderSource } from "@/types";
import { FetchRunView, isActiveRun, type RunDetailType } from "./FetchRunView";
import { RunHistory } from "./RunHistory";

interface ProviderStatus {
  name: string;
  isRunning: boolean;
  run: FetchRunSnapshot | null;
  lastSuccessfulFetch: string | null;
  songCount?: number;
}

type SongDetail = FetchSongDetail;

interface JobProgress {
  status: string;
  progress: number;
  currentSource?: string;
  currentPage?: number;
  totalPages?: number;
  songsProcessed?: number;
  totalSongs?: number;
  totalAvailable?: number;
  totalFetched?: number;
  totalSaved?: number;
  jobsCompleted?: number;
  jobsTotal?: number;
  failedJobIndex?: number;
  errors?: string[];
  phase?: string;
  added?: number;
  updated?: number;
  ignored?: number;
  details?: {
    added: SongDetail[];
    updated: SongDetail[];
    ignored: Record<string, SongDetail[]>;
  };
}

const SOURCES: ProviderSource[] = ["enchor", "rhythmverse"];
const SOURCE_LABELS: Record<ProviderSource, string> = {
  enchor: "Enchor.us",
  rhythmverse: "Rhythmverse",
};

function useRelativeTime(date: string | null) {
  const { t } = useTranslations();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!date) return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [date]);

  return useMemo(() => {
    if (!date) return null;
    const diff = now - new Date(date).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return t("common.time.justNow");
    if (minutes < 60) return t("common.time.minutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("common.time.hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t("common.time.daysAgo", { count: days });
    const months = Math.floor(days / 30);
    return t("common.time.monthsAgo", { count: months });
  }, [date, now, t]);
}

function ProviderCard({
  src,
  status,
  fetching,
  stopping,
  onFetch,
  onFullFetch,
  onStop,
  onUpload,
  t,
}: {
  src: ProviderSource;
  status: ProviderStatus | undefined;
  fetching: boolean;
  stopping: boolean;
  onFetch: () => void;
  onFullFetch: () => void;
  onStop: () => void;
  onUpload: (file: File) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const run = status?.run ?? null;
  const isRunning = (status?.isRunning ?? false) || isActiveRun(run);
  const songCount = status?.songCount ?? 0;
  const relativeTime = useRelativeTime(status?.lastSuccessfulFetch ?? null);
  const hasEverFetched = !!status?.lastSuccessfulFetch;
  const hasGaps = !isRunning && (run?.gaps.length ?? 0) > 0;
  const isFailed = !isRunning && (run?.status === "failed" || run?.status === "interrupted");

  const statusIcon = isRunning ? (
    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
  ) : isFailed ? (
    <AlertCircle className="h-3 w-3 text-red-500" />
  ) : hasGaps ? (
    <AlertTriangle className="h-3 w-3 text-amber-500" />
  ) : hasEverFetched ? (
    <CheckCircle2 className="h-3 w-3 text-green-500" />
  ) : (
    <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
  );

  return (
    <div className="bg-muted/50 p-3 rounded-lg border text-sm space-y-2.5 min-w-0 overflow-hidden">
      {/* Header row */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 min-w-0">
          {statusIcon}
          <span className="text-xs font-semibold tracking-wide uppercase truncate">
            {SOURCE_LABELS[src]}
          </span>
        </div>
        <div className="flex gap-0.5 items-center shrink-0">
          {isRunning ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onStop}
                  disabled={stopping}
                >
                  <Square className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {t("provider.actions.stop")}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onFetch}
                  disabled={fetching}
                >
                  <CloudDownload className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {t("provider.fetchFromApi")}
              </TooltipContent>
            </Tooltip>
          )}
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={isRunning || fetching}
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {t("provider.actions.fullRefetch")}
              </TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("provider.actions.fullRefetchTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("provider.actions.fullRefetchDescription", { source: SOURCE_LABELS[src] })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("provider.actions.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={onFullFetch}>
                  {t("provider.actions.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <input
            type="file"
            id={`upload-${src}`}
            className="hidden"
            accept=".zip"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() =>
                  document.getElementById(`upload-${src}`)?.click()
                }
              >
                <Upload className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              {t("provider.uploadZip")}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Info row — always visible */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Music className="h-3 w-3" />
          {songCount.toLocaleString()} {t("provider.songs")}
        </span>
        <span className="text-muted-foreground/30">|</span>
        {hasEverFetched ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 cursor-default">
                <Clock className="h-3 w-3" />
                {relativeTime}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              {new Date(status!.lastSuccessfulFetch!).toLocaleString()}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="flex items-center gap-1 italic">
            <Clock className="h-3 w-3" />
            {t("provider.never")}
          </span>
        )}
      </div>

      <RunHistory
        source={src}
        refreshKey={`${run?.runId ?? ""}:${run?.status ?? ""}`}
        t={t}
      />
    </div>
  );
}

function SongList({ songs }: { songs: SongDetail[] }) {
  return (
    <div className="space-y-1">
      {songs.map((song, i) => (
        <div
          key={`${song.title}-${song.artist}-${i}`}
          className="text-[10px] text-muted-foreground truncate"
          title={`${song.title} - ${song.artist}`}
        >
          {song.title} - {song.artist}
        </div>
      ))}
    </div>
  );
}

export default function ProviderPanel() {
  const { t } = useTranslations();
  const [uploadProgress, setUploadProgress] = useState<JobProgress | null>(
    null,
  );
  const [providerStatuses, setProviderStatuses] = useState<
    Record<string, ProviderStatus>
  >({});
  const [fetching, setFetching] = useState<Record<string, boolean>>({});
  const [stopping, setStopping] = useState<Record<string, boolean>>({});
  const [dismissedRuns, setDismissedRuns] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<{
    type: RunDetailType;
    source: ProviderSource | null;
  } | null>(null);

  // SSE connection for real-time provider updates
  useEffect(() => {
    const eventSource = new EventSource("/api/providers/events");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "init") {
          setProviderStatuses(data.providers);
          return;
        }

        if (data.type === "snapshot" && data.source && data.run) {
          const run = data.run as FetchRunSnapshot;
          const active = isActiveRun(run);
          if (!active) setStopping((prev) => ({ ...prev, [run.source]: false }));
          setProviderStatuses((prev) => {
            const current = prev[run.source];
            const fetchedNow =
              run.status === "completed" || run.status === "completed_with_errors";
            return {
              ...prev,
              [run.source]: {
                ...current,
                name: run.source,
                isRunning: active,
                run,
                lastSuccessfulFetch:
                  fetchedNow && run.finishedAt
                    ? run.finishedAt
                    : (current?.lastSuccessfulFetch ?? null),
                songCount: run.songCount ?? current?.songCount,
              },
            };
          });
        }
      } catch (err) {
        console.error("Error parsing SSE event:", err);
      }
    };

    eventSource.onerror = () => {};

    return () => {
      eventSource.close();
    };
  }, []);

  const callProviders = async (
    method: "POST" | "DELETE",
    body: Record<string, string>,
  ) => {
    const response = await fetch("/api/providers", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  };

  const startFetch = async (
    source: ProviderSource,
    options: { mode?: "incremental" | "full"; action?: "retry_gaps" } = {},
  ) => {
    setFetching((prev) => ({ ...prev, [source]: true }));
    try {
      await callProviders("POST", { source, ...options });
      setDismissedRuns((prev) => ({ ...prev, [source]: "" }));
      toast.success(
        options.action === "retry_gaps"
          ? t("provider.actions.retryStarted", { source: SOURCE_LABELS[source] })
          : t("provider.actions.started", { source: SOURCE_LABELS[source] }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start fetch",
      );
    } finally {
      setFetching((prev) => ({ ...prev, [source]: false }));
    }
  };

  const stopFetch = async (source: ProviderSource) => {
    setStopping((prev) => ({ ...prev, [source]: true }));
    try {
      await callProviders("DELETE", { source });
      toast.info(t("provider.actions.stopRequested"));
    } catch (error) {
      setStopping((prev) => ({ ...prev, [source]: false }));
      toast.error(error instanceof Error ? error.message : "Failed to stop");
    }
  };

  const handleUpload = async (file: File, source: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", source);

    setUploadProgress({
      status: "uploading",
      progress: 0,
      currentSource: source,
    });

    try {
      const response = await fetch("/api/providers/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmedLine.slice(6));

            if (data.type === "progress") {
              setUploadProgress({
                status: "processing",
                progress: data.progress,
                currentSource: source,
                phase: data.phase,
                added: data.stats?.added,
                updated: data.stats?.updated,
                ignored: data.stats?.ignored,
              });
            } else if (data.type === "complete") {
              setUploadProgress({
                status: "completed",
                progress: 100,
                currentSource: source,
                added: data.stats?.added,
                updated: data.stats?.updated,
                ignored: data.stats?.ignored,
                details: data.stats?.details,
              });
              toast.success(
                t("provider.uploadCompleted", {
                  added: data.stats?.added,
                  updated: data.stats?.updated,
                  ignored: data.stats?.ignored,
                }),
              );
            } else if (data.type === "error") {
              throw new Error(data.message);
            }
          } catch (parseError) {
            console.error("Error parsing SSE data:", parseError);
          }
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        t("provider.uploadFailed", {
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      setUploadProgress(null);
    }
  };

  // Runs to show: active ones always, finished ones until cleared
  const visibleRuns = SOURCES.flatMap((src) => {
    const run = providerStatuses[src]?.run;
    if (!run) return [];
    if (!isActiveRun(run) && dismissedRuns[src] === `${run.runId}:${run.status}`) return [];
    return [run];
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
      case "fetching":
      case "processing":
        return "bg-blue-500";
      case "starting":
        return "bg-yellow-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  // Detail dialog content: a finished fetch run, or the upload
  const detailRun = detail?.source ? providerStatuses[detail.source]?.run : null;
  const uploadDetails =
    uploadProgress?.status === "completed" ? uploadProgress.details : undefined;
  const detailLists = detail?.source ? detailRun?.details : uploadDetails;

  const renderDetail = () => {
    if (!detail) return null;
    if (detail.type === "gaps") {
      const gaps = detailRun?.gaps ?? [];
      return (
        <div className="space-y-2">
          {gaps.map((gap, i) => (
            <div key={`${gap.page}-${i}`} className="rounded border p-2 text-xs space-y-0.5">
              <div className="flex justify-between gap-2 font-medium">
                <span>{t("provider.gaps.page", { page: gap.page })}</span>
                {gap.attempts > 0 && (
                  <span className="text-muted-foreground font-normal">
                    {t("provider.gaps.attempts", { count: gap.attempts })}
                  </span>
                )}
              </div>
              <p className="text-red-600 dark:text-red-400 break-words">{gap.error}</p>
              {(gap.upperTs || gap.lowerTs) && (
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {gap.upperTs ? new Date(gap.upperTs).toLocaleString() : "…"} →{" "}
                  {gap.lowerTs ? new Date(gap.lowerTs).toLocaleString() : "…"}
                </p>
              )}
            </div>
          ))}
        </div>
      );
    }
    if (detail.type === "issues") {
      const issues = detailRun?.details?.issues ?? [];
      if (issues.length === 0) return null;
      return (
        <div className="space-y-1.5">
          {issues.map((issue, i) => (
            <div key={`${issue.page}-${issue.index}-${i}`} className="text-[11px] border-b pb-1.5 last:border-0">
              <div className="truncate">
                {issue.title || issue.artist
                  ? `${issue.title ?? "?"} - ${issue.artist ?? "?"}`
                  : t("provider.issues.unknown")}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {t("provider.issues.entry", { page: issue.page, index: issue.index + 1 })} ·{" "}
                <span className="text-amber-600 dark:text-amber-400">{issue.reason}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (detail.type === "ignored") {
      const groups = detailLists?.ignored ?? {};
      if (Object.keys(groups).length === 0) return null;
      return Object.entries(groups).map(([reason, songs]) => (
        <Collapsible key={reason} className="mb-2 last:mb-0">
          <CollapsibleTrigger className="w-full flex items-center gap-2 font-medium text-xs bg-muted/50 p-2 rounded cursor-pointer hover:bg-muted/70 sticky top-0 backdrop-blur-sm group text-left transition-colors">
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90 text-muted-foreground" />
            <span>
              {t(`provider.reasons.${reason.toLowerCase()}`)} ({songs.length})
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pl-4 pt-1 pb-2 pr-2">
              <SongList songs={songs} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      ));
    }
    const songs = detailLists?.[detail.type] ?? [];
    return songs.length > 0 ? <SongList songs={songs} /> : null;
  };

  const detailTitle =
    detail?.type === "gaps"
      ? t("provider.gaps.title")
      : detail?.type === "issues"
        ? t("provider.issues.title")
        : detail
          ? t(`provider.stats.${detail.type}`)
          : "";
  const detailHint =
    detail?.type === "gaps"
      ? t("provider.gaps.hint")
      : detail?.type === "issues"
        ? t("provider.issues.hint")
        : null;
  const detailBody = renderDetail();
  const truncated = !!detail?.source && !!detailRun?.details?.truncated && detail.type !== "gaps";

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOURCES.map((src) => (
            <ProviderCard
              key={src}
              src={src}
              status={providerStatuses[src]}
              fetching={fetching[src] ?? false}
              stopping={stopping[src] ?? false}
              onFetch={() => startFetch(src)}
              onFullFetch={() => startFetch(src, { mode: "full" })}
              onStop={() => stopFetch(src)}
              onUpload={(file) => handleUpload(file, src)}
              t={t}
            />
          ))}
        </div>

        {visibleRuns.map((run) => (
          <FetchRunView
            key={run.source}
            run={run}
            label={SOURCE_LABELS[run.source]}
            stopping={stopping[run.source] ?? false}
            onStop={() => stopFetch(run.source)}
            onRetry={() => startFetch(run.source, { action: "retry_gaps" })}
            onClear={() =>
              setDismissedRuns((prev) => ({
                ...prev,
                [run.source]: `${run.runId}:${run.status}`,
              }))
            }
            onOpenDetails={(type) => setDetail({ type, source: run.source })}
            t={t}
          />
        ))}

        {uploadProgress && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t("provider.uploadStatus")}
              </span>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(uploadProgress.status)}>
                  {t(`provider.phases.${uploadProgress.status}`, {
                    default: uploadProgress.status,
                  })}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadProgress(null)}
                  className="h-6 px-2 text-xs"
                >
                  {t("provider.clear")}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{t("provider.uploadProgress")}</span>
                <span>{uploadProgress.progress || 0}%</span>
              </div>
              <Progress value={uploadProgress.progress || 0} />
            </div>

            {uploadProgress.currentSource && (
              <div className="flex justify-between text-sm">
                <span>{t("provider.source")}</span>
                <span className="capitalize">
                  {uploadProgress.currentSource}
                </span>
              </div>
            )}

            {uploadProgress.phase && (
              <div className="flex justify-between text-sm">
                <span>{t("provider.phase")}</span>
                <span className="capitalize">
                  {t(`provider.phases.${uploadProgress.phase?.toLowerCase()}`, {
                    default: uploadProgress.phase,
                  })}
                </span>
              </div>
            )}

            {(uploadProgress.added !== undefined ||
              uploadProgress.updated !== undefined ||
              uploadProgress.ignored !== undefined) && (
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div
                  onClick={() => setDetail({ type: "added", source: null })}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail({ type: "added", source: null }); } }}
                  role="button"
                  tabIndex={uploadProgress.status === "completed" ? 0 : -1}
                  className={`text-center p-2 bg-green-50 dark:bg-green-950 rounded ${
                    uploadProgress.status === "completed"
                      ? "cursor-pointer hover:opacity-80"
                      : ""
                  }`}
                >
                  <div className="font-medium text-green-600 dark:text-green-400">
                    {uploadProgress.added || 0}
                  </div>
                  <div className="text-xs text-green-500 dark:text-green-300">
                    {t("provider.stats.added")}
                  </div>
                </div>
                <div
                  onClick={() => setDetail({ type: "updated", source: null })}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail({ type: "updated", source: null }); } }}
                  role="button"
                  tabIndex={uploadProgress.status === "completed" ? 0 : -1}
                  className={`text-center p-2 bg-blue-50 dark:bg-blue-950 rounded ${
                    uploadProgress.status === "completed"
                      ? "cursor-pointer hover:opacity-80"
                      : ""
                  }`}
                >
                  <div className="font-medium text-blue-600 dark:text-blue-400">
                    {uploadProgress.updated || 0}
                  </div>
                  <div className="text-xs text-blue-500 dark:text-blue-300">
                    {t("provider.stats.updated")}
                  </div>
                </div>
                <div
                  onClick={() => setDetail({ type: "ignored", source: null })}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail({ type: "ignored", source: null }); } }}
                  role="button"
                  tabIndex={uploadProgress.status === "completed" ? 0 : -1}
                  className={`text-center p-2 bg-gray-50 dark:bg-gray-950 rounded ${
                    uploadProgress.status === "completed"
                      ? "cursor-pointer hover:opacity-80"
                      : ""
                  }`}
                >
                  <div className="font-medium text-gray-600 dark:text-gray-400">
                    {uploadProgress.ignored || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-300">
                    {t("provider.stats.ignored")}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <Dialog
          open={!!detail}
          onOpenChange={(open) => !open && setDetail(null)}
        >
          <DialogContent className="max-w-md flex flex-col">
            <DialogHeader>
              <DialogTitle className="capitalize">{detailTitle}</DialogTitle>
              {detailHint && <DialogDescription>{detailHint}</DialogDescription>}
            </DialogHeader>
            <div className="overflow-y-auto max-h-[calc(100dvh-14rem)] pr-2">
              {detailBody ?? (
                <div className="text-center text-sm text-muted-foreground p-4">
                  {t("provider.phases.noDetailsAvailable")}
                </div>
              )}
            </div>
            {truncated && (
              <p className="text-[10px] text-muted-foreground">
                {t("provider.truncated", { count: 1000 })}
              </p>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
