"use client";

import { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MonitoringDashboard } from "@/components/admin/MonitoringDashboard";
import type { MonitoringData } from "@/components/admin/MonitoringDashboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, RefreshCw, Activity } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/hooks/use-translations";

function MonitoringContent() {
  const { t } = useTranslations();
  const [data, setData] = useState<MonitoringData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/monitoring");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.monitoring.failedToLoad"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasFailures = data && (data.queue.failed > 0 || data.errors.length > 0);
  const statusDot = isLoading
    ? "bg-muted-foreground animate-pulse"
    : error
      ? "bg-destructive"
      : hasFailures
        ? "bg-amber-400"
        : "bg-emerald-500";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold leading-none">{t("admin.monitoring.title")}</h1>
                <span className={`h-2 w-2 rounded-full ${statusDot}`} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5" suppressHydrationWarning>
                {lastUpdated
                  ? t("admin.monitoring.updated", { time: lastUpdated.toLocaleTimeString() })
                  : t("admin.monitoring.subtitle")}
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          {t("admin.monitoring.refresh")}
        </Button>
      </div>

      {/* Content */}
      {isLoading && !data ? (
        <div className="space-y-5">
          {/* Stat card skeletons */}
          {[5, 5].map((cols, si) => (
            <div key={si} className="space-y-4">
              <Skeleton className="h-4 w-36" />
              <div
                className={`grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-${cols}`}
              >
                {Array.from({ length: cols }).map((_, i) => (
                  <Skeleton key={i} className="h-18 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
          {/* Table skeletons */}
          {[1, 2].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-destructive">
          <p className="text-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            {t("admin.monitoring.tryAgain")}
          </Button>
        </div>
      ) : data ? (
        <MonitoringDashboard data={data} />
      ) : null}
    </div>
  );
}

export default function AdminMonitoringPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <MonitoringContent />
    </ProtectedRoute>
  );
}
