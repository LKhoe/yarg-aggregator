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
        $set: { deviceName },
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

// Get all online devices (for sharing)
export async function GET() {
  // In a real implementation, this would query connected Socket.io clients
  // For now, return an empty list - the socket handler manages online devices
  return NextResponse.json({ devices: [] });
}
