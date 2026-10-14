"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  ChevronRight,
  CircleAlert,
  Hourglass,
  Info,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Square,
  XCircle,
} from "lucide-react";
import type {
  FetchLogEntry,
  FetchRunSnapshot,
  FetchRunStatus,
  FetchWaitState,
} from "@/types";

type T = (key: string, params?: Record<string, string | number>) => string;

export type RunDetailType = "added" | "updated" | "ignored" | "issues" | "gaps";

const STATUS_COLORS: Record<FetchRunStatus, string> = {
  queued: "bg-yellow-500",
  running: "bg-blue-500",
  completed: "bg-green-500",
  completed_with_errors: "bg-amber-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-500",
  interrupted: "bg-orange-500",
};

export const isActiveRun = (run: FetchRunSnapshot | null | undefined) =>
  run?.status === "queued" || run?.status === "running";

export function runStatusColor(status: FetchRunStatus) {
  return STATUS_COLORS[status];
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** Re-renders every `intervalMs` while `active` */
function useNow(active: boolean, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

function WaitBanner({
  wait,
  label,
  now,
  t,
}: {
  wait: FetchWaitState;
  label: string;
  now: number;
  t: T;
}) {
  const left = new Date(wait.until).getTime() - now;
  const time = formatDuration(left);
  const Icon =
    wait.reason === "rate_limit"
      ? ShieldAlert
      : wait.reason === "cooldown"
        ? Hourglass
        : RotateCcw;
  const tone =
    wait.reason === "retry"
      ? "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300"
      : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";

  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${tone}`}
    >
      <Icon className="h-4 w-4 shrink-0 mt-px" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium tabular-nums">
          {t(`provider.wait.${wait.reason}`, {
            source: label,
            page: wait.page ?? 0,
            time,
            attempt: wait.attempt ?? 0,
            max: wait.maxAttempts ?? 0,
            error: wait.error ?? "",
          })}
        </p>
        {wait.reason === "rate_limit" && wait.error && (
          <p className="opacity-75 truncate">{wait.error}</p>
        )}
      </div>
    </div>
  );
}

const PAGE_COLORS: Record<string, string> = {
  d: "bg-green-500",
  r: "bg-emerald-300 dark:bg-emerald-600 ring-1 ring-emerald-600 dark:ring-emerald-300",
  f: "bg-red-500",
  s: "bg-muted",
  ".": "bg-muted-foreground/20",
};

function PageMap({ run, active, t }: { run: FetchRunSnapshot; active: boolean; t: T }) {
  const fetched = run.pageMap.length;
  const showPending = run.mode === "full" || run.phase === "retrying_gaps";
  const count = Math.max(
    fetched,
    showPending && run.totalPages ? run.totalPages : 0,
    active && run.currentPage ? run.currentPage : 0,
  );
  if (count === 0) return null;

  const current = active ? run.currentPage : null;
  const size = count > 1200 ? "size-1" : count > 400 ? "size-1.5" : "size-2.5";
  const stateLabel: Record<string, string> = {
    d: t("provider.pageMap.done"),
    r: t("provider.pageMap.recovered"),
    f: t("provider.pageMap.failed"),
    s: t("provider.pageMap.pending"),
    ".": t("provider.pageMap.pending"),
  };

  const legend: [string, string][] = [
    ["bg-green-500", "done"],
    [PAGE_COLORS.r, "recovered"],
    ["bg-red-500", "failed"],
    ["bg-blue-500", "current"],
    [PAGE_COLORS["."], "pending"],
  ];

  return (
    <div className="space-y-1.5">
      <div
        className="flex flex-wrap gap-[2px]"
        role="img"
        aria-label={t("provider.pageMap.title")}
      >
        {Array.from({ length: count }, (_, i) => {
          const page = i + 1;
          const state = run.pageMap[i] ?? ".";
          const isCurrent = page === current;
          return (
            <span
              key={page}
              title={`${t("provider.gaps.page", { page })} · ${isCurrent ? t("provider.pageMap.current") : stateLabel[state]}`}
              className={`${size} rounded-[2px] ${isCurrent ? "bg-blue-500 animate-pulse" : PAGE_COLORS[state]}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {legend.map(([color, key]) => (
          <span key={key} className="flex items-center gap-1">
            <span className={`size-2 rounded-[2px] ${color}`} />
            {t(`provider.pageMap.${key}`)}
          </span>
        ))}
      </div>
    </div>
  );
}

const LOG_ICONS = {
  info: <Info className="h-3 w-3 text-muted-foreground" />,
  warn: <AlertTriangle className="h-3 w-3 text-amber-500" />,
  error: <XCircle className="h-3 w-3 text-red-500" />,
};

function ActivityLog({ log, defaultOpen, t }: { log: FetchLogEntry[]; defaultOpen: boolean; t: T }) {
  const entries = [...log].reverse();
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground group cursor-pointer">
        <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-90" />
        {t("provider.log.title")}
        <span className="text-muted-foreground/60">({log.length})</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 max-h-48 overflow-y-auto rounded-md border bg-background/50 p-2 space-y-1 font-mono text-[10px] leading-4">
          {entries.length === 0 ? (
            <p className="text-muted-foreground">{t("provider.log.empty")}</p>
          ) : (
            entries.map((entry, i) => (
              <div key={`${entry.at}-${i}`} className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">{LOG_ICONS[entry.level]}</span>
                <span className="text-muted-foreground/70 shrink-0 tabular-nums">
                  {new Date(entry.at).toLocaleTimeString()}
                </span>
                <span
                  className={`break-words min-w-0 ${entry.level === "error" ? "text-red-600 dark:text-red-400" : ""}`}
                >
                  {t(`provider.log.${entry.code}`, entry.params)}
                </span>
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function StatTile({
  value,
  label,
  tone,
  onClick,
}: {
  value: number;
  label: string;
  tone: string;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={`text-center px-1 py-2 rounded ${tone} ${clickable ? "cursor-pointer hover:opacity-80" : ""}`}
    >
      <div className="font-semibold tabular-nums text-sm">{value.toLocaleString()}</div>
      <div className="text-[10px] opacity-80 truncate">{label}</div>
    </div>
  );
}

export function FetchRunView({
  run,
  label,
  stopping,
  onStop,
  onRetry,
  onClear,
  onOpenDetails,
  t,
}: {
  run: FetchRunSnapshot;
  label: string;
  stopping: boolean;
  onStop: () => void;
  onRetry: () => void;
  onClear: () => void;
  onOpenDetails: (type: RunDetailType) => void;
  t: T;
}) {
  const active = isActiveRun(run);
  const now = useNow(active);
  const finished = !active;
  const gaps = run.gaps.length;
  const resumable =
    finished && gaps > 0 && run.status !== "completed";
  const hasDetails = finished && !!run.details;

  const startedAt = run.startedAt ? new Date(run.startedAt).getTime() : null;
  const endedAt = run.finishedAt ? new Date(run.finishedAt).getTime() : now;
  const duration = startedAt ? formatDuration(endedAt - startedAt) : null;

  const pagesDone = run.pageMap.replace(/[^dr]/g, "").length;
  const showBar = run.mode === "full" && !!run.totalPages && active;

  return (
    <div className="space-y-3 pt-4 border-t">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">
            {t("provider.fetchStatus")} <span>{label}</span>
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {t(`provider.modes.${run.mode}`)}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge className={runStatusColor(run.status)}>
            {active && <Loader2 className="h-3 w-3 animate-spin" />}
            {t(`provider.runStatus.${run.status}`)}
          </Badge>
          {active && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onStop}
              disabled={stopping}
            >
              <Square className="h-3 w-3" />
              {t("provider.actions.stop")}
            </Button>
          )}
          {resumable && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onRetry}
            >
              <RotateCcw className="h-3 w-3" />
              {run.status === "interrupted" || run.status === "cancelled"
                ? t("provider.actions.resume")
                : t("provider.actions.retryGaps", { count: gaps })}
            </Button>
          )}
          {finished && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-6 px-2 text-xs"
            >
              {t("provider.clear")}
            </Button>
          )}
        </div>
      </div>

      {/* Where the run is */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
        {run.status === "queued" ? (
          <span>{t("provider.progress.queued")}</span>
        ) : (
          <>
            {run.currentPage !== null && (
              <span className="text-foreground font-medium">
                {run.mode === "full" && run.totalPages
                  ? t("provider.progress.pageOf", { page: run.currentPage, total: run.totalPages })
                  : t("provider.progress.page", { page: run.currentPage })}
              </span>
            )}
            <span>{t("provider.progress.songs", { count: run.songsFetched.toLocaleString() })}</span>
            {active && run.paceMs > 0 && (
              <span>{t("provider.progress.pace", { seconds: (run.paceMs / 1000).toFixed(1) })}</span>
            )}
            {duration && (
              <span>
                {active
                  ? t("provider.progress.elapsed", { duration })
                  : t("provider.progress.took", { duration })}
              </span>
            )}
          </>
        )}
      </div>
      {active && run.phase === "retrying_gaps" && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          {t("provider.progress.retryingGaps")}
        </p>
      )}
      {active && run.phase === "fetching" && (
        <p className="text-[11px] text-muted-foreground">
          {run.cutoff
            ? t("provider.progress.cutoff", { date: new Date(run.cutoff).toLocaleString() })
            : t("provider.progress.fullListing")}
        </p>
      )}

      {showBar && (
        <Progress value={Math.min(100, (pagesDone / run.totalPages!) * 100)} />
      )}

      {active && run.wait && (
        <WaitBanner wait={run.wait} label={label} now={now} t={t} />
      )}

      <PageMap run={run} active={active} t={t} />

      {/* Counters */}
      <div className="grid grid-cols-5 gap-1.5">
        <StatTile
          value={run.stats.added}
          label={t("provider.stats.added")}
          tone="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
          onClick={hasDetails ? () => onOpenDetails("added") : undefined}
        />
        <StatTile
          value={run.stats.updated}
          label={t("provider.stats.updated")}
          tone="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          onClick={hasDetails ? () => onOpenDetails("updated") : undefined}
        />
        <StatTile
          value={run.stats.ignored}
          label={t("provider.stats.ignored")}
          tone="bg-muted text-muted-foreground"
          onClick={hasDetails ? () => onOpenDetails("ignored") : undefined}
        />
        <StatTile
          value={run.parseIssues}
          label={t("provider.stats.issues")}
          tone={
            run.parseIssues > 0
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              : "bg-muted text-muted-foreground"
          }
          onClick={hasDetails && run.parseIssues > 0 ? () => onOpenDetails("issues") : undefined}
        />
        <StatTile
          value={gaps}
          label={t("provider.stats.gaps")}
          tone={
            gaps > 0
              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-muted text-muted-foreground"
          }
          onClick={gaps > 0 ? () => onOpenDetails("gaps") : undefined}
        />
      </div>

      {finished && run.error && run.status !== "completed" && (
        <p className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
          <CircleAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span className="break-words min-w-0">{run.error}</span>
        </p>
      )}

      {run.log.length > 0 && <ActivityLog log={run.log} defaultOpen={active} t={t} />}
    </div>
  );
}
