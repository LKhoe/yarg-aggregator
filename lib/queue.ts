import { Queue, Worker, Job } from "bullmq";
import { BULLMQ_PREFIX, getQueueConnection, getRedisClient } from "@/lib/redis";
import {
  ProviderFetchRunner,
  providerKeys,
  recoverInterruptedRuns,
  type FetchJobData,
} from "@/services/providers/fetch-runner";

export type { FetchJobData } from "@/services/providers/fetch-runner";

// BullMQ connection (no keyPrefix) + app client for our own keys (namespaced by REDIS_KEY_PREFIX)
const connection = getQueueConnection();
const redis = getRedisClient();

export const providerQueue = new Queue<FetchJobData>("provider-fetch", {
  connection,
  prefix: BULLMQ_PREFIX,
});

export const initProviderWorker = () => {
  // Runs left "running" by a previous process become resumable gaps
  recoverInterruptedRuns().catch((error) =>
    console.error("Could not recover interrupted fetch runs:", error),
  );

  const worker = new Worker<FetchJobData>(
    "provider-fetch",
    async (job: Job<FetchJobData>) => {
      const { runId, source, action } = job.data;
      if (!runId || !["enchor", "rhythmverse"].includes(source)) {
        throw new Error(`Invalid fetch job data: ${JSON.stringify(job.data)}`);
      }
      if (action !== "fetch" && action !== "retry_gaps") {
        throw new Error(`Invalid fetch job action: ${action}`);
      }
      // The runner records every failure on the run itself; it only throws when
      // the run cannot even be loaded.
      return new ProviderFetchRunner(job.data).execute();
    },
    {
      connection,
      prefix: BULLMQ_PREFIX,
      // One fetch at a time: both sources share the Pi's bandwidth and the DB
      concurrency: 1,
      // Long rate-limit waits are fine: the runner keeps the job alive
      lockDuration: 60_000,
    },
  );

  worker.on("failed", async (job, error) => {
    console.error(`Fetch job ${job?.id} failed:`, error);
    const source = job?.data?.source;
    if (source && (await redis.get(providerKeys.lock(source))) !== null) {
      await redis.del(providerKeys.lock(source));
    }
  });

  console.log("Provider worker started");
};
