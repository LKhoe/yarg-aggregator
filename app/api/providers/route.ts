import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ProviderService } from "@/lib/services/provider";
import { providerQueue } from "@/lib/queue";
import { getAuthenticatedUser, hasPermission } from "@/lib/middleware/auth";
import { getRedisClient } from "@/lib/redis";
import { db } from "@/lib/db";
import { providerFetchRun } from "@/lib/db/schema";
import {
  LOCK_TTL_SECONDS,
  providerKeys,
  publishSnapshot,
  snapshotFromRow,
} from "@/services/providers/fetch-runner";
import type { FetchRunSnapshot, ProviderSource } from "@/types";

const redis = getRedisClient();

const SOURCES: ProviderSource[] = ["enchor", "rhythmverse"];
const RESUMABLE = ["completed_with_errors", "failed", "cancelled", "interrupted"] as const;

async function authorize(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(authUser.profile.role, "moderator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Start a fetch.
 *   { source, mode?: "incremental" | "full" }   new run
 *   { source, action: "retry_gaps" }             re-fetch the failed pages of the latest run
 */
export async function POST(request: NextRequest) {
  const denied = await authorize(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const source = body.source as ProviderSource;
    const action = body.action === "retry_gaps" ? "retry_gaps" : "fetch";
    const mode = body.mode === "full" ? "full" : "incremental";

    if (!SOURCES.includes(source)) {
      return NextResponse.json(
        { error: "Invalid source. Must be enchor or rhythmverse" },
        { status: 400 },
      );
    }

    const active = await db
      .select({ id: providerFetchRun.id })
      .from(providerFetchRun)
      .where(
        and(
          eq(providerFetchRun.source, source),
          inArray(providerFetchRun.status, ["queued", "running"]),
        ),
      )
      .limit(1);
    // Atomically acquire the running lock
    const acquired =
      active.length === 0 &&
      (await redis.set(providerKeys.lock(source), "queued", "EX", LOCK_TTL_SECONDS, "NX"));
    if (!acquired) {
      return NextResponse.json(
        { error: `Provider is already running for ${source}` },
        { status: 409 },
      );
    }
    // A stale stop request must not cancel this new run
    await redis.del(providerKeys.cancel(source));

    let createdRunId: string | null = null;
    try {
      let snapshot: FetchRunSnapshot;
      let runId: string;

      if (action === "retry_gaps") {
        const [latest] = await db
          .select()
          .from(providerFetchRun)
          .where(eq(providerFetchRun.source, source))
          .orderBy(desc(providerFetchRun.createdAt))
          .limit(1);
        if (
          !latest ||
          !(RESUMABLE as readonly string[]).includes(latest.status) ||
          latest.gaps.length === 0
        ) {
          await redis.del(providerKeys.lock(source));
          return NextResponse.json(
            { error: "The latest run has no failed pages to retry" },
            { status: 400 },
          );
        }
        runId = latest.id;
        snapshot = { ...snapshotFromRow(latest), status: "queued", phase: "queued" };
      } else {
        await ProviderService.findOrCreate(source);
        const [run] = await db
          .insert(providerFetchRun)
          .values({ source, mode, status: "queued" })
          .returning();
        runId = createdRunId = run.id;
        snapshot = snapshotFromRow(run);
      }

      await providerQueue.add(
        `${action}-${source}`,
        { runId, source, action },
        { removeOnComplete: true, removeOnFail: 50 },
      );
      await publishSnapshot(snapshot);

      return NextResponse.json({ success: true, runId, message: "Provider fetch started" });
    } catch (error) {
      await redis.del(providerKeys.lock(source));
      if (createdRunId) {
        // Never leave a "queued" run behind: it would block every later fetch
        await db
          .update(providerFetchRun)
          .set({ status: "failed", error: "Could not be queued", finishedAt: new Date() })
          .where(eq(providerFetchRun.id, createdRunId))
          .catch(() => undefined);
      }
      throw error;
    }
  } catch (error) {
    console.error("Error starting provider:", error);
    return NextResponse.json(
      { error: "Failed to start provider" },
      { status: 500 },
    );
  }
}

/** Ask the running (or queued) fetch of a source to stop; it stops between requests */
export async function DELETE(request: NextRequest) {
  const denied = await authorize(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const source = body.source as ProviderSource;

    if (!SOURCES.includes(source)) {
      return NextResponse.json(
        { error: "Invalid source. Must be enchor or rhythmverse" },
        { status: 400 },
      );
    }

    const lock = await redis.get(providerKeys.lock(source));
    if (!lock) {
      return NextResponse.json(
        { error: `Provider is not running for ${source}` },
        { status: 400 },
      );
    }

    await redis.set(providerKeys.cancel(source), "1", "EX", 15 * 60);

    return NextResponse.json({
      success: true,
      message: `Stopping ${source}; the current request finishes first`,
    });
  } catch (error) {
    console.error("Error stopping provider:", error);
    return NextResponse.json(
      { error: "Failed to stop provider" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const denied = await authorize(request);
  if (denied) return denied;

  try {
    const providers = await ProviderService.getAll();
    const enriched = await Promise.all(
      providers.map(async (provider) => {
        const isRunning = (await redis.get(providerKeys.lock(provider.name))) !== null;
        const snapshotRaw = await redis.get(providerKeys.snapshot(provider.name));
        return {
          ...provider,
          isRunning,
          run: snapshotRaw ? (JSON.parse(snapshotRaw) as FetchRunSnapshot) : null,
        };
      }),
    );
    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Error getting provider status:", error);
    return NextResponse.json(
      { error: "Failed to get provider status" },
      { status: 500 },
    );
  }
}
