import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { fetchEnchor, fetchRhythmverse } from '@/services/providers';
import Music from '@/models/Music';
import ProviderStats from '@/models/ProviderStats';
import { getIO } from '@/lib/socket';
import connectDB from '@/lib/db';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const connection = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null, // Required for BullMQ
});

export const providerQueue = new Queue('provider-fetch', { connection });

interface FetchJobData {
  source: 'enchor' | 'rhythmverse';
  page: number;
  pageSize: number;
  sortDirection: 'asc' | 'desc';
}

export const initProviderWorker = () => {
  const worker = new Worker<FetchJobData>(
    'provider-fetch',
    async (job: Job<FetchJobData>) => {
      await connectDB();
      const { source, page, pageSize, sortDirection } = job.data;
      const io = getIO();

      try {
        const fetchFn = source === 'enchor' ? fetchEnchor : fetchRhythmverse;

        // Timeout wrapper
        const timeoutPromise = new Promise<{ songs: any[] }>((_, reject) => {
          setTimeout(() => reject(new Error('Task timed out')), 30000); // 30s timeout
        });

        const fetchPromise = fetchFn(page, pageSize, sortDirection);

        const { songs } = await Promise.race([fetchPromise, timeoutPromise]);

        let upsertedCount = 0;
        let updatedCount = 0;
        let errors = '';

        if (songs.length > 0) {
          const operations = songs.map(song => ({
            updateOne: {
              filter: {
                name: song.name,
                artist: song.artist,
                source: source,
                instruments: song.instruments
              },
              update: { $set: song },
              upsert: true
            }
          }));

          const bulkResult = await Music.bulkWrite(operations, { ordered: false });
          upsertedCount = bulkResult.upsertedCount;
          updatedCount = bulkResult.modifiedCount;
          errors = bulkResult.getWriteErrors().map(e => e.errmsg + ' - ' + e.errInfo).join('\n');
        }

        // Update stats based on actual insertions
        await ProviderStats.updateOne(
          { source },
          {
            $inc: { totalFetched: songs.length },
            $set: { lastFetchedAt: new Date() }
          }
        );

        if (io) {
          const active = await providerQueue.getActiveCount();
          const completed = await providerQueue.getCompletedCount();
          const failed = await providerQueue.getFailedCount();
          const waiting = await providerQueue.getWaitingCount();
          const delayed = await providerQueue.getDelayedCount();
          const total = active + completed + failed + waiting + delayed;

          io.emit('provider:progress', {
            source,
            page,
            count: songs.length,
            active,
            completed,
            failed,
            waiting,
            delayed,
            total,
            timestamp: Date.now()
          });
        }

        return { songsLength: songs.length, upsertedCount, updatedCount, errors };

      } catch (error: any) {
        console.error(`Job failed for ${source} page ${page}:`, error);

        // Track failed job in DB
        await ProviderStats.updateOne(
          { source },
          {
            $push: {
              failedJobs: {
                initIndex: (page - 1) * pageSize, // Approximate index
                endIndex: page * pageSize
              }
            }
          }
        );

        if (io) {
          io.emit('provider:failed', {
            source,
            page,
            error: error.message
          });
        }

        throw error;
      }
    },
    {
      connection,
      concurrency: 5, // Process 5 pages at a time
      limiter: {
        max: 10,
        duration: 1000 // Rate limit fetches just in case
      }
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed! Fetched ${job.returnvalue?.songsLength} songs. Saved ${job.returnvalue?.upsertedCount} new songs. Updated ${job.returnvalue?.updatedCount} songs.`);
    if (job.returnvalue?.errors) {
      console.error(`Job ${job.id} Errors: ${job.returnvalue.errors}`);
    }
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
  });

  worker.on('drained', async () => {
    console.log('Queue drained! No more jobs.');

    const io = getIO();
    if (io) {
      io.emit('provider:drained');
    }

    await ProviderStats.updateMany(
      {},
      {
        $set: {
          isRunning: false,
        }
      }
    );
  });

  console.log('Provider worker started');
};
