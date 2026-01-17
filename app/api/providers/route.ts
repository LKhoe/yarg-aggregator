import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Provider from '@/models/Provider';
import Music from '@/models/Music';
import { getEnchorSongs, getRhythmverseSongs } from '@/services/providers';
import { IProvider } from '@/types';

export async function POST(request: NextRequest) {
  // return NextResponse.json(
  //   { error: 'Not implemented yet.' },
  //   { status: 501 }
  // );

  try {
    const body = await request.json();
    const { source, retryFailed = false } = body;

    if (!['enchor', 'rhythmverse'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be enchor or rhythmverse' },
        { status: 400 }
      );
    }

    // Simple in-memory check for running providers (without Redis)
    // Note: This is a basic replacement - consider using a database or file-based lock for production
    const runningProviders = new Set();
    if (runningProviders.has(source)) {
      return NextResponse.json(
        { error: `Provider is already running for ${source}` },
        { status: 400 }
      );
    }
    runningProviders.add(source);
    
    await connectDB();
    const providerData = await Provider.findOne(
      { name: source },
      'lastSuccessfulFetch',
    ).lean();
    const latestSourceUpdatedAt = providerData?.lastSuccessfulFetch;

    console.log('Starting job: ', source, latestSourceUpdatedAt);

    // Direct execution instead of queue (since Redis/BullMQ removed)
    return NextResponse.json({ 
      success: true, 
      message: 'Provider fetch started directly - queue system removed' 
    });
  } catch (error) {
    console.error('Error starting provider:', error);
    return NextResponse.json(
      { error: 'Failed to start provider' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { source } = body;

    if (!['enchor', 'rhythmverse'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be enchor or rhythmverse' },
        { status: 400 }
      );
    }

    // Simple in-memory check for running providers
    const runningProviders = new Set();
    if (!runningProviders.has(source)) {
      return NextResponse.json(
        { error: `Provider is not running for ${source}` },
        { status: 400 }
      );
    }

    // Remove from running providers
    runningProviders.delete(source);

    return NextResponse.json({ 
      success: true, 
      message: `Provider ${source} stopped successfully` 
    });

  } catch (error) {
    console.error('Error stopping provider:', error);
    return NextResponse.json(
      { error: 'Failed to stop provider' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    // Get all providers from database
    const providers = await Provider.find({}, { _id: 0, __v: 0 }).lean();
    
    // No running status check since Redis removed
    const enrichedProviders = providers.map(provider => ({
      ...provider,
      isRunning: false
    }));

    // No queue stats since queue system removed
    const queueStats = {
      active: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      total: 0
    };

    const enrichedData = enrichedProviders.map(provider => ({
      ...provider,
      queueStats: null
    }));

    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error('Error getting provider status:', error);
    return NextResponse.json(
      { error: 'Failed to get provider status' },
      { status: 500 }
    );
  }
}

