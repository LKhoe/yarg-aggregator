import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ProviderStats from '@/models/ProviderStats';
import Music from '@/models/Music';
import { getEnchorSongs, getRhythmverseSongs } from '@/services/providers';
import { providerQueue } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, amount = 100 } = body;

    if (!['enchor', 'rhythmverse'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be enchor or rhythmverse' },
        { status: 400 }
      );
    }

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount. Must be a number greater than 0' }, { status: 400 });
    }

    await connectDB();
    const providerData = await ProviderStats.findOne({ source });

    const now = Date.now();
    const last = providerData?.lastFetchedAt?.getTime() || 0;

    if (providerData?.isRunning) {
      // Double check with queue if it's really running?
      // For now trusting the DB flag, but user asked: "The isRunning logic inside the providerstats should consider if there is any worker running"
      // Let's check active counts from queue
      const { providerQueue } = await import('@/lib/queue');
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

    if ((providerData?.failedJobs?.length ?? 0) > 0) {
      return NextResponse.json(
        { error: `Provider has failed jobs for ${source}. Please run failed jobs first.` },
        { status: 400 }
      );
    }

    if (providerData?.totalAvailable && amount > providerData?.totalAvailable) {
      return NextResponse.json(
        { error: `Amount is greater than total available for ${source}` },
        { status: 400 }
      );
    }

    const getTotalSongsFn = source === 'enchor' ? getEnchorSongs : getRhythmverseSongs;
    const totalAvailable = await getTotalSongsFn();
    const localCount = await Music.countDocuments({ source });

    if (localCount === totalAvailable) {
      return NextResponse.json(
        { error: `All songs are already fetched for ${source}` },
        { status: 400 }
      );
    }

    await ProviderStats.findOneAndUpdate(
      { source },
      {
        $setOnInsert: {
          source,
          totalFetched: localCount,
        },
        $set: {
          isRunning: true,
          totalAvailable,
          lastFetchedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    const pageSize = source === 'enchor' ? 10 : 25;
    const pagesToRequest = Math.ceil(amount / pageSize);

    const half = Math.floor(totalAvailable / 2);
    const ratio = totalAvailable > 0 ? localCount / totalAvailable : 0;

    const sortDirection = ratio < 0.5 ? 'asc' : 'desc';
    const effectiveFetched = sortDirection === 'asc' ? localCount : Math.max(0, localCount - half);
    const startPage = Math.floor(effectiveFetched / pageSize) + 1;

    const paramsList: { page: number, pageSize: number, sortDirection: 'asc' | 'desc' }[] = Array.from({ length: pagesToRequest }, (_, i) => {
      const take = (i === pagesToRequest - 1) ? (amount % pageSize || pageSize) : pageSize;
      return {
        page: startPage + i,
        pageSize: take,
        sortDirection,
      };
    });

    const jobData = paramsList.map(param => ({
      name: `fetch-${source}-${param.page}`,
      data: {
        source: source as 'enchor' | 'rhythmverse',
        page: param.page,
        pageSize: param.pageSize,
        sortDirection: param.sortDirection
      },
      opts: {
        removeOnComplete: true,
        removeOnFail: false
      }
    }));

    await providerQueue.addBulk(jobData);

    return NextResponse.json({ success: true, message: 'Provider fetch started', jobNames: jobData.map(job => job.name) });
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

