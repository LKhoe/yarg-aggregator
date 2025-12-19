import { fetchEnchor, getTotalPages as getEnchorPages } from './enchor';
import { fetchRhythmverse, getTotalPages as getRhythmversePages } from './rhythmverse';
import connectDB from '@/lib/db';
import Music from '@/models/Music';
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
      await Music.findOneAndUpdate(
        { name: song.name, artist: song.artist, source },
        {
          ...song,
          source,
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

import getRedis from '@/lib/redis';

export interface ProviderOptions {
  source: FetcherSource;
  maxPages?: number;
  concurrency?: number;
  forceSync?: boolean;
  onProgress?: (data: {
    source: string;
    currentPage: number;
    totalPages: number;
    songsProcessed: number;
    totalSongs: number;
  }) => void;
}

export interface ProviderResult {
  success: boolean;
  totalFetched: number;
  totalSaved: number;
  errors: string[];
}

export async function runProvider(options: ProviderOptions): Promise<ProviderResult> {
  const { source, maxPages = 10, forceSync = false, onProgress } = options;
  const errors: string[] = [];
  let totalFetched = 0;
  let totalSaved = 0;

  const sources: ('enchor' | 'rhythmverse')[] = 
    source === 'all' ? ['enchor', 'rhythmverse'] : [source];

  const redis = getRedis();

  for (const src of sources) {
    try {
      const getTotalPages = src === 'enchor' ? getEnchorPages : getRhythmversePages;
      const fetch = src === 'enchor' ? fetchEnchor : fetchRhythmverse;
      const checkpointKey = `provider:checkpoint:${src}`;

      // Get latest song date from DB to check for overlap
      // We start checking for overlap immediately
      // If we find a song with sourceUpdatedAt <= latestDbDate, we know we've reached old data
      const latestSong = await Music.findOne({ source: src }).sort({ sourceUpdatedAt: -1 });
      const latestDbDate = latestSong?.sourceUpdatedAt?.getTime() || 0;

      // Determine start page
      let startPage = 1;
      if (!forceSync) {
        const checkpoint = await redis.get(checkpointKey);
        if (checkpoint) {
          startPage = parseInt(checkpoint, 10);
          console.log(`Resuming ${src} provider from page ${startPage}`);
        }
      }

      if (forceSync) {
        console.log(`Force sync enabled for ${src}, starting from page 1`);
        startPage = 1;
      }

      const totalPages = Math.min(await getTotalPages(), maxPages);
      console.log(`Starting ${src} provider: ${totalPages} pages (from ${startPage})`);

      for (let page = startPage; page <= totalPages; page++) {
        try {
          const songs = await fetch(page);
          if (songs.length === 0) break;

          // Check for incremental stop condition
          // Only applicable if sorting DESC (Newest First)
          // Enchor is DESC, Rhythmverse is ASC (Oldest First)
          const isDescSort = src === 'enchor';

          let allOld = true;
          let newSongsInBatch = 0;

          if (!forceSync && latestDbDate > 0 && isDescSort) {
            for (const song of songs) {
              const songDate = song.sourceUpdatedAt?.getTime() || 0;
              if (songDate > latestDbDate) {
                allOld = false;
                newSongsInBatch++;
              }
            }

            if (allOld) {
              console.log(`Reached existing data for ${src} at page ${page}. Stopping.`);
              break; 
            }
          }

          totalFetched += songs.length;

          const saved = await saveSongs(songs, src);
          totalSaved += saved;

          // Update checkpoint
          await redis.set(checkpointKey, page.toString());

          if (onProgress) {
            onProgress({
              source: src,
              currentPage: page,
              totalPages,
              songsProcessed: totalFetched,
              totalSongs: totalFetched, 
            });
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (pageError) {
          const errMsg = `Error fetching ${src} page ${page}: ${pageError}`;
          console.error(errMsg);
          errors.push(errMsg);
          // Don't break on page error, try next? Or stop? 
          // Usually best to stop if we want strict consistency, but here let's continue to attempt next page
          // actually, if a page fails, we shouldn't update checkpoint past it. 
          // But here we update checkpoint AFTER success.
        }
      }
      
      // If we finished successfully or stopped early due to 'allOld', reset checkpoint to 1 for next run?
      // Or keep it? If we keep it, next run starts at page X. 
      // User asked: "start from where it stopped (if an error occurred)".
      // But if it finished, we should probably reset to 1 for next schedule.
      // Or maybe the user logic implies we just query page 1 again next time to get NEW updates.
      // If we stop because of "allOld", we are up to date. Next run should start at 1.
      // If we stop because of "error", we should resume.
      // So: Only clear checkpoint if we finish the loop naturally or break due to 'allOld'.
      // If we exit due to crash/error, checkpoint remains.
      if (errors.length === 0) {
          await redis.del(checkpointKey);
      }

    } catch (sourceError) {
      const errMsg = `Error with ${src} provider: ${sourceError}`;
      console.error(errMsg);
      errors.push(errMsg);
    }
  }

  return {
    success: errors.length === 0,
    totalFetched,
    totalSaved,
    errors,
  };
}

export { fetchEnchor as fetchEnchor, fetchRhythmverse as fetchRhythmverse };
