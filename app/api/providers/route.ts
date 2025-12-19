import { NextRequest, NextResponse } from 'next/server';
import { addProviderJob, getJobStatus } from '@/services/queue';
import { runProvider } from '@/services/providers';
import getRedis from '@/lib/redis';

// Store job progress in Redis
const PROGRESS_KEY_PREFIX = 'provider:progress:';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source = 'all', maxPages = 10, useQueue = false, forceSync = false } = body;

    if (!['enchor', 'rhythmverse', 'all'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be enchor, rhythmverse, or all' },
        { status: 400 }
      );
    }

    if (useQueue) {
      // Queue-based async fetching
      const jobId = await addProviderJob({ source, concurrency: 5 });
      return NextResponse.json({ 
        message: 'Provider fetch job queued',
        jobId,
      });
    } else {
      // Direct fetching with progress tracking
      const jobId = `direct_${Date.now()}`;
      const redis = getRedis();

      // Initialize progress
      await redis.hset(`${PROGRESS_KEY_PREFIX}${jobId}`, {
        status: 'running',
        source,
        progress: 0,
        songsProcessed: 0,
        startedAt: new Date().toISOString(),
      });

      // Run provider in background (non-blocking)
      runProvider({
        source,
        maxPages,
        forceSync,
        onProgress: async (data) => {
          const progress = Math.round((data.currentPage / data.totalPages) * 100);
          await redis.hset(`${PROGRESS_KEY_PREFIX}${jobId}`, {
            status: 'running',
            progress,
            currentSource: data.source,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            songsProcessed: data.songsProcessed,
          });
        },
      }).then(async (result) => {
        await redis.hset(`${PROGRESS_KEY_PREFIX}${jobId}`, {
          status: result.success ? 'completed' : 'failed',
          progress: 100,
          totalFetched: result.totalFetched,
          totalSaved: result.totalSaved,
          errors: JSON.stringify(result.errors),
          completedAt: new Date().toISOString(),
        });
        // Expire after 1 hour
        await redis.expire(`${PROGRESS_KEY_PREFIX}${jobId}`, 3600);
      }).catch(async (error) => {
        await redis.hset(`${PROGRESS_KEY_PREFIX}${jobId}`, {
          status: 'failed',
          error: String(error),
          completedAt: new Date().toISOString(),
        });
      });

      return NextResponse.json({ 
        message: 'Provider fetch started',
        jobId,
      });
    }
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

    // Check if it's a queue job or direct job
    if (jobId.startsWith('direct_')) {
      const redis = getRedis();
      const progress = await redis.hgetall(`${PROGRESS_KEY_PREFIX}${jobId}`);

      if (!progress || Object.keys(progress).length === 0) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        jobId,
        ...progress,
        errors: progress.errors ? JSON.parse(progress.errors) : [],
      });
    } else {
      // Queue job status
      const status = await getJobStatus(jobId);
      
      if (!status) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(status);
    }
  } catch (error) {
    console.error('Error getting provider status:', error);
    return NextResponse.json(
      { error: 'Failed to get provider status' },
      { status: 500 }
    );
  }
}

