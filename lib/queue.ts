import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { fetchEnchor, fetchRhythmverse } from '@/services/providers';
import Music from '@/models/Music';
import ProviderStats from '@/models/ProviderStats';
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
  latestSourceUpdatedAt?: Date;
}

export const initProviderWorker = () => {
  const worker = new Worker<FetchJobData>(
    'provider-fetch',
    async (job: Job<FetchJobData>) => {
      await connectDB();
      const { source, latestSourceUpdatedAt } = job.data;

      try {
        const fetchFn = source === 'enchor' ? fetchEnchor : fetchRhythmverse;
        const pageSize = source === 'enchor' ? 10 : 25;
        
        let page = 1;
        let totalSongsProcessed = 0;
        let shouldContinue = true;
        let totalUpserted = 0;
        let totalUpdated = 0;

        while (shouldContinue) {
          console.log(`Processing ${source} page ${page}...`);

          // Timeout wrapper for each page
          const timeoutPromise = new Promise<{ songs: any[]; shouldStop: boolean }>((_, reject) => {
            setTimeout(() => reject(new Error('Task timed out')), 30000); // 30 seconds
          });

          // Add delay between requests (except for first page)
          if (page > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay
          }

          const fetchPromise = fetchFn(page, pageSize, 'desc', latestSourceUpdatedAt);
          const { songs, shouldStop } = await Promise.race([fetchPromise, timeoutPromise]);

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

          // Update stats after each page
          await ProviderStats.updateOne(
            { source },
            {
              $inc: { totalFetched: songs.length },
              $set: { lastFetchedAt: new Date() }
            }
          );

          console.log(`Processed ${source} page ${page}: ${songs.length} songs, total: ${totalSongsProcessed}`);

          // Check if we should stop
          if (shouldStop || songs.length === 0) {
            shouldContinue = false;
            console.log(`Stopping fetch for ${source} at page ${page}. shouldStop: ${shouldStop}, noSongs: ${songs.length === 0}`);
          } else {
            page++;
            
            // Safety limit to prevent infinite loops
            if (page > 200) {
              console.log(`Safety limit reached for ${source}, stopping at page ${page}`);
              shouldContinue = false;
            }
          }
        }

        return { 
          totalSongsProcessed, 
          upsertedCount: totalUpserted, 
          updatedCount: totalUpdated,
          totalPagesProcessed: page - 1
        };

      } catch (error: any) {
        console.error(`Job failed for ${source}:`, error);

        // Track failed job in DB
        await ProviderStats.updateOne(
          { source },
          {
            $push: {
              failedJobs: {
                error: error.message,
                timestamp: new Date()
              }
            }
          }
        );

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

  worker.on('completed', (job) => {
    const result = job.returnvalue;
    console.log(`Job ${job.id} completed for ${job.data.source}!`);
    console.log(`Total songs processed: ${result?.totalSongsProcessed}`);
    console.log(`New songs added: ${result?.upsertedCount}`);
    console.log(`Songs updated: ${result?.updatedCount}`);
    console.log(`Total pages processed: ${result?.totalPagesProcessed}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
  });

  worker.on('drained', async () => {
    console.log('Queue drained! No more jobs.');

    // Update all provider stats to mark as not running
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
