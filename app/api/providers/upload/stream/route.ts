import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import Music from '@/models/Music';
import Provider from '@/models/Provider';
import AdmZip from 'adm-zip';
import { parseEnchorData, EnchorSong } from '@/services/providers/enchor';
import { parseRhythmverseData, RhythmVerseSongEntry } from '@/services/providers/rhythmverse';
import { ProviderMusic } from '@/types';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const source = formData.get('source') as string | null;

    if (!file || !source) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'File and source are required' })}\n\n`));
      await writer.close();
      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    if (!['enchor', 'rhythmverse'].includes(source)) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'Invalid source' })}\n\n`));
      await writer.close();
      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const validatedSource = source as 'enchor' | 'rhythmverse';

    // Start processing in background
    (async () => {
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'start', message: `Processing upload for ${source}` })}\n\n`));

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: 'Extracting zip file...' })}\n\n`));

        // Initialize zip
        let zip: AdmZip;
        try {
          zip = new AdmZip(buffer);
        } catch (error) {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Invalid zip file' })}\n\n`));
          await writer.close();
          return;
        }

        const zipEntries = zip.getEntries();
        let totalProcessed = 0;
        let totalSaved = 0;
        let filesProcessed = 0;
        let songsToUpsert: ProviderMusic[] = [];

        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: `Found ${zipEntries.length} entries in zip file` })}\n\n`));

        for (const entry of zipEntries) {
          if (entry.isDirectory || !entry.name.endsWith('.json') || entry.name.startsWith('.')) continue;
          filesProcessed++;

          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: `Processing file ${filesProcessed}: ${entry.name}` })}\n\n`));

          try {
            const fileContent = entry.getData().toString('utf8');
            const json = JSON.parse(fileContent);

            if (validatedSource === 'enchor') {
              let items: EnchorSong[] = [];
              if (json.data && Array.isArray(json.data)) {
                items = json.data;
              } else {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'warning', message: `Skipping invalid Enchor JSON file: ${entry.name}` })}\n\n`));
                continue;
              }

              const parsed = parseEnchorData(items);
              songsToUpsert.push(...parsed);

            } else if (validatedSource === 'rhythmverse') {
              let items: RhythmVerseSongEntry[] = [];
              if (json.data && json.data.songs && Array.isArray(json.data.songs)) {
                items = json.data.songs;
              } else {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'warning', message: `Skipping invalid RhythmVerse JSON file: ${entry.name}` })}\n\n`));
                continue;
              }

              const parsed = parseRhythmverseData(items);
              songsToUpsert.push(...parsed);
            }

          } catch (err) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'warning', message: `Failed to parse JSON for entry ${entry.name}: ${err}` })}\n\n`));
          }
        }

        totalProcessed = songsToUpsert.length;

        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: `Parsed ${totalProcessed} songs from ${filesProcessed} files` })}\n\n`));

        if (totalProcessed > 0) {
          await connectDB();

          const bulkOps = songsToUpsert.map((song) => ({
            updateOne: {
              filter: {
                source: validatedSource,
                name: song.name,
                artist: song.artist,
                instruments: song.instruments
              },
              update: {
                $set: { ...song, source: validatedSource, sourceUpdatedAt: song.sourceUpdatedAt || new Date() }
              },
              upsert: true,
            },
          }));

          // Batch write with ordered: false to continue processing despite duplicates
          const batchSize = 500;
          for (let i = 0; i < bulkOps.length; i += batchSize) {
            const batch = bulkOps.slice(i, i + batchSize);
            try {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(bulkOps.length / batchSize)}` })}\n\n`));
              
              const res = await Music.bulkWrite(batch, { ordered: false });
              totalSaved += (res.insertedCount + res.upsertedCount);
              
              await writer.write(encoder.encode(`data: ${JSON.stringify({ 
                type: 'batch_complete', 
                batch: Math.floor(i / batchSize) + 1,
                totalBatches: Math.ceil(bulkOps.length / batchSize),
                inserted: res.insertedCount,
                upserted: res.upsertedCount,
                totalSaved: totalSaved
              })}\n\n`));
              
            } catch (error: any) {
              // Handle duplicate key errors gracefully
              if (error.code === 11000 && error.result) {
                totalSaved += (error.result.insertedCount + error.result.upsertedCount);
                await writer.write(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'batch_complete', 
                  batch: Math.floor(i / batchSize) + 1,
                  totalBatches: Math.ceil(bulkOps.length / batchSize),
                  inserted: error.result.insertedCount,
                  upserted: error.result.upsertedCount,
                  totalSaved: totalSaved,
                  duplicates: batch.length - error.writeErrors?.length || 0
                })}\n\n`));
              } else {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: `Batch ${Math.floor(i / batchSize) + 1} failed: ${error.message}` })}\n\n`));
                throw error;
              }
            }
          }
        }

        // Update provider's lastSuccessfulFetch with the highest sourceUpdatedAt
        if (totalSaved > 0) {
          const latestSong = await Music.findOne({ source: validatedSource })
            .sort({ sourceUpdatedAt: -1 })
            .select('sourceUpdatedAt')
            .lean();

          if (latestSong?.sourceUpdatedAt) {
            await Provider.updateOne(
              { name: validatedSource },
              { $set: { lastSuccessfulFetch: latestSong.sourceUpdatedAt } },
              { upsert: true }
            );
          }
        }

        await writer.write(encoder.encode(`data: ${JSON.stringify({ 
          type: 'complete', 
          message: `Processed ${totalProcessed} songs from ${filesProcessed} files, saved ${totalSaved} new songs.`,
          totalProcessed,
          filesProcessed,
          totalSaved
        })}\n\n`));

      } catch (error: any) {
        console.error('Stream upload error:', error);
        await writer.write(encoder.encode(`data: ${JSON.stringify({ 
          type: 'error', 
          message: error.message 
        })}\n\n`));
      } finally {
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
