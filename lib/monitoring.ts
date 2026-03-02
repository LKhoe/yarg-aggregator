import { getRedisClient } from "@/lib/redis";
import { providerQueue } from "@/lib/queue";
import { db } from "@/lib/db";
import { song, user, installation } from "@/lib/db/schema";
import { count, sql } from "drizzle-orm";

export interface MonitoringError {
  timestamp: string;
  method: string;
  path: string;
  message: string;
  stack?: string;
  digest?: string;
}

export interface WebVitalMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  path: string;
  timestamp: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface DbStats {
  songs: number;
  users: number;
  installations: number;
  dbSizeMb: number;
  connections: number;
}

const ERROR_KEY = "metrics:errors";
const VITAL_KEY = (name: string) => `metrics:vitals:${name}`;
const MAX_ERRORS = 50;
const MAX_VITALS = 100;

export async function pushError(error: MonitoringError): Promise<void> {
  const redis = getRedisClient();
  await redis.lpush(ERROR_KEY, JSON.stringify(error));
  await redis.ltrim(ERROR_KEY, 0, MAX_ERRORS - 1);
}

export async function pushVital(metric: WebVitalMetric): Promise<void> {
  const redis = getRedisClient();
  const key = VITAL_KEY(metric.name);
  await redis.lpush(key, JSON.stringify(metric));
  await redis.ltrim(key, 0, MAX_VITALS - 1);
}

export async function getErrors(): Promise<MonitoringError[]> {
  const redis = getRedisClient();
  const items = await redis.lrange(ERROR_KEY, 0, MAX_ERRORS - 1);
  return items.map((item) => JSON.parse(item) as MonitoringError);
}

export async function getVitals(): Promise<Record<string, WebVitalMetric[]>> {
  const redis = getRedisClient();
  const metricNames = ["LCP", "FCP", "CLS", "INP", "TTFB"];
  const result: Record<string, WebVitalMetric[]> = {};
  for (const name of metricNames) {
    const items = await redis.lrange(VITAL_KEY(name), 0, MAX_VITALS - 1);
    result[name] = items.map((item) => JSON.parse(item) as WebVitalMetric);
  }
  return result;
}

export async function getQueueStats(): Promise<QueueStats> {
  const counts = await providerQueue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
  );
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
  };
}

export async function getDbStats(): Promise<DbStats> {
  const [songCount, userCount, installationCount, sizeResult, connResult] =
    await Promise.all([
      db.select({ value: count() }).from(song),
      db.select({ value: count() }).from(user),
      db.select({ value: count() }).from(installation),
      db.execute<{ size: string }>(
        sql`SELECT pg_database_size(current_database()) AS size`,
      ),
      db.execute<{ connections: string }>(
        sql`SELECT count(*) AS connections FROM pg_stat_activity WHERE datname = current_database()`,
      ),
    ]);

  const sizeRow = Array.from(sizeResult)[0] as { size: string } | undefined;
  const connRow = Array.from(connResult)[0] as { connections: string } | undefined;
  const dbSizeBytes = parseInt(sizeRow?.size ?? "0", 10);

  return {
    songs: songCount[0]?.value ?? 0,
    users: userCount[0]?.value ?? 0,
    installations: installationCount[0]?.value ?? 0,
    dbSizeMb: Math.round((dbSizeBytes / 1024 / 1024) * 10) / 10,
    connections: parseInt(connRow?.connections ?? "0", 10),
  };
}
