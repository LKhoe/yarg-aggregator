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
  WebVitalMetric,
  QueueStats,
  DbStats,
} from "@/lib/monitoring";
import { useTranslations } from "@/hooks/use-translations";

export interface MonitoringData {
  queue: QueueStats;
  db: DbStats;
  errors: MonitoringError[];
  vitals: Record<string, WebVitalMetric[]>;
}

// ─── Web Vitals config ───────────────────────────────────────────────────────

const VITAL_THRESHOLDS: Record<
  string,
  { good: number; poor: number; unit: string; description: string }
> = {
  LCP: {
    good: 2500,
    poor: 4000,
    unit: "ms",
    description: "Largest Contentful Paint",
  },
  FCP: {
    good: 1800,
    poor: 3000,
    unit: "ms",
    description: "First Contentful Paint",
  },
  CLS: {
    good: 0.1,
    poor: 0.25,
    unit: "",
    description: "Cumulative Layout Shift",
  },
  INP: {
    good: 200,
    poor: 500,
    unit: "ms",
    description: "Interaction to Next Paint",
  },
  TTFB: {
    good: 800,
    poor: 1800,
    unit: "ms",
    description: "Time to First Byte",
  },
};

function formatVital(name: string, value: number): string {
  const t = VITAL_THRESHOLDS[name];
  if (!t) return String(value);
  return t.unit === "ms" ? `${Math.round(value)} ms` : value.toFixed(3);
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calcRating(
  name: string,
  value: number,
): "good" | "needsWork" | "poor" {
  const t = VITAL_THRESHOLDS[name];
  if (!t) return "good";
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needsWork";
  return "poor";
}

/** Returns 0-100 progress where 100 = at or beyond "poor" threshold */
function vitalProgress(name: string, value: number): number {
  const t = VITAL_THRESHOLDS[name];
  if (!t) return 0;
  return Math.min(100, Math.round((value / t.poor) * 100));
}

const RATING_BAR: Record<string, string> = {
  good: "bg-emerald-500",
  needsWork: "bg-amber-400",
  poor: "bg-red-500",
};

const RATING_BADGE: Record<string, string> = {
  good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  needsWork:
    "bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-400/20",
  poor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

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
  const { queue, db, errors, vitals } = data;
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

      {/* ── Web Vitals ── */}
      <section>
        <SectionHeader
          icon={TrendingUp}
          title={t("admin.monitoring.webVitals")}
        />
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-35">
                    {t("admin.monitoring.metric")}
                  </TableHead>
                  <TableHead>{t("admin.monitoring.score")}</TableHead>
                  <TableHead className="w-22.5 text-right">
                    {t("admin.monitoring.avg")}
                  </TableHead>
                  <TableHead className="w-20 text-right">
                    {t("admin.monitoring.samples")}
                  </TableHead>
                  <TableHead className="w-32.5">
                    {t("admin.monitoring.rating")}
                  </TableHead>
                  <TableHead>{t("admin.monitoring.latestPath")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(VITAL_THRESHOLDS).map(([name, cfg]) => {
                  const metrics = vitals[name] ?? [];
                  const avgVal = avg(metrics.map((m) => m.value));
                  const rating =
                    metrics.length > 0 ? calcRating(name, avgVal) : null;
                  const progress = rating ? vitalProgress(name, avgVal) : 0;
                  const latestPath = metrics[0]?.path ?? "—";
                  const ratingText = rating
                    ? t(`admin.monitoring.${rating}`)
                    : "—";

                  return (
                    <TableRow key={name}>
                      <TableCell>
                        <p className="font-mono font-semibold text-sm">
                          {name}
                        </p>
                        <p className="text-xs text-muted-foreground leading-tight">
                          {cfg.description}
                        </p>
                      </TableCell>
                      <TableCell>
                        {rating ? (
                          <div className="flex items-center gap-2 min-w-30">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${RATING_BAR[rating]}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {metrics.length > 0 ? formatVital(name, avgVal) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {metrics.length}
                      </TableCell>
                      <TableCell>
                        {rating ? (
                          <Badge
                            variant="outline"
                            className={RATING_BADGE[rating]}
                          >
                            {ratingText}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {t("admin.monitoring.noData")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono truncate max-w-45">
                        {latestPath}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
