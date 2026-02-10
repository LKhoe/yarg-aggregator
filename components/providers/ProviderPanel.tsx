"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslations } from "@/hooks/use-translations";
import { CloudDownload, RefreshCw, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface ProviderProgress {
  page?: number;
  songsFetched?: number;
  phase?: string;
  progress?: number;
  stats?: { added: number; updated: number; ignored: number };
  error?: string;
}

interface ProviderStatus {
  name: string;
  isRunning: boolean;
  progress: ProviderProgress | null;
  lastSuccessfulFetch: string | null;
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
    added: any[];
    updated: any[];
    ignored: Record<string, any[]>;
  };
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
  const [detailData, setDetailData] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const openDetails = (type: "added" | "updated" | "ignored") => {
    if (uploadProgress?.status !== "completed") return;

    setDetailType(type);
    const data = uploadProgress?.details?.[type];
    setDetailData(data || null);
  };

  const fetchProviderStatuses = useCallback(async () => {
    try {
      const response = await fetch("/api/providers");
      if (response.ok) {
        const data: ProviderStatus[] = await response.json();
        const statusMap: Record<string, ProviderStatus> = {};
        for (const provider of data) {
          statusMap[provider.name] = provider;
        }
        setProviderStatuses(statusMap);

        // Check if any provider is still running
        const anyRunning = data.some((p) => p.isRunning);
        if (!anyRunning && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch (error) {
      console.error("Error fetching provider statuses:", error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchProviderStatuses();
  }, [fetchProviderStatuses]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
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

      toast.success(`Started fetching from ${source}`);

      // Start polling for progress
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchProviderStatuses, 2000);
      }
      // Immediate status refresh
      await fetchProviderStatuses();
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

      setUploadProgress({
        status: "uploading",
        progress: 0,
        currentSource: source,
      });

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last line in the buffer as it might be incomplete
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
              // Removed auto-dismiss timeout
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          {t("provider.title")}
        </CardTitle>
        <CardDescription>{t("provider.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 mt-2">
            {["enchor", "rhythmverse"].map((src) => {
              const status = providerStatuses[src];
              const isRunning = status?.isRunning ?? false;
              const progress = status?.progress;

              return (
                <div
                  key={src}
                  className="bg-muted/50 p-2 rounded-md border text-sm"
                >
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">
                      {src === "enchor" ? "Enchor.us" : "Rhythmverse"}
                    </p>
                    <div className="flex gap-1 items-center">
                      {isRunning && (
                        <Badge
                          className={getStatusColor(
                            progress?.phase ?? "running",
                          )}
                          variant="secondary"
                        >
                          {progress?.phase === "running"
                            ? t("provider.status.running")
                            : progress?.phase === "completed"
                              ? t("provider.phases.completed")
                              : progress?.phase}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => startFetch(src)}
                        disabled={isRunning || fetching[src]}
                        title="Fetch from API"
                      >
                        <CloudDownload className="w-3 h-3" />
                      </Button>
                      <input
                        type="file"
                        id={`upload-${src}`}
                        className="hidden"
                        accept=".zip"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUpload(file, src);
                          }
                          e.target.value = "";
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() =>
                          document.getElementById(`upload-${src}`)?.click()
                        }
                        title="Upload Zip"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-3 h-3"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" x2="12" y1="3" y2="15" />
                        </svg>
                      </Button>
                    </div>
                  </div>

                  {/* Fetch progress for this provider */}
                  {isRunning && progress && (
                    <div className="mt-2 space-y-1">
                      {progress.phase === "fetching" && (
                        <p className="text-xs text-muted-foreground">
                          {t("provider.status.fetched", {
                            page: progress.page ?? 0,
                            count: progress.songsFetched ?? 0,
                          })}
                        </p>
                      )}
                      {(progress.phase === "processing" ||
                        progress.phase === "Saving songs" ||
                        progress.phase === "Deduplicating songs" ||
                        progress.phase === "Fetching existing songs" ||
                        progress.phase === "Pre-resolving metadata" ||
                        progress.phase === "Building transactions") && (
                        <>
                          <p className="text-xs text-muted-foreground">
                            {progress?.phase &&
                            [
                              "fetching",
                              "processing",
                              "Saving songs",
                              "Deduplicating songs",
                              "Fetching existing songs",
                              "Pre-resolving metadata",
                              "Building transactions",
                            ].includes(progress.phase)
                              ? t(
                                  `provider.phases.${
                                    progress.phase === "Saving songs"
                                      ? "saving"
                                      : progress.phase === "Deduplicating songs"
                                        ? "deduplicating"
                                        : progress.phase ===
                                            "Fetching existing songs"
                                          ? "fetching_existing"
                                          : progress.phase ===
                                              "Pre-resolving metadata"
                                            ? "resolving"
                                            : progress.phase ===
                                                "Building transactions"
                                              ? "building"
                                              : progress.phase
                                  }` as any,
                                )
                              : progress.phase}
                            ...{" "}
                            {progress.progress !== undefined &&
                              `${progress.progress}%`}
                          </p>
                          {progress.progress !== undefined && (
                            <Progress
                              value={progress.progress}
                              className="h-1"
                            />
                          )}
                        </>
                      )}
                      {progress.stats && (
                        <div className="flex gap-2 text-[10px]">
                          <span className="text-green-600">
                            +{progress.stats.added}
                          </span>
                          <span className="text-blue-600">
                            ~{progress.stats.updated}
                          </span>
                          <span className="text-gray-500">
                            ={progress.stats.ignored}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show completed stats briefly */}
                  {!isRunning &&
                    progress?.phase === "completed" &&
                    progress.stats && (
                      <div className="mt-2 space-y-1">
                        <Badge className="bg-green-500" variant="secondary">
                          {t("provider.phases.completed")}
                        </Badge>
                        <div className="flex gap-2 text-[10px]">
                          <span className="text-green-600">
                            +{progress.stats.added}
                          </span>
                          <span className="text-blue-600">
                            ~{progress.stats.updated}
                          </span>
                          <span className="text-gray-500">
                            ={progress.stats.ignored}
                          </span>
                        </div>
                      </div>
                    )}

                  {/* Show failed status */}
                  {!isRunning && progress?.phase === "failed" && (
                    <div className="mt-2">
                      <Badge className="bg-red-500" variant="secondary">
                        {t("provider.phases.failed")}
                      </Badge>
                      {progress.error && (
                        <p className="text-[10px] text-red-500 mt-1 truncate">
                          {progress.error}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {uploadProgress && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t("provider.uploadStatus")}
              </span>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(uploadProgress.status)}>
                  {t(`provider.phases.${uploadProgress.status}` as any, {
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
                  {t(
                    `provider.phases.${uploadProgress.phase?.toLowerCase()}` as any,
                    {
                      default: uploadProgress.phase,
                    },
                  )}
                </span>
              </div>
            )}

            {(uploadProgress.added !== undefined ||
              uploadProgress.updated !== undefined ||
              uploadProgress.ignored !== undefined) && (
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div
                  onClick={() => openDetails("added")}
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
          <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="capitalize">
                {detailType && t(`provider.stats.${detailType}`)}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden relative">
              <ScrollArea className="h-full pr-4 max-h-[60vh]">
                {detailType === "ignored" && detailData ? (
                  Object.entries(detailData).map(([reason, songs]) => (
                    <Collapsible key={reason} className="mb-2 last:mb-0">
                      <CollapsibleTrigger className="w-full flex items-center gap-2 font-medium text-xs bg-muted/50 p-2 rounded cursor-pointer hover:bg-muted/70 sticky top-0 backdrop-blur-sm group text-left transition-colors">
                        <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90 text-muted-foreground" />
                        <span>
                          {t(`provider.reasons.${reason.toLowerCase()}`, {
                            default: reason
                          })} ({(songs as any[]).length})
                        </span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="max-h-75 overflow-y-auto space-y-1 pl-4 pt-1 pb-2 pr-2">
                          {(songs as any[]).map((song, i) => (
                            <div
                              key={i}
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
                    {detailData.map((song: any, i: number) => (
                      <div
                        key={i}
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
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
