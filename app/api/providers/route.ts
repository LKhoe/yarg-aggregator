import { NextRequest, NextResponse } from "next/server";
import { ProviderService } from "@/lib/services/provider";
import { providerQueue } from "@/lib/queue";
import { getAuthenticatedUser, hasPermission } from "@/lib/middleware/auth";
import { getRedisClient } from "@/lib/redis";

const redis = getRedisClient();

export async function POST(request: NextRequest) {
  // Check authentication and authorization
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(authUser.profile.role, "moderator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { source, retryFailed = false } = body;

    if (!["enchor", "rhythmverse"].includes(source)) {
      return NextResponse.json(
        { error: "Invalid source. Must be enchor or rhythmverse" },
        { status: 400 },
      );
    }

    // Atomically acquire the running lock
    const acquired = await redis.set(
      `provider:${source}:running`,
      "true",
      "EX",
      120,
      "NX",
    );
    if (!acquired) {
      return NextResponse.json(
        { error: `Provider is already running for ${source}` },
        { status: 409 },
      );
    }

    const providerData = await ProviderService.findByName(source);
    const latestSourceUpdatedAt = providerData?.lastSuccessfulFetch;

    console.log("Starting job: ", source, latestSourceUpdatedAt);

    if (retryFailed) {
      // For retry, we just create a new job with the same logic
      const retryJobData = {
        name: `retry-${source}`,
        data: {
          source: source as "enchor" | "rhythmverse",
          latestSourceUpdatedAt,
        },
        opts: {
          removeOnComplete: true,
          removeOnFail: false,
        },
      };

      try {
        await providerQueue.add(
          retryJobData.name,
          retryJobData.data,
          retryJobData.opts,
        );
      } catch (error) {
        await redis.del(`provider:${source}:running`);
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: `Retrying failed jobs for ${source}`,
      });
    }

    // Create a single job for this source
    const jobData = {
      name: `fetch-${source}`,
      data: {
        source: source as "enchor" | "rhythmverse",
        latestSourceUpdatedAt,
      },
      opts: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    };

    try {
      await providerQueue.add(jobData.name, jobData.data, jobData.opts);
    } catch (error) {
      await redis.del(`provider:${source}:running`);
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Provider fetch started",
    });
  } catch (error) {
    console.error("Error starting provider:", error);
    const message =
      error instanceof Error ? error.message : "Failed to start provider";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  // Check authentication and authorization
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(authUser.profile.role, "moderator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { source } = body;

    if (!["enchor", "rhythmverse"].includes(source)) {
      return NextResponse.json(
        { error: "Invalid source. Must be enchor or rhythmverse" },
        { status: 400 },
      );
    }

    // Check if provider is currently running
    const isRunning = await redis.get(`provider:${source}:running`);
    if (isRunning !== "true") {
      return NextResponse.json(
        { error: `Provider is not running for ${source}` },
        { status: 400 },
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
      message: `Provider ${source} stopped successfully`,
    });
  } catch (error) {
    console.error("Error stopping provider:", error);
    const message =
      error instanceof Error ? error.message : "Failed to stop provider";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(authUser.profile.role, "moderator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get all providers from database
    const providers = await ProviderService.getAll();

    // Check running status from Redis for each provider
    const enrichedProviders = await Promise.all(
      providers.map(async (provider) => {
        const isRunning =
          (await redis.get(`provider:${provider.name}:running`)) === "true";
        const progressRaw = await redis.get(
          `provider:${provider.name}:progress`,
        );
        const progress = progressRaw ? JSON.parse(progressRaw) : null;
        return {
          ...provider,
          isRunning,
          progress,
        };
      }),
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
      total:
        activeCount +
        waitingCount +
        completedCount +
        failedCount +
        delayedCount,
    };

    const enrichedData = enrichedProviders.map((provider) => ({
      ...provider,
      queueStats: provider.isRunning ? queueStats : null,
    }));

    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error("Error getting provider status:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get provider status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
