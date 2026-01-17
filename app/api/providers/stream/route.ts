import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import Provider from '@/models/Provider';
import Music from '@/models/Music';
import { fetchEnchor, fetchRhythmverse } from '@/services/providers';
import { processSongsForDeduplication } from '@/services/songDeduplication';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  try {
    const body = await request.json();
    const { source, retryFailed = false } = body;

    if (!['enchor', 'rhythmverse'].includes(source)) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'Invalid source. Must be enchor or rhythmverse' })}\n\n`));
      await writer.close();
      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Simple in-memory check for running providers (without Redis)
    const runningProviders = new Set();
    if (runningProviders.has(source)) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: `Provider is already running for ${source}` })}\n\n`));
      await writer.close();
      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    runningProviders.add(source);

    // Start processing in background
    (async () => {
      try {
        await connectDB();
        const providerData = await Provider.findOne(
          { name: source },
          'lastSuccessfulFetch',
        ).lean();
        const latestSourceUpdatedAt = providerData?.lastSuccessfulFetch;

        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'start', message: `Starting fetch for ${source}` })}\n\n`));

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
        const baseBackoffMs = 5000;

        while (shouldContinue) {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: `Processing ${source} page ${page}...` })}\n\n`));

          // Add delay between requests (except for first page)
          if (page > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          let retryCount = 0;
          let pageSuccess = false;

          // Retry logic for pages > 1
          while (!pageSuccess && retryCount < maxRetries) {
            try {
              const timeoutPromise = new Promise<{ songs: any[]; shouldStop: boolean }>((_, reject) => {
                setTimeout(() => reject(new Error('Task timed out')), 30000);
              });
              const fetchPromise = fetchFn(page, pageSize, latestSourceUpdatedAt);
              const { songs, shouldStop } = await Promise.race([fetchPromise, timeoutPromise]);

              if (page === 1 && songs.length > 0) {
                lastSuccessfulFetchCandidate = songs[0]?.sourceUpdatedAt;
              }

              if (songs.length > 0) {
                // Process songs for deduplication
                const { songsToSave, duplicateInfo } = await processSongsForDeduplication(songs, source);
                
                const duplicateCount = songs.length - songsToSave.length;
                
                // Log deduplication results
                if (duplicateCount > 0) {
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'deduplication_info', 
                    page,
                    totalSongs: songs.length,
                    songsToSave: songsToSave.length,
                    duplicatesSkipped: duplicateCount
                  })}\n\n`));
                }

                if (songsToSave.length > 0) {
                  const operations = songsToSave.map(song => ({
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

                  await writer.write(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'page_complete', 
                    page, 
                    songsProcessed: songs.length,
                    songsToSave: songsToSave.length,
                    duplicatesSkipped: duplicateCount,
                    totalSongsProcessed,
                    newSongs: bulkResult.upsertedCount,
                    updatedSongs: bulkResult.modifiedCount
                  })}\n\n`));
                } else {
                  // All songs were duplicates, no database operations needed
                  totalSongsProcessed += songs.length;
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'page_complete', 
                    page, 
                    songsProcessed: songs.length,
                    songsToSave: 0,
                    duplicatesSkipped: duplicateCount,
                    totalSongsProcessed,
                    newSongs: 0,
                    updatedSongs: 0
                  })}\n\n`));
                }
              }

              pageSuccess = true;

              // Check if we should stop
              if (shouldStop || songs.length === 0) {
                shouldContinue = false;
              } else {
                page++;
              }

            } catch (error: any) {
              retryCount++;

              if (retryCount <= maxRetries) {
                const backoffMs = baseBackoffMs * Math.pow(2, retryCount - 1);
                await writer.write(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'retry', 
                  page, 
                  attempt: retryCount,
                  maxRetries,
                  message: `Page ${page} failed, retrying in ${backoffMs}ms: ${error.message}`
                })}\n\n`));
                await new Promise(resolve => setTimeout(resolve, backoffMs));
              } else {
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

        await writer.write(encoder.encode(`data: ${JSON.stringify({ 
          type: 'complete', 
          totalSongsProcessed,
          newSongs: totalUpserted,
          updatedSongs: totalUpdated,
          totalPagesProcessed: page - 1
        })}\n\n`));

      } catch (error: any) {
        console.error(`Stream processing failed for ${source}:`, error);
        await writer.write(encoder.encode(`data: ${JSON.stringify({ 
          type: 'error', 
          message: error.message 
        })}\n\n`));
      } finally {
        // Clear running status from in-memory set
        runningProviders.delete(source);
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
    await writer.close();
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
}
