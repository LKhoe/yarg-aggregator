import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db';
import User from '@/models/User';
import type { ISavedSong } from '@/types';

// Import saved songs from JSON
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const deviceId = request.headers.get('x-device-id');
    const deviceName = request.headers.get('x-device-name') || 'Unknown Device';

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required in x-device-id header' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate the import data
    if (!body.savedSongs || !Array.isArray(body.savedSongs)) {
      return NextResponse.json(
        { error: 'Invalid import format. Expected savedSongs array.' },
        { status: 400 }
      );
    }

    let user = await User.findOne({ deviceId });

    if (!user) {
      user = new User({
        deviceId,
        deviceName,
        savedSongs: [],
      });
    }

    // Track import statistics
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process each imported song
    for (const importedSong of body.savedSongs) {
      try {
        // Validate required fields
        if (!importedSong.musicId || !importedSong.name || !importedSong.artist) {
          errors.push(`Skipped invalid song: ${importedSong.name || 'Unknown'}`);
          skipped++;
          continue;
        }

        // Check if song already exists
        const songExists = user.savedSongs.some(
          (song: ISavedSong) => song.musicId === importedSong.musicId
        );

        if (songExists) {
          skipped++;
          continue;
        }

        // Add the song
        const newSong = {
          _id: new Types.ObjectId(),
          musicId: importedSong.musicId,
          name: importedSong.name,
          artist: importedSong.artist,
          addedAt: importedSong.addedAt ? new Date(importedSong.addedAt) : new Date(),
        };

        user.savedSongs.push(newSong as unknown as ISavedSong & { _id: Types.ObjectId });
        imported++;
      } catch (err) {
        errors.push(`Error importing song: ${importedSong.name || 'Unknown'}`);
        skipped++;
      }
    }

    // Save the user with imported songs
    await user.save();

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: body.savedSongs.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error importing saved songs:', error);
    return NextResponse.json(
      { error: 'Failed to import saved songs' },
      { status: 500 }
    );
  }
}
