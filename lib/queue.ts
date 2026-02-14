import { Queue, Worker, Job } from "bullmq";
import { getRedisClient } from "@/lib/redis";
import { fetchEnchor } from "@/services/providers/enchor";
import { fetchRhythmverse } from "@/services/providers/rhythmverse";
import { processSongs } from "@/services/songs/index";
import { ProviderService } from "@/lib/services/provider";

const connection = getRedisClient();

export const providerQueue = new Queue("provider-fetch", { connection });

interface FetchJobData {
  source: "enchor" | "rhythmverse";
  latestSourceUpdatedAt: string | null;
}

const PAGE_SIZE = 100;

export const initProviderWorker = () => {
  const worker = new Worker<FetchJobData>(
    "provider-fetch",
    async (job: Job<FetchJobData>) => {
      const { source, latestSourceUpdatedAt } = job.data;
      const latestDate = latestSourceUpdatedAt
        ? new Date(latestSourceUpdatedAt)
        : undefined;

      await connection.set(`provider:${source}:running`, "true", "EX", 120);
      await connection.publish(
        "provider:events",
        JSON.stringify({ source, type: "running", isRunning: true }),
      );

      const fetchFn = source === "enchor" ? fetchEnchor : fetchRhythmverse;

      let page = 1;
      const allSongs: Awaited<ReturnType<typeof fetchFn>>["songs"] = [];
      let shouldStop = false;

      try {
        while (!shouldStop) {
          const result = await fetchFn(page, PAGE_SIZE, latestDate);
          allSongs.push(...result.songs);
          shouldStop = result.shouldStop || result.songs.length < PAGE_SIZE;

          // Store progress in Redis and publish event
          const fetchingProgress = JSON.stringify({
            source,
            page,
            songsFetched: allSongs.length,
            phase: "fetching",
          });
          await connection.set(
            `provider:${source}:progress`,
            fetchingProgress,
            "EX",
            3600,
          );
          await connection.publish("provider:events", fetchingProgress);

          // Refresh running lock TTL
          await connection.expire(`provider:${source}:running`, 120);

          page++;

          // Rate limit between pages
          if (!shouldStop) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        // Process all fetched songs
        const processingProgress = JSON.stringify({
          source,
          page: page - 1,
          songsFetched: allSongs.length,
          phase: "processing",
        });
        await connection.set(
          `provider:${source}:progress`,
          processingProgress,
          "EX",
          3600,
        );
        await connection.publish("provider:events", processingProgress);

        const stats = await processSongs(allSongs, source, async (data) => {
          // Strip details to keep SSE payloads small (counts only)
          const { details: _, ...counts } = data.stats;
          const progressPayload = JSON.stringify({
            source,
            page: page - 1,
            songsFetched: allSongs.length,
            phase: data.phase,
            progress: data.progress,
            stats: counts,
          });
          await connection.set(
            `provider:${source}:progress`,
            progressPayload,
            "EX",
            3600,
          );
          await connection.publish("provider:events", progressPayload);
        });

        // Update last successful fetch timestamp
        await ProviderService.updateLastSuccessfulFetch(source);
        const updatedProvider = await ProviderService.findByName(source);

        // Group ignored by reason (same format as upload route)
        const ignoredByReason = stats.details.ignored.reduce(
          (acc, item) => {
            if (!acc[item.reason]) acc[item.reason] = [];
            acc[item.reason].push({ artist: item.artist, title: item.title });
            return acc;
          },
          {} as Record<string, { artist: string; title: string }[]>,
        );

        // Store completion stats with details for dialog
        const completedProgress = JSON.stringify({
          source,
          page: page - 1,
          songsFetched: allSongs.length,
          phase: "completed",
          progress: 100,
          stats: {
            added: stats.added,
            updated: stats.updated,
            ignored: stats.ignored,
          },
          details: {
            added: stats.details.added,
            updated: stats.details.updated,
            ignored: ignoredByReason,
          },
          lastSuccessfulFetch: updatedProvider?.lastSuccessfulFetch ?? null,
        });
        await connection.set(
          `provider:${source}:progress`,
          completedProgress,
          "EX",
          300, // Keep completion data for 5 minutes
        );
        await connection.publish("provider:events", completedProgress);

        console.log(
          `Provider ${source} fetch completed: ${allSongs.length} songs fetched, stats:\n`,
          `added: ${stats.added}\n`,
          `updated: ${stats.updated}\n`,
          `ignored: ${stats.ignored}\n`,
        );
      } catch (error) {
        console.error(`Provider ${source} fetch failed:`, error);
        const failedProgress = JSON.stringify({
          source,
          page: page - 1,
          songsFetched: allSongs.length,
          phase: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        await connection.set(
          `provider:${source}:progress`,
          failedProgress,
          "EX",
          300,
        );
        await connection.publish("provider:events", failedProgress);
        throw error;
      }
    },
    {
      connection,
      concurrency: 1,
      limiter: {
        max: 1,
        duration: 2000,
      },
    },
  );

  worker.on("completed", async (job) => {
    await connection.del(`provider:${job.data.source}:running`);
  });

  worker.on("failed", async (job) => {
    if (job?.data?.source) {
      await connection.del(`provider:${job.data.source}:running`);
    }
  });

  worker.on("drained", async () => {
    const providers = ["enchor", "rhythmverse"];
    for (const provider of providers) {
      await connection.del(`provider:${provider}:running`);
    }
    await connection.publish(
      "provider:events",
      JSON.stringify({ type: "drained" }),
    );
  });

  console.log("Provider worker started");
};
