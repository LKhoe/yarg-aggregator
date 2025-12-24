import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db';
import User from '@/models/User';
import type { ISavedSong } from '@/types';

// Get user's saved songs
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const deviceId = request.headers.get('x-device-id');

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required in x-device-id header' },
        { status: 400 }
      );
    }

    const user = await User.findOne({ deviceId }).lean();

    if (!user) {
      return NextResponse.json({ savedSongs: [] });
    }

    return NextResponse.json({
      savedSongs: user.savedSongs,
      deviceName: user.deviceName,
    });
  } catch (error) {
    console.error('Error fetching saved songs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved songs' },
      { status: 500 }
    );
  }
}

// Get user's saved songs
// Add a song to saved songs
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const deviceId = request.headers.get('x-device-id');
    const deviceName = request.headers.get('x-device-name') || 'Unknown Device';
    const { musicId: musicIdStr, name, artist } = await request.json();
    const musicId = new Types.ObjectId(musicIdStr);

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required in x-device-id header' },
        { status: 400 }
      );
    }

    if (!musicId || !name || !artist) {
      return NextResponse.json(
        { error: 'musicId, name, and artist are required' },
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

    // Check if song is already saved
    const songExists = user.savedSongs.some(
      (song: ISavedSong) => {
        return song.musicId === musicId.toString();
      }
    );

    if (songExists) {
      return NextResponse.json(
        { error: 'Song is already saved' },
        { status: 400 }
      );
    }

    // Add the new song
    const newSong = {
      _id: new Types.ObjectId(),
      musicId,
      name,
      artist,
      addedAt: new Date(),
    } as const;
    user.savedSongs.push(newSong as unknown as ISavedSong & { _id: Types.ObjectId });

    await user.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving song:', error);
    return NextResponse.json(
      { error: 'Failed to save song' },
      { status: 500 }
    );
  }
}

// Remove a song from saved songs
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const deviceId = request.headers.get('x-device-id');
    const { musicId } = await request.json();

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required in x-device-id header' },
        { status: 400 }
      );
    }

    if (!musicId) {
      return NextResponse.json(
        { error: 'musicId is required' },
        { status: 400 }
      );
    }

    const user = await User.findOne({ deviceId });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Remove the song
    user.savedSongs = user.savedSongs.filter(
      (song: ISavedSong) => song.musicId.toString() !== musicId
    );

    await user.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing song:', error);
    return NextResponse.json(
      { error: 'Failed to remove song' },
      { status: 500 }
    );
  }
}

// Clear all saved songs
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();

    const deviceId = request.headers.get('x-device-id');

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required in x-device-id header' },
        { status: 400 }
      );
    }

    const user = await User.findOne({ deviceId });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Clear all saved songs
    user.savedSongs = [];
    await user.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing saved songs:', error);
    return NextResponse.json(
      { error: 'Failed to clear saved songs' },
      { status: 500 }
    );
  }
}
