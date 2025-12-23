import { fetchEnchor, getTotalPages as getEnchorPages } from './enchor';
import { fetchRhythmverse, getTotalPages as getRhythmversePages } from './rhythmverse';
import connectDB from '@/lib/db';
import Music from '@/models/Music';
import ProviderFetchSession from '@/models/ProviderFetchSession';
import ProviderStats from '@/models/ProviderStats';
import type { ProviderMusic } from '@/types';

export type FetcherSource = 'enchor' | 'rhythmverse' | 'all';

export interface FetcherOptions {
  source: FetcherSource;
  maxPages?: number;
  concurrency?: number;
  onProgress?: (data: {
    source: string;
    currentPage: number;
    totalPages: number;
    songsProcessed: number;
    totalSongs: number;
  }) => void;
}

export interface FetcherResult {
  success: boolean;
  totalFetched: number;
  totalSaved: number;
  errors: string[];
}

async function saveSongs(songs: ProviderMusic[], source: 'enchor' | 'rhythmverse'): Promise<number> {
  await connectDB();
  let saved = 0;

  for (const song of songs) {
    try {
      const instruments: Record<string, number> = {};
      if (song.instruments?.drums !== undefined) instruments.drums = song.instruments.drums;
      if (song.instruments?.bass !== undefined) instruments.bass = song.instruments.bass;
      if (song.instruments?.guitar !== undefined) instruments.guitar = song.instruments.guitar;
      if (song.instruments?.prokeys !== undefined) instruments.prokeys = song.instruments.prokeys;
      if (song.instruments?.vocals !== undefined) instruments.vocals = song.instruments.vocals;

      await Music.findOneAndUpdate(
        { name: song.name, artist: song.artist, source, instruments },
        {
          ...song,
          source,
          instruments,
          updatedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      saved++;
    } catch (error) {
      // Duplicate key errors are expected, ignore them
      const mongoError = error as { code?: number };
      if (mongoError.code !== 11000) {
        console.error('Error saving song:', song.name, error);
      }
    }
  }

  return saved;
}

export interface ProviderOptions {
  source: FetcherSource;
  recordsToFetch?: number;
  concurrency?: number;
  forceSync?: boolean;
  page?: number; // Added for single page execution
  limit?: number; // Added for single page execution
  sortDirection?: 'asc' | 'desc' | 'ASC' | 'DESC'; // Added for single page execution
  sessionId?: string; // Added for single page execution
  onProgress?: (data: {
    source: string;
    currentPage: number;
    totalPages: number;
    songsProcessed: number;
    totalSongs: number;
    totalAvailable: number;
  }) => void;
}

export interface ProviderResult {
  success: boolean;
  totalFetched: number;
  totalSaved: number;
  errors: string[];
}

export async function runProviderBatch(options: {
  source: 'enchor' | 'rhythmverse';
  page: number;
  limit: number;
  sortDirection: 'asc' | 'desc' | 'ASC' | 'DESC';
  sessionId?: string;
  totalRecordsRequested: number;
  onProgress?: (data: {
    source: string;
    currentPage: number;
    totalPages: number;
    songsProcessed: number;
    totalSongs: number;
    totalAvailable: number;
  }) => void;
}): Promise<ProviderResult> {
  const { source, page, limit, sortDirection, sessionId, totalRecordsRequested, onProgress } = options;
  const errors: string[] = [];
  let totalFetched = 0;
  let totalSaved = 0;

  try {
    const fetch = source === 'enchor' ? fetchEnchor : fetchRhythmverse;
    const { songs, totalFound } = await fetch(page, limit, sortDirection as any);

    if (songs.length > 0) {
      totalFetched = songs.length;
      totalSaved = await saveSongs(songs, source);

      // Update stats in DB
      const currentLocalCount = await Music.countDocuments({ source });
      await ProviderStats.updateOne(
        { source },
        {
          totalFetched: currentLocalCount,
          totalAvailable: totalFound,
          lastFetchedAt: new Date()
        }
      );

      if (onProgress) {
        onProgress({
          source,
          currentPage: page,
          totalPages: Math.ceil(totalRecordsRequested / limit),
          songsProcessed: totalFetched,
          totalSongs: totalRecordsRequested,
          totalAvailable: totalFound,
        });
      }
    }
  } catch (error) {
    const errMsg = `Error in batch ${source} p${page}: ${error}`;
    console.error(errMsg);
    errors.push(errMsg);
  }

  return {
    success: errors.length === 0,
    totalFetched,
    totalSaved,
    errors,
  };
}

export async function runProvider(options: ProviderOptions): Promise<ProviderResult> {
  const { source, recordsToFetch = 100, forceSync = false, onProgress, sessionId } = options;
  const errors: string[] = [];
  let totalFetchedInSession = 0;
  let totalSavedInSession = 0;

  const sources: ('enchor' | 'rhythmverse')[] =
    source === 'all' ? ['enchor', 'rhythmverse'] : [source];

  await connectDB();

  for (const src of sources) {
    try {
      console.log(`Starting ${src} provider: requesting ${recordsToFetch} records`);

      // 1. Initial fetch to get total available
      const fetch = src === 'enchor' ? fetchEnchor : fetchRhythmverse;
      const initialBatch = await fetch(1, 1);
      const totalAvailable = initialBatch.totalFound;

      // 2. Update stats in DB
      const localCount = await Music.countDocuments({ source: src });
      await ProviderStats.findOneAndUpdate(
        { source: src },
        {
          totalAvailable,
          totalFetched: localCount,
          lastFetchedAt: new Date()
        },
        { upsert: true, new: true }
      );

      // 3. Determine sorting
      const ratio = totalAvailable > 0 ? localCount / totalAvailable : 0;
      const sortDirection = ratio < 0.5 ? (src === 'enchor' ? 'asc' : 'ASC') : (src === 'enchor' ? 'desc' : 'DESC');

      // 4. Calculate pages
      const pageSize = src === 'enchor' ? 20 : 25;
      const totalPagesRequested = Math.ceil(recordsToFetch / pageSize);

      let recordsRemaining = recordsToFetch;

      for (let page = 1; page <= totalPagesRequested; page++) {
        const currentBatchSize = Math.min(pageSize, recordsRemaining);
        if (currentBatchSize <= 0) break;

        const result = await runProviderBatch({
          source: src,
          page,
          limit: currentBatchSize,
          sortDirection: sortDirection as any,
          sessionId,
          totalRecordsRequested: recordsToFetch,
          onProgress
        });

        totalFetchedInSession += result.totalFetched;
        totalSavedInSession += result.totalSaved;
        errors.push(...result.errors);

        recordsRemaining -= result.totalFetched;
        if (result.totalFetched === 0) break;

        // Rate limiting for sequential execution
        await new Promise(resolve => setTimeout(resolve, 200));
      }

    } catch (sourceError) {
      const errMsg = `Error with ${src} provider: ${sourceError}`;
      console.error(errMsg);
      errors.push(errMsg);
    }
  }

  return {
    success: errors.length === 0,
    totalFetched: totalFetchedInSession,
    totalSaved: totalSavedInSession,
    errors,
  };
}

function advanceCursor(options: {
  page: number;
  index: number;
  take: number;
  pageSize: number;
}) {
  const { pageSize, take } = options;
  let page = options.page;
  let index = options.index + take;

  while (index >= pageSize) {
    page += 1;
    index -= pageSize;
  }

  return { page, index };
}

async function promisePool<T, R>(options: {
  items: T[];
  concurrency: number;
  worker: (item: T, index: number) => Promise<R>;
}): Promise<R[]> {
  const { items, worker } = options;
  const concurrency = Math.max(1, Math.floor(options.concurrency || 1));

  const results: R[] = new Array(items.length);
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < items.length; i++) {
    const p = (async () => {
      results[i] = await worker(items[i], i);
    })();

    let wrapped: Promise<void>;
    wrapped = p.then(() => {
      executing.delete(wrapped);
    });
    executing.add(wrapped);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

export async function runProviderSession(options: {
  sessionId: string;
  concurrency?: number;
  startJobIndex?: number;
}): Promise<void> {
  const { sessionId, startJobIndex = 0 } = options;
  const concurrency = Math.max(1, Math.floor(options.concurrency || parseInt(process.env.PROVIDER_CONCURRENCY || '5')));

  await connectDB();

  const session = await ProviderFetchSession.findOne({ sessionId });
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (session.status !== 'running') {
    return;
  }

  const requestedSongs = session.requestedSongs;

  const jobs = session.jobs
    .map((job, idx) => ({ job, idx }))
    .filter(({ idx }) => idx >= startJobIndex);

  const errors: string[] = [];
  const perSourceDirectionFinalCursor = new Map<string, { page: number; index: number }>();

  // Pre-compute final cursor per (source + direction) from the job list. We only persist on success.
  for (const { job } of jobs) {
    const source = job.source;
    const sortDirection = job.sortDirection;
    const directionKey = sortDirection === 'asc' || sortDirection === 'ASC' ? 'asc' : 'desc';
    const key = `${source}:${directionKey}`;

    const pageSize = source === 'enchor' ? 20 : 25;
    const startPage = job.page ?? 1;
    const startIndex = job.index ?? 0;
    const next = advanceCursor({ page: startPage, index: startIndex, take: job.take, pageSize });
    perSourceDirectionFinalCursor.set(key, next);
  }

  try {
    await promisePool({
      items: jobs,
      concurrency,
      worker: async ({ job, idx: jobIndex }) => {
        try {
          // Only transition pending/failed -> running; if already completed/running, skip.
          const transition = await ProviderFetchSession.updateOne(
            {
              sessionId,
              status: 'running',
              [`jobs.${jobIndex}.status`]: { $in: ['pending', 'failed'] },
            },
            {
              $set: {
                [`jobs.${jobIndex}.status`]: 'running',
                [`jobs.${jobIndex}.error`]: '',
              },
            }
          );

          if (transition.modifiedCount === 0) {
            return;
          }

          const source = job.source;
          const sortDirection = job.sortDirection;
          const fetchFn = source === 'enchor' ? fetchEnchor : fetchRhythmverse;
          const providerPageSize = source === 'enchor' ? 20 : 25;

          const page = job.page ?? 1;
          const index = job.index ?? 0;

          const { songs, totalFound } = await fetchFn(page, providerPageSize, sortDirection as any);

          const slice = (songs || []).slice(index, index + job.take);
          const fetchedTotal = slice.length;
          const savedTotal = fetchedTotal > 0 ? await saveSongs(slice, source) : 0;

          // Update ProviderStats totals (best effort)
          await ProviderStats.updateOne(
            { source },
            {
              totalAvailable: totalFound,
              totalFetched: await Music.countDocuments({ source }),
              lastFetchedAt: new Date(),
            },
            { upsert: true }
          );

          await ProviderFetchSession.updateOne(
            { sessionId },
            {
              $set: {
                [`jobs.${jobIndex}.status`]: 'completed',
                [`jobs.${jobIndex}.fetched`]: fetchedTotal,
                [`jobs.${jobIndex}.saved`]: savedTotal,
              },
              $inc: {
                fetchedSongs: fetchedTotal,
                savedSongs: savedTotal,
                jobsCompleted: 1,
              },
            }
          );
        } catch (error) {
          const errMsg = String(error);
          await ProviderFetchSession.updateOne(
            { sessionId, status: 'running' },
            {
              $set: {
                status: 'failed',
                failedJobIndex: jobIndex,
                [`jobs.${jobIndex}.status`]: 'failed',
                [`jobs.${jobIndex}.error`]: errMsg,
              },
              $push: { fetchErrors: errMsg },
            }
          );

          throw error;
        }
      },
    });

    // Mark session completed only if it is still running (another job may have marked it failed)
    await ProviderFetchSession.updateOne(
      { sessionId, status: 'running' },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
        },
      }
    );

    const finalSession = await ProviderFetchSession.findOne({ sessionId });
    if (finalSession?.status === 'completed') {
      // Persist final cursors per source/direction
      for (const [key, cursor] of perSourceDirectionFinalCursor.entries()) {
        const [source, directionKey] = key.split(':') as ['enchor' | 'rhythmverse', 'asc' | 'desc'];
        const pageField = directionKey === 'asc' ? 'nextPageAsc' : 'nextPageDesc';
        const indexField = directionKey === 'asc' ? 'nextIndexAsc' : 'nextIndexDesc';

        await ProviderStats.updateOne(
          { source },
          {
            $set: {
              [pageField]: cursor.page,
              [indexField]: cursor.index,
              totalFetched: await Music.countDocuments({ source }),
              lastFetchedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }
    }
  } catch (error) {
    const errMsg = String(error);
    errors.push(errMsg);

    await ProviderFetchSession.updateOne(
      { sessionId },
      {
        $set: {
          status: 'failed',
        },
        $push: { fetchErrors: errMsg },
      }
    );

    throw error;
  }
}

export { fetchEnchor as fetchEnchor, fetchRhythmverse as fetchRhythmverse };
