import Redis, { type RedisOptions } from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const REDIS_USERNAME = process.env.REDIS_USERNAME || undefined;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

/**
 * Namespace for every key and pub/sub channel this app uses (e.g. "yarg:").
 * On the shared LocalInfra Redis, this app's ACL user may only touch "yarg:*".
 * Empty (local dev with a private Redis) = no namespace, same keys as before.
 */
export const REDIS_PREFIX = process.env.REDIS_KEY_PREFIX || "";

/** BullMQ refuses ioredis `keyPrefix`, so queues get their own prefix option. */
export const BULLMQ_PREFIX = `${REDIS_PREFIX}bull`;

/** ioredis `keyPrefix` does not apply to pub/sub channels — build names with this. */
export const redisChannel = (name: string) => `${REDIS_PREFIX}${name}`;

export const PROVIDER_EVENTS_CHANNEL = redisChannel("provider:events");

const baseOptions: RedisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  ...(REDIS_USERNAME ? { username: REDIS_USERNAME } : {}),
  ...(REDIS_PASSWORD ? { password: REDIS_PASSWORD } : {}),
};

/** Options for app connections: keys are namespaced automatically. */
const appOptions: RedisOptions = {
  ...baseOptions,
  ...(REDIS_PREFIX ? { keyPrefix: REDIS_PREFIX } : {}),
};

function withErrorHandler(client: Redis, label: string): Redis {
  client.on("error", (err) => {
    console.error(`Redis [${label}] error:`, err.message);
  });
  return client;
}

let _client: Redis | null = null;
let _queueConnection: Redis | null = null;

/** Singleton for app keys (locks, progress, rate limits, monitoring). Keys get REDIS_PREFIX. */
export function getRedisClient(): Redis {
  if (!_client) {
    _client = withErrorHandler(
      new Redis({ ...appOptions, maxRetriesPerRequest: null }),
      "client",
    );
  }
  return _client;
}

/**
 * Singleton connection for BullMQ Queue/Worker. No `keyPrefix` (BullMQ rejects it) —
 * always pass `prefix: BULLMQ_PREFIX` to Queue/Worker instead.
 */
export function getQueueConnection(): Redis {
  if (!_queueConnection) {
    _queueConnection = withErrorHandler(
      new Redis({ ...baseOptions, maxRetriesPerRequest: null }),
      "queue",
    );
  }
  return _queueConnection;
}

/** New connection for pub/sub (ioredis requires a dedicated connection). Use redisChannel() names. */
export function createRedisSubscriber(): Redis {
  return withErrorHandler(new Redis(baseOptions), "subscriber");
}

/** New connection for short-lived reads (e.g., SSE init). Keys get REDIS_PREFIX. */
export function createRedisReader(): Redis {
  return withErrorHandler(new Redis(appOptions), "reader");
}
