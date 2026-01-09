import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import SharedMusic from '@/models/SharedMusic';
import User from '@/models/User';

// POST: Create a new shared music record
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { fromDeviceId, toDeviceId, songs } = body;

    if (!fromDeviceId || !toDeviceId || !songs || !Array.isArray(songs)) {
      return NextResponse.json(
        { error: 'fromDeviceId, toDeviceId, and songs array are required' },
        { status: 400 }
      );
    }

    // Verify both devices exist
    const [fromDevice, toDevice] = await Promise.all([
      User.findOne({ deviceId: fromDeviceId }),
      User.findOne({ deviceId: toDeviceId }),
    ]);

    if (!fromDevice) {
      return NextResponse.json(
        { error: 'Source device not found' },
        { status: 404 }
      );
    }

    if (!toDevice) {
      return NextResponse.json(
        { error: 'Target device not found' },
        { status: 404 }
      );
    }

    // Create shared music record
    const sharedMusic = await SharedMusic.create({
      fromDeviceId,
      toDeviceId,
      songs,
      status: 'pending',
    });

    return NextResponse.json({
      success: true,
      message: `Shared ${songs.length} songs`,
      shareId: sharedMusic._id,
    });
  } catch (error) {
    console.error('Error creating shared music:', error);
    return NextResponse.json(
      { error: 'Failed to share music' },
      { status: 500 }
    );
  }
}

// GET: Retrieve pending shares for a device
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId query parameter is required' },
        { status: 400 }
      );
    }

    // Find pending shares for this device
    const pendingShares = await SharedMusic.find({
      toDeviceId: deviceId,
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .lean();

    // Get sender information for each share
    const sharesWithSenderInfo = await Promise.all(
      pendingShares.map(async (share) => {
        const sender = await User.findOne(
          { deviceId: share.fromDeviceId },
          { deviceName: 1 }
        ).lean();

        return {
          _id: share._id,
          fromDeviceId: share.fromDeviceId,
          fromDeviceName: sender?.deviceName || 'Unknown User',
          songs: share.songs,
          createdAt: share.createdAt,
        };
      })
    );

    // Mark these shares as viewed
    if (pendingShares.length > 0) {
      await SharedMusic.updateMany(
        { _id: { $in: pendingShares.map((s) => s._id) } },
        { $set: { viewedAt: new Date() } }
      );
    }

    return NextResponse.json({
      shares: sharesWithSenderInfo,
    });
  } catch (error) {
    console.error('Error getting shared music:', error);
    return NextResponse.json(
      { error: 'Failed to get shared music' },
      { status: 500 }
    );
  }
}

// PATCH: Update share status (accept/reject)
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { shareId, status } = body;

    if (!shareId || !status || !['accepted', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'shareId and valid status (accepted/rejected) are required' },
        { status: 400 }
      );
    }

    const share = await SharedMusic.findByIdAndUpdate(
      shareId,
      { $set: { status } },
      { new: true }
    );

    if (!share) {
      return NextResponse.json(
        { error: 'Share not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Share ${status}`,
      share,
    });
  } catch (error) {
    console.error('Error updating share status:', error);
    return NextResponse.json(
      { error: 'Failed to update share status' },
      { status: 500 }
    );
  }
}
