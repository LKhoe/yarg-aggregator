import { Queue } from 'bullmq';
import getRedis from '@/lib/redis';

export const PROVIDER_QUEUE_NAME = 'provider-fetch-queue';

let providerQueue: Queue | null = null;

export function getProviderQueue(): Queue {
  if (!providerQueue) {
    providerQueue = new Queue(PROVIDER_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return providerQueue;
}

export interface ProviderJobData {
  source: 'enchor' | 'rhythmverse' | 'all';
  page?: number;
  concurrency?: number;
}

export async function addProviderJob(data: ProviderJobData): Promise<string> {
  const queue = getProviderQueue();
  const job = await queue.add('fetch', data, {
    priority: data.source === 'all' ? 1 : 2,
  });
  return job.id as string;
}

export async function getJobStatus(jobId: string) {
  const queue = getProviderQueue();
  const job = await queue.getJob(jobId);
  
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress as number;

  return {
    id: job.id,
    data: job.data,
    state,
    progress,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

