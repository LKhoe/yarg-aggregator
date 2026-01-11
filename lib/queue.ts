import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { fetchEnchor, fetchRhythmverse } from '@/services/providers';
import Music from '@/models/Music';
import Provider from '@/models/Provider';
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
  latestSourceUpdatedAt: string;
}

export const initProviderWorker = () => {
  const worker = new Worker<FetchJobData>(
    'provider-fetch',
    async (job: Job<FetchJobData>) => {
      await connectDB();
      const { source, latestSourceUpdatedAt: latestDate } = job.data;
      const latestSourceUpdatedAt = new Date(latestDate);

      // Set provider as running in Redis when job starts
      await connection.set(`provider:${source}:running`, 'true', 'EX', 3600); // 1 hour expiry

      try {
        const fetchFn = source === 'enchor' ? fetchEnchor : fetchRhythmverse;
        const pageSize = source === 'enchor' ? 10 : 25;

        let page = 1;
        let totalSongsProcessed = 0;
        let shouldContinue = true;
        let totalUpserted = 0;
        let totalUpdated = 0;
        let lastSuccessfulFetchCandidate: Date | null = null;
        let allPagesSuccessful = true;
        const maxRetries = 3;
        const baseBackoffMs = 5000; // 5 seconds base backoff

        while (shouldContinue) {
          console.log(`Processing ${source} page ${page}...`);

          // Add delay between requests (except for first page)
          if (page > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay
          }

          let retryCount = 0;
          let pageSuccess = false;

          // Retry logic for pages > 1
          while (!pageSuccess && retryCount < maxRetries) {
            try {
              // Timeout wrapper for each page
              const timeoutPromise = new Promise<{ songs: any[]; shouldStop: boolean }>((_, reject) => {
                setTimeout(() => reject(new Error('Task timed out')), 30000); // 30 seconds
              });
              const fetchPromise = fetchFn(page, pageSize, latestSourceUpdatedAt);
              const { songs, shouldStop } = await Promise.race([fetchPromise, timeoutPromise]);

              if (page === 1 && songs.length > 0) {
                lastSuccessfulFetchCandidate = songs[0]?.sourceUpdatedAt;
              }

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
                totalUpserted += bulkResult.upsertedCount;
                totalUpdated += bulkResult.modifiedCount;
                totalSongsProcessed += songs.length;

                // Log any errors
                const errors = bulkResult.getWriteErrors();
                if (errors.length > 0) {
                  console.error(`Bulk write errors for ${source} page ${page}:`, errors);
                }
              }

              console.log(`Processed ${source} page ${page}: ${songs.length} songs, total: ${totalSongsProcessed}, oldest song: ${songs[0]?.sourceUpdatedAt.toISOString()}`);

              pageSuccess = true;

              // Check if we should stop
              if (shouldStop || songs.length === 0) {
                shouldContinue = false;
                console.log(`Stopping fetch for ${source} at page ${page}. shouldStop: ${shouldStop}, noSongs: ${songs.length === 0}`);
              } else {
                page++;
              }

            } catch (error: any) {
              retryCount++;

              // Implement retry with backoff
              if (retryCount <= maxRetries) {
                const backoffMs = baseBackoffMs * Math.pow(2, retryCount - 1); // Exponential backoff
                console.log(`Page ${page} failed for ${source} (attempt ${retryCount}/${maxRetries}), retrying in ${backoffMs}ms:`, error.message);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
              } else {
                console.error(`Page ${page} failed for ${source} after ${maxRetries} retries, aborting:`, error);
                allPagesSuccessful = false;
                throw error;
              }
            }
          }
        }

        // Only update provider status if all pages were processed successfully
        if (allPagesSuccessful && lastSuccessfulFetchCandidate) {
          await Provider.updateOne(
            { name: source },
            { $set: { lastSuccessfulFetch: lastSuccessfulFetchCandidate } },
            { upsert: true }
          );
        }

        return {
          totalSongsProcessed,
          upsertedCount: totalUpserted,
          updatedCount: totalUpdated,
          totalPagesProcessed: page - 1
        };

      } catch (error: any) {
        console.error(`Job failed for ${source}:`, error);

        // Clear running status in Redis on failure
        await connection.del(`provider:${source}:running`);
        throw error;
      }
    },
    {
      connection,
      concurrency: 1, // Process 1 job at a time (since each job handles its own paging)
      limiter: {
        max: 1,
        duration: 2000 // Rate limit to 1 job per 2 seconds minimum
      }
    }
  );

  worker.on('completed', async (job) => {
    const result = job.returnvalue;
    console.log(`Job ${job.id} completed for ${job.data.source}!`);
    console.log(`Total songs processed: ${result?.totalSongsProcessed}`);
    console.log(`New songs added: ${result?.upsertedCount}`);
    console.log(`Songs updated: ${result?.updatedCount}`);
    console.log(`Total pages processed: ${result?.totalPagesProcessed}`);

    // Clear running status in Redis on completion
    await connection.del(`provider:${job.data.source}:running`);
  });

  worker.on('failed', async (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
    // Clear running status in Redis on failure
    if (job?.data?.source) {
      await connection.del(`provider:${job.data.source}:running`);
    }
  });

  worker.on('drained', async () => {
    console.log('Queue drained! No more jobs.');
    // Clear all running statuses in Redis when queue is drained
    const providers = ['enchor', 'rhythmverse'];
    for (const provider of providers) {
      await connection.del(`provider:${provider}:running`);
    }
  });

  console.log('Provider worker started');
};
