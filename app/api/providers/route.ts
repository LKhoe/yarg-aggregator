import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ProviderStats from '@/models/ProviderStats';
import Music from '@/models/Music';
import { getEnchorSongs, getRhythmverseSongs } from '@/services/providers';
import { providerQueue } from '@/lib/queue';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Not implemented yet.' },
    { status: 501 }
  );

  try {
    const body = await request.json();
    const { source, retryFailed = false } = body;

    if (!['enchor', 'rhythmverse'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be enchor or rhythmverse' },
        { status: 400 }
      );
    }

    await connectDB();
    const providerData = await ProviderStats.findOne({ source });

    const now = Date.now();
    const last = providerData?.lastFetchedAt?.getTime() || 0;

    if (providerData?.isRunning) {
      // Double check with queue if it's really running?
      // For now trusting the DB flag, but user asked: "The isRunning logic inside the providerstats should consider if there is any worker running"
      // Let's check active counts from queue
      const activeCount = await providerQueue.getActiveCount();
      const waitingCount = await providerQueue.getWaitingCount();

      if (activeCount > 0 || waitingCount > 0) {
        return NextResponse.json(
          { error: `Provider is already running for ${source}` },
          { status: 400 }
        );
      } else {
        // If DB says running but queue is empty, maybe we should reset?
        // Continuing execution will effectively restart it.
        console.log(`Provider ${source} marked as running but queue is empty. Restarting.`);
      }
    } else if (now - last < 60_000) {
      // Provider is taking too long to finish
      // Should be stopped
    }

    if ((providerData?.failedJobs?.length ?? 0) > 0 && !retryFailed) {
      return NextResponse.json(
        { error: `Provider has failed jobs for ${source}. Please run failed jobs first.` },
        { status: 400 }
      );
    }

    // Get the latest sourceUpdatedAt from database
    const latestSong = await Music.findOne({ source })
      .sort({ sourceUpdatedAt: -1 })
      .select('sourceUpdatedAt')
      .lean();

    const latestSourceUpdatedAt = latestSong?.sourceUpdatedAt;

    if (retryFailed) {
      if (!providerData?.failedJobs || providerData.failedJobs.length === 0) {
        return NextResponse.json(
          { error: `No failed jobs found for ${source}` },
          { status: 400 }
        );
      }

      // For retry, we create a new job with the same logic
      await ProviderStats.findOneAndUpdate(
        { source },
        {
          $set: {
            isRunning: true,
            lastFetchedAt: new Date(),
            failedJobs: [] // Clear failed jobs when retrying
          },
        },
        { new: true }
      );

      const retryJobData = {
        name: `retry-${source}`,
        data: {
          source: source as 'enchor' | 'rhythmverse',
          latestSourceUpdatedAt, // Use the same latestSourceUpdatedAt logic
        },
        opts: {
          removeOnComplete: true,
          removeOnFail: false
        }
      };

      await providerQueue.add(retryJobData.name, retryJobData.data, retryJobData.opts);

      return NextResponse.json({ success: true, message: `Retrying failed jobs for ${source}` });
    }

    await ProviderStats.findOneAndUpdate(
      { source },
      {
        $setOnInsert: {
          source,
        },
        $set: {
          isRunning: true,
          lastFetchedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

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

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    // Use projection to exclude _id and __v, and lean() for plain JS objects
    const providerData = await ProviderStats.find({}, { _id: 0, __v: 0 }).lean();

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

    const enrichedData = providerData.map(stat => ({
      ...stat,
      queueStats: stat.isRunning ? queueStats : null
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

