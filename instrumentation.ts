export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initProviderWorker } = await import('@/lib/queue');
        initProviderWorker();
    }
}

export async function onRequestError(
  err: unknown,
  request: { method: string; path: string },
  context: unknown,
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { pushError } = await import('./lib/monitoring');
    await pushError({
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.path,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      digest: (err as { digest?: string })?.digest,
    });
  } catch {
    // Never let monitoring errors surface
  }
  // LocalInfra's metrics: route pattern, error name and a scrubbed message only
  const { reportServerError } = await import('./lib/metrics/forward');
  await reportServerError(err, context as { routePath?: string });
}
