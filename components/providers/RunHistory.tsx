"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, Loader2 } from "lucide-react";
import type { FetchRunSummary, ProviderSource } from "@/types";
import { formatDuration, runStatusColor } from "./FetchRunView";

type T = (key: string, params?: Record<string, string | number>) => string;

/** Last runs of a source; reloads when `refreshKey` changes (e.g. a run finished) */
export function RunHistory({
  source,
  refreshKey,
  t,
}: {
  source: ProviderSource;
  refreshKey: string;
  t: T;
}) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<FetchRunSummary[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/providers/runs?source=${source}&limit=10`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: FetchRunSummary[]) => {
        if (!cancelled) setRuns(data);
      })
      .catch(() => {
        if (!cancelled) setRuns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, source, refreshKey]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground group cursor-pointer">
        <ChevronRight className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-90" />
        {t("provider.history.title")}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 space-y-1">
          {runs === null ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : runs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              {t("provider.history.empty")}
            </p>
          ) : (
            runs.map((run) => {
              const started = run.startedAt ? new Date(run.startedAt) : null;
              const duration =
                started && run.finishedAt
                  ? formatDuration(new Date(run.finishedAt).getTime() - started.getTime())
                  : null;
              return (
                <div
                  key={run.id}
                  title={run.error ?? undefined}
                  className="flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums"
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${runStatusColor(run.status)}`}
                  />
                  <span className="shrink-0">
                    {started ? started.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" }) : "—"}{" "}
                    {started?.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
                    {t(`provider.modes.${run.mode}`)}
                  </Badge>
                  <span className="truncate">
                    {t(`provider.runStatus.${run.status}`)}
                    {duration && ` · ${duration}`}
                  </span>
                  <span className="ml-auto flex gap-1.5 shrink-0">
                    <span className="text-green-600 dark:text-green-400">+{run.added}</span>
                    <span className="text-blue-600 dark:text-blue-400">~{run.updated}</span>
                    {run.failedPages > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        {t("provider.history.failedPages", { count: run.failedPages })}
                      </span>
                    )}
                    {run.parseIssues > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">!{run.parseIssues}</span>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
