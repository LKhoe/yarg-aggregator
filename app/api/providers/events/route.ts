import { createRedisReader, createRedisSubscriber } from "@/lib/redis";
import { ProviderService } from "@/lib/services/provider";
import { db } from "@/lib/db";
import { downloadUrl } from "@/lib/db/schema";
import { countDistinct } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/middleware/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return new Response("Unauthorized", { status: 401 });
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
        // Send initial state: current progress from Redis + lastSuccessfulFetch from DB
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
          const isRunning =
            (await reader.get(`provider:${p.name}:running`)) === "true";
          const progressRaw = await reader.get(`provider:${p.name}:progress`);
          const progress = progressRaw ? JSON.parse(progressRaw) : null;
          initialState[p.name] = {
            name: p.name,
            isRunning,
            progress,
            lastSuccessfulFetch: p.lastSuccessfulFetch ?? null,
            songCount: countMap[p.name] ?? 0,
          };
        }

        // Done with reader
        reader.disconnect();

        const initEvent = `data: ${JSON.stringify({ type: "init", providers: initialState })}\n\n`;
        controller.enqueue(encoder.encode(initEvent));

        // Subscribe to provider events channel
        await subscriber.subscribe("provider:events");

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
      subscriber.unsubscribe("provider:events").catch(() => {});
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
