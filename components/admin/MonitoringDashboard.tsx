"use client";

import { Fragment, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Timer,
  Music2,
  Users,
  HardDrive,
  Database,
  Server,
  Activity,
  AlertTriangle,
  CheckCheck,
  TrendingUp,
  ShieldAlert,
  ChevronDown,
} from "lucide-react";
import type {
  MonitoringError,
  QueueStats,
  DbStats,
} from "@/lib/monitoring";
import { useTranslations } from "@/hooks/use-translations";

export interface MonitoringData {
  queue: QueueStats;
  db: DbStats;
  errors: MonitoringError[];
}

// ─── HTTP method colors ───────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-sky-500/10    text-sky-600    dark:text-sky-400    border-sky-500/20",
  POST: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  PUT: "bg-violet-500/10 text-violet-600  dark:text-violet-400  border-violet-500/20",
  PATCH:
    "bg-amber-400/10  text-amber-600   dark:text-amber-400   border-amber-400/20",
  DELETE:
    "bg-red-500/10    text-red-600     dark:text-red-400     border-red-500/20",
};

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10 shrink-0">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h2 className="text-sm font-semibold">{title}</h2>
      {badge}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconClass = "text-muted-foreground",
  valueClass = "",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconClass?: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="px-4 py-3 flex items-center gap-3">
        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted/60 shrink-0">
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate leading-none mb-1">
            {label}
          </p>
          <p className={`text-lg font-bold leading-none ${valueClass}`}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ElementType;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
      <Icon className="h-8 w-8 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

function formatPath(raw: string): string {
  try {
    const u = new URL(raw);
    return u.pathname + u.search;
  } catch {
    return raw;
  }
}

export function MonitoringDashboard({ data }: { data: MonitoringData }) {
  const { t } = useTranslations();
  const { queue, db, errors } = data;
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  function toggleError(i: number) {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  }

  return (
    <div className="space-y-7">
      {/* ── Queue Health ── */}
      <section>
        <SectionHeader
          icon={Activity}
          title={t("admin.monitoring.queueHealth")}
        />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            icon={Clock}
            label={t("admin.monitoring.waiting")}
            value={queue.waiting}
            iconClass="text-sky-500"
          />
          <StatCard
            icon={Zap}
            label={t("admin.monitoring.active")}
            value={queue.active}
            iconClass={
              queue.active > 0 ? "text-amber-500" : "text-muted-foreground"
            }
          />
          <StatCard
            icon={CheckCircle2}
            label={t("admin.monitoring.completed")}
            value={queue.completed}
            iconClass="text-emerald-500"
          />
          <StatCard
            icon={XCircle}
            label={t("admin.monitoring.failed")}
            value={queue.failed}
            iconClass={
              queue.failed > 0 ? "text-destructive" : "text-muted-foreground"
            }
            valueClass={queue.failed > 0 ? "text-destructive" : ""}
          />
          <StatCard
            icon={Timer}
            label={t("admin.monitoring.delayed")}
            value={queue.delayed}
          />
        </div>
      </section>

      {/* ── Database Health ── */}
      <section>
        <SectionHeader
          icon={Database}
          title={t("admin.monitoring.databaseHealth")}
        />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            icon={Music2}
            label={t("admin.monitoring.songs")}
            value={db.songs.toLocaleString("en-US")}
            iconClass="text-violet-500"
          />
          <StatCard
            icon={Users}
            label={t("admin.monitoring.users")}
            value={db.users.toLocaleString("en-US")}
            iconClass="text-sky-500"
          />
          <StatCard
            icon={HardDrive}
            label={t("admin.monitoring.installations")}
            value={db.installations.toLocaleString("en-US")}
            iconClass="text-amber-500"
          />
          <StatCard
            icon={Database}
            label={t("admin.monitoring.dbSize")}
            value={`${db.dbSizeMb} MB`}
            iconClass="text-emerald-500"
          />
          <StatCard
            icon={Server}
            label={t("admin.monitoring.connections")}
            value={db.connections}
            iconClass="text-sky-400"
          />
        </div>
      </section>

      {/* ── Web Vitals: collected for every app by LocalInfra (Container Health → Metrics) ── */}
      <section>
        <SectionHeader
          icon={TrendingUp}
          title={t("admin.monitoring.webVitals")}
        />
        <Card>
          <CardContent className="px-4 py-3 text-sm text-muted-foreground">
            {t("admin.monitoring.webVitalsMoved")}
          </CardContent>
        </Card>
      </section>

      {/* ── Recent API Errors ── */}
      <section>
        <SectionHeader
          icon={ShieldAlert}
          title={t("admin.monitoring.recentApiErrors")}
          badge={
            errors.length > 0 ? (
              <Badge variant="destructive" className="text-xs">
                {errors.length}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1"
              >
                <CheckCheck className="h-3 w-3" />
                {t("admin.monitoring.clean")}
              </Badge>
            )
          }
        />
        <Card>
          <CardContent className="p-0">
            {errors.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                message={t("admin.monitoring.noErrors")}
              />
            ) : (
              <div className="overflow-auto max-h-105">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">
                        {t("admin.monitoring.time")}
                      </TableHead>
                      <TableHead className="w-20">
                        {t("admin.monitoring.method")}
                      </TableHead>
                      <TableHead className="w-55">
                        {t("admin.monitoring.path")}
                      </TableHead>
                      <TableHead>{t("admin.monitoring.message")}</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errors.map((err, i) => {
                      const isExpanded = expandedErrors.has(i);
                      const hasDetails = !!(err.stack || err.digest);
                      return (
                        <Fragment key={i}>
                          <TableRow
                            className={
                              hasDetails
                                ? "cursor-pointer hover:bg-muted/40"
                                : ""
                            }
                            onClick={() => hasDetails && toggleError(i)}
                          >
                            <TableCell
                              className="text-muted-foreground text-xs whitespace-nowrap tabular-nums"
                              suppressHydrationWarning
                            >
                              {new Date(err.timestamp).toLocaleString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                },
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`font-mono text-xs ${METHOD_COLORS[err.method] ?? "bg-muted/50"}`}
                              >
                                {err.method}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-55">
                              {formatPath(err.path)}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                                <span className="text-muted-foreground truncate max-w-85">
                                  {err.message}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {hasDetails && (
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow
                              className="bg-muted/20 hover:bg-muted/20"
                            >
                              <TableCell colSpan={5} className="py-3 px-4">
                                {err.digest && (
                                  <p className="text-xs text-muted-foreground mb-2">
                                    <span className="font-medium text-foreground">
                                      {t("admin.monitoring.digest")}:
                                    </span>{" "}
                                    <span className="font-mono">
                                      {err.digest}
                                    </span>
                                  </p>
                                )}
                                {err.stack && (
                                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all bg-muted/50 rounded-md p-3 max-h-48 overflow-auto leading-relaxed">
                                    {err.stack}
                                  </pre>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
