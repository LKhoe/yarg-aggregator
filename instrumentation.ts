export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initProviderWorker } = await import('@/lib/queue');
        initProviderWorker();
    }
}
