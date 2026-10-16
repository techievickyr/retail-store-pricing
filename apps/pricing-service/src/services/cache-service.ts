import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';
import { config } from '../config';
import { logger } from './logger';
export { logger } from './logger';

export const redis = config.redisUrl
  ? new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 100, 5_000),
    })
  : undefined;

redis?.on('error', (error) => logger.warn({ error: error.message }, 'Redis unavailable; using adapter fallback'));
if (redis) void redis.connect().catch(() => undefined);

export const sharedRateLimitStore = redis ? new RedisStore({
  prefix: 'pricing-api-limit:',
  sendCommand: (...args: string[]) => redis.call(args[0]!, ...args.slice(1)) as Promise<string | number | boolean | (string | number | boolean)[]>,
}) : undefined;

export async function getCached<T>(key: string, loader: () => Promise<T>, ttlSeconds = 120): Promise<T> {
  if (redis?.status === 'ready') {
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached) as T;
    } catch (error) {
      logger.warn({ key, error: error instanceof Error ? error.message : 'cache error' }, 'Redis cache read failed');
    }
  }

  const value = await loader();
  if (redis?.status === 'ready') {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      logger.warn({ key, error: error instanceof Error ? error.message : 'cache error' }, 'Redis cache write failed');
    }
  }
  return value;
}
