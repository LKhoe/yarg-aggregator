import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';

// Export saved songs as JSON
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

    if (!user || !user.savedSongs || user.savedSongs.length === 0) {
      return NextResponse.json(
        { error: 'No saved songs found' },
        { status: 404 }
      );
    }

    // Create JSON response with saved songs
    const exportData = {
      exportedAt: new Date().toISOString(),
      deviceId: user.deviceId,
      deviceName: user.deviceName,
      savedSongs: user.savedSongs,
    };

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="saved-songs-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting saved songs:', error);
    return NextResponse.json(
      { error: 'Failed to export saved songs' },
      { status: 500 }
    );
  }
}
