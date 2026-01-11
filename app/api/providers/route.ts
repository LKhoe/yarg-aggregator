import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Provider from '@/models/Provider';
import Music from '@/models/Music';
import { getEnchorSongs, getRhythmverseSongs } from '@/services/providers';
import { providerQueue } from '@/lib/queue';
import Redis from 'ioredis';
import { IProvider } from '@/types';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
});

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

    // Check if provider is currently running using Redis
    const isRunning = await redis.get(`provider:${source}:running`);
    if (isRunning === 'true') {
      return NextResponse.json(
        { error: `Provider is already running for ${source}` },
        { status: 400 }
      );
    }
    
    await connectDB();
    const providerData = await Provider.findOne(
      { name: source },
      'lastSuccessfulFetch',
    ).lean();
    const latestSourceUpdatedAt = providerData?.lastSuccessfulFetch;

    console.log('Starting job: ', source, latestSourceUpdatedAt);

    if (retryFailed) {
      // For retry, we just create a new job with the same logic
      const retryJobData = {
        name: `retry-${source}`,
        data: {
          source: source as 'enchor' | 'rhythmverse',
          latestSourceUpdatedAt,
        },
        opts: {
          removeOnComplete: true,
          removeOnFail: false
        }
      };

      await providerQueue.add(retryJobData.name, retryJobData.data, retryJobData.opts);

      return NextResponse.json({ success: true, message: `Retrying failed jobs for ${source}` });
    }

    // Create a single job for this source
    const jobData = {
      name: `fetch-${source}`,
      data: {
        source: source as 'enchor' | 'rhythmverse',
        latestSourceUpdatedAt,
      },
      opts: {
        removeOnComplete: true,
        removeOnFail: false
      }
    };

    await providerQueue.add(jobData.name, jobData.data, jobData.opts);

    return NextResponse.json({ success: true, message: 'Provider fetch started' });
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

    // Check if provider is currently running
    const isRunning = await redis.get(`provider:${source}:running`);
    if (isRunning !== 'true') {
      return NextResponse.json(
        { error: `Provider is not running for ${source}` },
        { status: 400 }
      );
    }

    // Clear the running flag in Redis
    await redis.del(`provider:${source}:running`);

    // Get and remove active jobs for this source
    const activeJobs = await providerQueue.getActive();
    for (const job of activeJobs) {
      if (job.data.source === source) {
        await job.remove();
      }
    }

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
    
    // Check running status from Redis for each provider
    const enrichedProviders = await Promise.all(
      providers.map(async (provider) => {
        const isRunning = await redis.get(`provider:${provider.name}:running`) === 'true';
        return {
          ...provider,
          isRunning
        };
      })
    );

    // Get queue stats
    const activeCount = await providerQueue.getActiveCount();
    const waitingCount = await providerQueue.getWaitingCount();
    const completedCount = await providerQueue.getCompletedCount();
    const failedCount = await providerQueue.getFailedCount();
    const delayedCount = await providerQueue.getDelayedCount();

    const queueStats = {
      active: activeCount,
      waiting: waitingCount,
      completed: completedCount,
      failed: failedCount,
      delayed: delayedCount,
      total: activeCount + waitingCount + completedCount + failedCount + delayedCount
    };

    const enrichedData = enrichedProviders.map(provider => ({
      ...provider,
      queueStats: provider.isRunning ? queueStats : null
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

