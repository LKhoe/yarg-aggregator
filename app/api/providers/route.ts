import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ProviderFetchSession from '@/models/ProviderFetchSession';
import ProviderStats from '@/models/ProviderStats';
import Music from '@/models/Music';
import { fetchEnchor, fetchRhythmverse, getEnchorSongs, getRhythmverseSongs, runProviderSession } from '@/services/providers';

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

    if (providerData?.isRunning && now - last < 60_000) {
      return NextResponse.json(
        { error: `Provider is already running for ${source}` },
        { status: 400 }
      );
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
          isRunning: true,
          totalAvailable,
          totalFetched: localCount,
          lastFetchedAt: new Date(),
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

    const fetchFn = async (item: { page: number, pageSize: number, sortDirection: 'asc' | 'desc' }) => {
      return await (source === 'enchor' ? fetchEnchor : fetchRhythmverse)(item.page, item.pageSize, item.sortDirection);
    }

    // The code bellow should be swaped for Redis + BullMQ
    // const { results, errors } = await PromisePool
    //   .for(paramsList)
    //   .withConcurrency(10)
    //   .withTaskTimeout(30000) // milliseconds
    //   .onTaskStarted((item, pool) => {
    //     console.log(`Progress: ${pool.processedPercentage()}%`)
    //     console.log(`Active tasks: ${pool.processedItems().length}`)
    //     console.log(`Active tasks: ${pool.activeTasksCount()}`)
    //     console.log(`Finished tasks: ${pool.processedItems().length}`)
    //     console.log(`Finished tasks: ${pool.processedCount()}`)
    //   })
    //   .onTaskFinished((item, pool) => {
    //     console.log(`Finished task: ${item.page}`)
    //   })
    //   .process(fetchFn)

    return NextResponse.json({ message: 'Provider fetch started' });
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
    const jobId = request.nextUrl.searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    await connectDB();
    const session = await ProviderFetchSession.findOne(
      { sessionId: jobId },
      { _id: 0, __v: 0, jobs: 0 }
    );

    if (!session) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(session.toObject());
  } catch (error) {
    console.error('Error getting provider status:', error);
    return NextResponse.json(
      { error: 'Failed to get provider status' },
      { status: 500 }
    );
  }
}

