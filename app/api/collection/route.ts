import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import type { ICollection } from '@/types';

// Get user's collections or create user if not exists
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
      return NextResponse.json({ collections: [] });
    }

    return NextResponse.json({ 
      collections: user.collections,
      deviceName: user.deviceName,
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}

// Create a new collection
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
    const { name, musicIds } = body;

    if (!name || !Array.isArray(musicIds)) {
      return NextResponse.json(
        { error: 'name and musicIds are required' },
        { status: 400 }
      );
    }

    const newCollection: ICollection = {
      name,
      musicIds,
      createdAt: new Date(),
    };

    // Upsert user and push collection
    const user = await User.findOneAndUpdate(
      { deviceId },
      {
        $setOnInsert: { deviceId, deviceName },
        $push: { collections: newCollection },
      },
      { upsert: true, new: true }
    );

    const createdCollection = user.collections[user.collections.length - 1];

    return NextResponse.json({ 
      message: 'Collection created',
      collection: createdCollection,
    });
  } catch (error) {
    console.error('Error creating collection:', error);
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    );
  }
}

// Delete a collection
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const deviceId = request.headers.get('x-device-id');
    const collectionId = request.nextUrl.searchParams.get('collectionId');

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required in x-device-id header' },
        { status: 400 }
      );
    }

    if (!collectionId) {
      return NextResponse.json(
        { error: 'collectionId is required' },
        { status: 400 }
      );
    }

    await User.updateOne(
      { deviceId },
      { $pull: { collections: { _id: collectionId } } }
    );

    return NextResponse.json({ message: 'Collection deleted' });
  } catch (error) {
    console.error('Error deleting collection:', error);
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    );
  }
}
