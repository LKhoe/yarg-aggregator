import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';

// Register or update device
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { deviceId, deviceName } = body;

    if (!deviceId || !deviceName) {
      return NextResponse.json(
        { error: 'deviceId and deviceName are required' },
        { status: 400 }
      );
    }

    const user = await User.findOneAndUpdate(
      { deviceId },
      {
        $setOnInsert: { deviceId },
        $set: { deviceName, lastSeenAt: new Date() },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      message: 'Device registered',
      deviceId: user.deviceId,
      deviceName: user.deviceName,
    });
  } catch (error) {
    console.error('Error registering device:', error);
    return NextResponse.json(
      { error: 'Failed to register device' },
      { status: 500 }
    );
  }
}

// Get all users with recent access (for sharing)
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Get exclude parameter from query string
    const { searchParams } = new URL(request.url);
    const excludeDeviceId = searchParams.get('exclude');

    // Find all users (optionally excluding the requesting device)
    const query = excludeDeviceId ? { deviceId: { $ne: excludeDeviceId } } : {};
    const users = await User.find(query, { deviceId: 1, deviceName: 1, lastSeenAt: 1 })
      .sort({ lastSeenAt: -1 }) // Sort by most recent first
      .limit(5) // Limit to 5 most recent users
      .lean();

    // Calculate online status based on lastSeenAt (online if within last 60 seconds)
    const now = new Date();
    const ONLINE_THRESHOLD_MS = 60000; // 60 seconds

    const devicesWithStatus = users.map(user => ({
      deviceId: user.deviceId,
      deviceName: user.deviceName,
      isOnline: user.lastSeenAt
        ? (now.getTime() - new Date(user.lastSeenAt).getTime()) < ONLINE_THRESHOLD_MS
        : false,
      lastSeenAt: user.lastSeenAt,
    }));

    return NextResponse.json({ devices: devicesWithStatus });
  } catch (error) {
    console.error('Error getting devices:', error);
    return NextResponse.json(
      { error: 'Failed to get devices' },
      { status: 500 }
    );
  }
}
