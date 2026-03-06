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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Loader2,
  Upload,
  Cog,
  Database,
  Check,
} from "lucide-react";
import {
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperSeparator,
  StepperNav,
} from "@/components/reui/stepper";
import { toast } from "sonner";

interface ProviderProgress {
  page?: number;
  songsFetched?: number;
  phase?: string;
  progress?: number;
  stats?: { added: number; updated: number; ignored: number };
  details?: {
    added: SongDetail[];
    updated: SongDetail[];
    ignored: Record<string, SongDetail[]>;
  };
  error?: string;
}

interface ProviderStatus {
  name: string;
  isRunning: boolean;
  progress: ProviderProgress | null;
  lastSuccessfulFetch: string | null;
  songCount?: number;
}

interface SongDetail {
  title: string;
  artist: string;
}

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

const FETCH_STEPS = [
  { icon: CloudDownload },
  { icon: Cog },
  { icon: Database },
  { icon: Check },
];

function getPhaseLabel(
  phase: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const phaseMap: Record<string, string> = {
    "Saving songs": "saving",
    "Deduplicating songs": "deduplicating",
    "Fetching existing songs": "fetching_existing",
    "Pre-resolving metadata": "resolving",
    "Building transactions": "building",
  };
  const key = phaseMap[phase] ?? phase;
  return t(`provider.phases.${key}`);
}

function getStepFromPhase(phase: string | undefined): number {
  switch (phase) {
    case "fetching":
      return 1;
    case "processing":
    case "Deduplicating songs":
    case "Fetching existing songs":
    case "Pre-resolving metadata":
    case "Building transactions":
      return 2;
    case "Saving songs":
      return 3;
    case "completed":
      return 5;
    default:
      return 1;
  }
}

function ProviderCard({
  src,
  status,
  fetching,
  onFetch,
  onUpload,
  t,
}: {
  src: string;
  status: ProviderStatus | undefined;
  fetching: boolean;
  onFetch: () => void;
  onUpload: (file: File) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const isRunning = status?.isRunning ?? false;
  const progress = status?.progress;
  const songCount = status?.songCount ?? 0;
  const relativeTime = useRelativeTime(status?.lastSuccessfulFetch ?? null);
  const hasEverFetched = !!status?.lastSuccessfulFetch;
  const isCompleted = !isRunning && progress?.phase === "completed";
  const isFailed = !isRunning && progress?.phase === "failed";

  const statusIcon = isRunning ? (
    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
  ) : isFailed ? (
    <AlertCircle className="h-3 w-3 text-red-500" />
  ) : isCompleted || hasEverFetched ? (
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
            {src === "enchor" ? "Enchor.us" : "Rhythmverse"}
          </span>
        </div>
        <div className="flex gap-0.5 items-center shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onFetch}
                disabled={isRunning || fetching}
              >
                <CloudDownload className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              {t("provider.fetchFromApi")}
            </TooltipContent>
          </Tooltip>
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
  const [detailType, setDetailType] = useState<
    "added" | "updated" | "ignored" | null
  >(null);
  const [detailData, setDetailData] = useState<
    SongDetail[] | Record<string, SongDetail[]> | null
  >(null);

  const openDetails = (
    type: "added" | "updated" | "ignored",
    details?: ProviderProgress["details"],
  ) => {
    // Use provided details (from fetch flow) or fall back to upload details
    const source =
      details ??
      (uploadProgress?.status === "completed"
        ? uploadProgress?.details
        : undefined);
    if (!source) return;

    setDetailType(type);
    setDetailData(source[type] || null);
  };

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

        if (data.type === "drained") {
          setProviderStatuses((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
              next[key] = { ...next[key], isRunning: false };
            }
            return next;
          });
          return;
        }

        if (data.type === "running" && data.source) {
          setProviderStatuses((prev) => ({
            ...prev,
            [data.source]: {
              ...prev[data.source],
              name: data.source,
              isRunning: data.isRunning,
              progress: prev[data.source]?.progress ?? null,
              lastSuccessfulFetch:
                prev[data.source]?.lastSuccessfulFetch ?? null,
            },
          }));
          return;
        }

        if (data.source && data.phase) {
          setProviderStatuses((prev) => ({
            ...prev,
            [data.source]: {
              ...prev[data.source],
              name: data.source,
              isRunning: data.phase !== "completed" && data.phase !== "failed",
              progress: {
                page: data.page,
                songsFetched: data.songsFetched,
                phase: data.phase,
                progress: data.progress,
                stats: data.stats,
                details: data.details,
                error: data.error,
              },
              lastSuccessfulFetch:
                data.lastSuccessfulFetch ??
                prev[data.source]?.lastSuccessfulFetch ??
                null,
            },
          }));
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

  const startFetch = async (source: string) => {
    setFetching((prev) => ({ ...prev, [source]: true }));
    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start fetch");
      }

      // Immediately show stepper before first SSE event arrives
      setProviderStatuses((prev) => ({
        ...prev,
        [source]: {
          ...prev[source],
          name: source,
          isRunning: true,
          progress: { phase: "fetching", page: 0, songsFetched: 0 },
          lastSuccessfulFetch: prev[source]?.lastSuccessfulFetch ?? null,
        },
      }));

      toast.success(`Started fetching from ${source}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start fetch",
      );
    } finally {
      setFetching((prev) => ({ ...prev, [source]: false }));
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

  const clearFetchProgress = (source: string) => {
    setProviderStatuses((prev) => ({
      ...prev,
      [source]: {
        ...prev[source],
        progress: null,
      },
    }));
  };

  // Providers with active fetch progress (running, completed, or failed)
  const fetchProgressSources = ["enchor", "rhythmverse"].filter((src) => {
    const status = providerStatuses[src];
    if (!status?.progress?.phase) return false;
    return (
      status.isRunning ||
      status.progress.phase === "completed" ||
      status.progress.phase === "failed"
    );
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

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 pt-6">
        <div className="grid grid-cols-2 gap-3">
          {["enchor", "rhythmverse"].map((src) => (
            <ProviderCard
              key={src}
              src={src}
              status={providerStatuses[src]}
              fetching={fetching[src] ?? false}
              onFetch={() => startFetch(src)}
              onUpload={(file) => handleUpload(file, src)}
              t={t}
            />
          ))}
        </div>

        {fetchProgressSources.map((src) => {
          const status = providerStatuses[src];
          const progress = status?.progress;
          if (!progress) return null;

          const isRunning = status.isRunning;
          const isCompleted = !isRunning && progress.phase === "completed";
          const isFailed = !isRunning && progress.phase === "failed";
          const phaseStatus = isRunning
            ? "running"
            : (progress.phase ?? "unknown");

          return (
            <div key={src} className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t("provider.fetchStatus")}{" "}
                  <span className="capitalize">
                    {src === "enchor" ? "Enchor.us" : "Rhythmverse"}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(phaseStatus)}>
                    {t(`provider.phases.${phaseStatus}`, {
                      default: phaseStatus,
                    })}
                  </Badge>
                  {(isCompleted || isFailed) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearFetchProgress(src)}
                      className="h-6 px-2 text-xs"
                    >
                      {t("provider.clear")}
                    </Button>
                  )}
                </div>
              </div>

              <Stepper
                value={getStepFromPhase(progress.phase)}
                indicators={{
                  loading: <Loader2 className="size-2.5 animate-spin" />,
                }}
              >
                <StepperNav>
                  {FETCH_STEPS.map((step, i) => (
                    <StepperItem
                      key={`step-${i + 1}`}
                      step={i + 1}
                      loading={
                        isRunning && getStepFromPhase(progress.phase) === i + 1
                      }
                    >
                      <StepperTrigger asChild>
                        <StepperIndicator className="size-5">
                          <step.icon className="size-2.5" />
                        </StepperIndicator>
                      </StepperTrigger>
                      {i < FETCH_STEPS.length - 1 && (
                        <StepperSeparator className="bg-accent data-[state=completed]:bg-primary" />
                      )}
                    </StepperItem>
                  ))}
                </StepperNav>
              </Stepper>

              {isRunning && progress.phase === "fetching" && (
                <p className="text-[11px] text-muted-foreground text-center">
                  {t("provider.status.fetched", {
                    page: progress.page ?? 0,
                    count: progress.songsFetched ?? 0,
                  })}
                </p>
              )}

              {isRunning &&
                progress.phase &&
                !["fetching", "completed", "failed"].includes(
                  progress.phase,
                ) && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    {getPhaseLabel(progress.phase, t)}
                  </p>
                )}

              {isRunning && progress.stats && (
                <div className="flex gap-2 text-[10px] justify-center">
                  <span className="text-green-600 dark:text-green-400">
                    +{progress.stats.added}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400">
                    ~{progress.stats.updated}
                  </span>
                  <span className="text-muted-foreground">
                    ={progress.stats.ignored}
                  </span>
                </div>
              )}

              {isCompleted && progress.stats && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div
                    onClick={() => openDetails("added", progress.details)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetails("added", progress.details);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="text-center p-2 bg-green-50 dark:bg-green-950 rounded cursor-pointer hover:opacity-80"
                  >
                    <div className="font-medium text-green-600 dark:text-green-400">
                      {progress.stats.added}
                    </div>
                    <div className="text-xs text-green-500 dark:text-green-300">
                      {t("provider.stats.added")}
                    </div>
                  </div>
                  <div
                    onClick={() => openDetails("updated", progress.details)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetails("updated", progress.details);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded cursor-pointer hover:opacity-80"
                  >
                    <div className="font-medium text-blue-600 dark:text-blue-400">
                      {progress.stats.updated}
                    </div>
                    <div className="text-xs text-blue-500 dark:text-blue-300">
                      {t("provider.stats.updated")}
                    </div>
                  </div>
                  <div
                    onClick={() => openDetails("ignored", progress.details)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetails("ignored", progress.details);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="text-center p-2 bg-orange-50 dark:bg-orange-950 rounded cursor-pointer hover:opacity-80"
                  >
                    <div className="font-medium text-gray-600 dark:text-gray-400">
                      {progress.stats.ignored}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-300">
                      {t("provider.stats.ignored")}
                    </div>
                  </div>
                </div>
              )}

              {isFailed && progress.error && (
                <p className="text-sm text-red-500">{progress.error}</p>
              )}
            </div>
          );
        })}

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
                  onClick={() => openDetails("added")}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetails("added"); } }}
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
                  onClick={() => openDetails("updated")}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetails("updated"); } }}
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
                  onClick={() => openDetails("ignored")}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetails("ignored"); } }}
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
          open={!!detailType}
          onOpenChange={(open) => !open && setDetailType(null)}
        >
          <DialogContent className="max-w-md flex flex-col">
            <DialogHeader>
              <DialogTitle className="capitalize">
                {detailType && t(`provider.stats.${detailType}`)}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[calc(100dvh-14rem)] pr-2">
              {detailType === "ignored" && detailData ? (
                Object.entries(detailData).map(([reason, songs]) => (
                  <Collapsible key={reason} className="mb-2 last:mb-0">
                    <CollapsibleTrigger className="w-full flex items-center gap-2 font-medium text-xs bg-muted/50 p-2 rounded cursor-pointer hover:bg-muted/70 sticky top-0 backdrop-blur-sm group text-left transition-colors">
                      <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90 text-muted-foreground" />
                      <span>
                        {t(`provider.reasons.${reason.toLowerCase()}`, {
                          default: reason,
                        })}{" "}
                        ({(songs as SongDetail[]).length})
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-1 pl-4 pt-1 pb-2 pr-2">
                        {(songs as SongDetail[]).map((song) => (
                          <div
                            key={`${song.title}-${song.artist}`}
                            className="text-[10px] text-muted-foreground truncate"
                            title={`${song.title} - ${song.artist}`}
                          >
                            {song.title} - {song.artist}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))
              ) : detailData && Array.isArray(detailData) ? (
                <div className="space-y-1">
                  {detailData.map((song: SongDetail) => (
                    <div
                      key={`${song.title}-${song.artist}`}
                      className="text-[10px] text-muted-foreground truncate"
                      title={`${song.title} - ${song.artist}`}
                    >
                      {song.title} - {song.artist}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground p-4">
                  {t("provider.phases.noDetailsAvailable")}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
