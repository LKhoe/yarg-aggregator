import Redis from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var redis: Redis | null;
}

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

export function getRedis(): Redis {
  if (!global.redis) {
    console.log('Creating new Redis connection...');
    global.redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      maxRetriesPerRequest: null, // Required for BullMQ
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    global.redis.on('connect', () => {
      console.log('Redis connected successfully');
    });

    global.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }

  return global.redis;
}

export default getRedis;
