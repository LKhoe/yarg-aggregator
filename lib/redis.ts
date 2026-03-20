import Redis from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const baseOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  ...(REDIS_PASSWORD ? { password: REDIS_PASSWORD } : {}),
};

function withErrorHandler(client: Redis, label: string): Redis {
  client.on("error", (err) => {
    console.error(`Redis [${label}] error:`, err.message);
  });
  return client;
}

let _client: Redis | null = null;

/** Singleton for queue + route operations. maxRetriesPerRequest: null for BullMQ compat. */
export function getRedisClient(): Redis {
  if (!_client) {
    _client = withErrorHandler(
      new Redis({ ...baseOptions, maxRetriesPerRequest: null }),
      "client",
    );
  }
  return _client;
}

/** New connection for pub/sub (ioredis requires a dedicated connection). */
export function createRedisSubscriber(): Redis {
  return withErrorHandler(new Redis(baseOptions), "subscriber");
}

/** New connection for short-lived reads (e.g., SSE init). */
export function createRedisReader(): Redis {
  return withErrorHandler(new Redis(baseOptions), "reader");
}
