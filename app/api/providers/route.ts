import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ProviderFetchSession from '@/models/ProviderFetchSession';
import ProviderStats from '@/models/ProviderStats';
import Music from '@/models/Music';
import { fetchEnchor, fetchRhythmverse, runProviderSession } from '@/services/providers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source = 'all', amount = 100, action, sessionId } = body;

    if (!['enchor', 'rhythmverse', 'all'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be enchor, rhythmverse, or all' },
        { status: 400 }
      );
    }

    if (action === 'retry') {
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required for retry' }, { status: 400 });
      }

      await connectDB();
      const session = await ProviderFetchSession.findOne({ sessionId });
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      if (session.status !== 'failed' || session.failedJobIndex === undefined) {
        return NextResponse.json({ error: 'Session is not retryable' }, { status: 400 });
      }

      const failedIndex = session.failedJobIndex;
      await ProviderFetchSession.updateOne(
        { sessionId },
        {
          $set: {
            status: 'running',
            [`jobs.${failedIndex}.status`]: 'pending',
            [`jobs.${failedIndex}.error`]: '',
          },
          $unset: { failedJobIndex: '' },
        }
      );

      // Fire-and-forget in-process execution (bounded concurrency)
      runProviderSession({
        sessionId,
        concurrency: parseInt(process.env.PROVIDER_CONCURRENCY || '5'),
        startJobIndex: failedIndex,
      }).catch((e) => {
        console.error('Provider session retry failed:', e);
      });

      return NextResponse.json({ message: 'Retry started', jobId: sessionId });
    }

    const newSessionId = `batch_${Date.now()}`;
    await connectDB();

    const sources: ('enchor' | 'rhythmverse')[] = source === 'all' ? ['enchor', 'rhythmverse'] : [source];

    // Determine per-source sort direction and ensure ProviderStats exists.
    const jobSpecs: { source: 'enchor' | 'rhythmverse'; sortDirection: 'asc' | 'desc' | 'ASC' | 'DESC' }[] = [];
    for (const src of sources) {
      const fetchFn = src === 'enchor' ? fetchEnchor : fetchRhythmverse;
      const initialBatch = await fetchFn(1, 1);
      const totalAvailable = initialBatch.totalFound;
      const localCount = await Music.countDocuments({ source: src });
      const ratio = totalAvailable > 0 ? localCount / totalAvailable : 0;
      const sortDirection = ratio < 0.5 ? (src === 'enchor' ? 'asc' : 'ASC') : (src === 'enchor' ? 'desc' : 'DESC');

      await ProviderStats.findOneAndUpdate(
        { source: src },
        {
          $setOnInsert: {
            source: src,
            nextPageAsc: 1,
            nextPageDesc: 1,
            nextIndexAsc: 0,
            nextIndexDesc: 0,
          },
          $set: {
            totalAvailable,
            totalFetched: localCount,
            lastFetchedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      jobSpecs.push({ source: src, sortDirection });
    }

    // Split requested amount into jobs based on default page size.
    // If source === 'all', we split amount evenly (remainder goes to first source).
    const perSourceAmounts: Record<'enchor' | 'rhythmverse', number> = { enchor: 0, rhythmverse: 0 };
    if (source === 'all') {
      const half = Math.floor(amount / 2);
      const rest = amount - half * 2;
      perSourceAmounts.enchor = half + rest;
      perSourceAmounts.rhythmverse = half;
    } else {
      perSourceAmounts[source as 'enchor' | 'rhythmverse'] = amount;
    }

    const jobs: any[] = [];
    for (const spec of jobSpecs) {
      const providerDefault = spec.source === 'enchor' ? 20 : 25;
      let remaining = perSourceAmounts[spec.source];

      const directionKey = spec.sortDirection === 'asc' || spec.sortDirection === 'ASC' ? 'asc' : 'desc';
      const pageField = directionKey === 'asc' ? 'nextPageAsc' : 'nextPageDesc';
      const indexField = directionKey === 'asc' ? 'nextIndexAsc' : 'nextIndexDesc';

      const stats = await ProviderStats.findOne({ source: spec.source });
      let page = (stats as any)?.[pageField] ?? 1;
      let index = (stats as any)?.[indexField] ?? 0;

      while (remaining > 0) {
        const take = Math.min(providerDefault, remaining);
        jobs.push({ source: spec.source, take, sortDirection: spec.sortDirection, status: 'pending', page, index });
        // Advance deterministic cursor so jobs can run concurrently without shared state
        index += take;
        while (index >= providerDefault) {
          page += 1;
          index -= providerDefault;
        }
        remaining -= take;
      }
    }

    await ProviderFetchSession.create({
      sessionId: newSessionId,
      source,
      status: 'running',
      requestedSongs: amount,
      fetchedSongs: 0,
      savedSongs: 0,
      jobsTotal: jobs.length,
      jobsCompleted: 0,
      jobs,
      fetchErrors: [],
      startedAt: new Date(),
    });

    // Fire-and-forget in-process execution (bounded concurrency)
    runProviderSession({
      sessionId: newSessionId,
      concurrency: parseInt(process.env.PROVIDER_CONCURRENCY || '5'),
    }).catch((e) => {
      console.error('Provider session failed:', e);
    });

    // Session tracking is now handled by the database only

    return NextResponse.json({ message: 'Provider fetch started', jobId: newSessionId });
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

