
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Music from '@/models/Music';
import Provider from '@/models/Provider';
import AdmZip from 'adm-zip';
import { parseEnchorData, EnchorSong } from '@/services/providers/enchor';
import { parseRhythmverseData, RhythmVerseSongEntry } from '@/services/providers/rhythmverse';
import { ProviderMusic } from '@/types';
import { processSongsForDeduplication } from '@/services/songDeduplication';

// Disable body parsing for multipart forms? Next.js App Router handles FormData slightly differently
// We need to read the FormData from the request
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const source = formData.get('source') as string | null;

    if (!file || !source) {
      return NextResponse.json(
        { error: 'File and source are required' },
        { status: 400 }
      );
    }

    if (!['enchor', 'rhythmverse'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source' },
        { status: 400 }
      );
    }

    // Type assertion: at this point we know source is exactly 'enchor' or 'rhythmverse'
    const validatedSource = source as 'enchor' | 'rhythmverse';

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Initialiaze zip
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      return NextResponse.json({ error: 'Invalid zip file' }, { status: 400 });
    }

    const zipEntries = zip.getEntries();
    let totalProcessed = 0;
    let totalSaved = 0;
    let filesProcessed = 0;
    let songsToUpsert: ProviderMusic[] = [];

    for (const entry of zipEntries) {
      if (entry.isDirectory || !entry.name.endsWith('.json') || entry.name.startsWith('.')) continue;
      filesProcessed++;

      try {
        const fileContent = entry.getData().toString('utf8');
        const json = JSON.parse(fileContent);

        if (validatedSource === 'enchor') {
          // Enchor JSON structure: { data: [...] } or just [...]?
          // Based on fetchEnchor, response has { data: EnchorSong[] }
          // Let's assume the user saves the FULL response from the network tab.
          // Or maybe just the array? Let's try to detect.

          let items: EnchorSong[] = [];
          if (json.data && Array.isArray(json.data)) {
            items = json.data;
          } else {
            console.warn(`Skipping invalid Enchor JSON file: ${entry.name}`);
            continue;
          }

          const parsed = parseEnchorData(items);
          songsToUpsert.push(...parsed);

        } else if (validatedSource === 'rhythmverse') {
          // RhythmVerse JSON structure: { data: { songs: [...] } }
          let items: RhythmVerseSongEntry[] = [];
          if (json.data && json.data.songs && Array.isArray(json.data.songs)) {
            items = json.data.songs;
          } else {
            console.warn(`Skipping invalid RhythmVerse JSON file: ${entry.name}`);
            continue;
          }

          const parsed = parseRhythmverseData(items);
          songsToUpsert.push(...parsed);
        }

      } catch (err) {
        console.error(`Failed to parse JSON for entry ${entry.name}:`, err);
      }
    }

    totalProcessed = songsToUpsert.length;

    if (totalProcessed > 0) {
      await connectDB();

      // Process songs for deduplication
      const { songsToSave, duplicateInfo } = await processSongsForDeduplication(songsToUpsert, validatedSource);
      
      console.log(`Deduplication results: ${songsToSave.length} songs to save out of ${totalProcessed} processed`);
      
      // Log duplicate decisions for debugging
      duplicateInfo.forEach((info, index) => {
        if (info.found) {
          console.log(`Song "${info.song.name}" by ${info.song.artist}: ${info.decision} - ${info.reason}`);
        }
      });

      if (songsToSave.length > 0) {
        const bulkOps = songsToSave.map((song) => ({
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
            const res = await Music.bulkWrite(batch, { ordered: false });
            totalSaved += (res.insertedCount + res.upsertedCount);
            console.log(`Batch ${i / batchSize + 1}: Inserted ${res.insertedCount}, upserted ${res.upsertedCount}`);
          } catch (error: any) {
            // Handle duplicate key errors gracefully
            if (error.code === 11000 && error.result) {
              // Some operations succeeded, count them
              totalSaved += (error.result.insertedCount + error.result.upsertedCount);
              console.log(`Batch ${i / batchSize + 1}: Processed with ${batch.length - error.writeErrors?.length || 0} duplicate(s)`);
            } else {
              // Re-throw if it's not a duplicate key error
              throw error;
            }
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

    console.log(`Processed ${totalProcessed} songs from ${filesProcessed} files, saved ${totalSaved} new songs after deduplication`);

    return NextResponse.json({
      success: true,
      message: `Processed ${totalProcessed} songs from ${filesProcessed} files, saved ${totalSaved} new songs after deduplication.`,
      count: totalSaved,
      processed: totalProcessed,
      duplicates: totalProcessed - totalSaved,
    });

  } catch (error) {
    console.error('Upload handler error:', error);
    return NextResponse.json(
      { error: 'Internal server error processing upload' },
      { status: 500 }
    );
  }
}
