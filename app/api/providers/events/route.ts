import {
  PROVIDER_EVENTS_CHANNEL,
  createRedisReader,
  createRedisSubscriber,
} from "@/lib/redis";
import { ProviderService } from "@/lib/services/provider";
import { db } from "@/lib/db";
import { downloadUrl, providerFetchRun } from "@/lib/db/schema";
import { countDistinct, desc, eq } from "drizzle-orm";
import { providerKeys, snapshotFromRow } from "@/services/providers/fetch-runner";
import type { FetchRunSnapshot } from "@/types";
import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasPermission } from "@/lib/middleware/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasPermission(authUser.profile.role, "moderator")) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();

  // Dedicated reader for initial state
  const reader = createRedisReader();
  // Dedicated subscriber (ioredis requires separate connection for pub/sub)
  const subscriber = createRedisSubscriber();

  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Initial state: live run snapshot (Redis, else the latest run in the DB) + counts
        const providers = await ProviderService.getAll();
        const initialState: Record<string, unknown> = {};

        // Get song counts per source
        const songCounts = await db
          .select({
            source: downloadUrl.source,
            count: countDistinct(downloadUrl.songId),
          })
          .from(downloadUrl)
          .groupBy(downloadUrl.source);
        const countMap: Record<string, number> = {};
        for (const row of songCounts) {
          countMap[row.source] = row.count;
        }

        for (const p of providers) {
          const isRunning = (await reader.get(providerKeys.lock(p.name))) !== null;
          const snapshotRaw = await reader.get(providerKeys.snapshot(p.name));
          let run: FetchRunSnapshot | null = snapshotRaw ? JSON.parse(snapshotRaw) : null;
          if (!run) {
            const [latest] = await db
              .select()
              .from(providerFetchRun)
              .where(eq(providerFetchRun.source, p.name))
              .orderBy(desc(providerFetchRun.createdAt))
              .limit(1);
            run = latest ? snapshotFromRow(latest) : null;
          }
          initialState[p.name] = {
            name: p.name,
            isRunning,
            run,
            lastSuccessfulFetch: p.lastSuccessfulFetch ?? null,
            songCount: countMap[p.name] ?? 0,
          };
        }

        // Done with reader
        reader.disconnect();

        const initEvent = `data: ${JSON.stringify({ type: "init", providers: initialState })}\n\n`;
        controller.enqueue(encoder.encode(initEvent));

        // Subscribe to provider events channel
        await subscriber.subscribe(PROVIDER_EVENTS_CHANNEL);

        subscriber.on("message", (_channel: string, message: string) => {
          try {
            const event = `data: ${message}\n\n`;
            controller.enqueue(encoder.encode(event));
          } catch {
            // Stream closed, will be cleaned up by cancel
          }
        });

        // Send heartbeat every 30s to keep connection alive
        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(":heartbeat\n\n"));
          } catch {
            if (heartbeat) clearInterval(heartbeat);
          }
        }, 30_000);
      } catch (error) {
        console.error("SSE init error:", error);
        if (heartbeat) clearInterval(heartbeat);
        reader.disconnect();
        subscriber.disconnect();
        controller.close();
      }
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      subscriber.unsubscribe(PROVIDER_EVENTS_CHANNEL).catch(() => {});
      subscriber.disconnect();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
