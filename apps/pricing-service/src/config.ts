import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: process.env.ENV_FILE ?? path.resolve(__dirname, '../../../.env') });

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  port: positiveInteger(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://pricing:pricing@localhost:5433/pricing',
  dbPoolMax: positiveInteger(process.env.DB_POOL_MAX, 10),
  redisUrl: process.env.REDIS_URL,
  maxUploadBytes: positiveInteger(process.env.MAX_UPLOAD_BYTES, 5 * 1024 * 1024),
  workerPollMs: positiveInteger(process.env.WORKER_POLL_MS, 1500),
  workerBatchSize: positiveInteger(process.env.WORKER_BATCH_SIZE, 100),
  workerProcessCount: positiveInteger(process.env.WORKER_PROCESS_COUNT, 2),
  maxConcurrentImports: positiveInteger(process.env.MAX_CONCURRENT_IMPORTS, 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? 'USD',
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? 'UTC',
};
