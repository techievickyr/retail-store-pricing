import { logger } from './services/logger';
import { config } from './config';
import { pool } from './infrastructure/database/pool';
import { pricingImportQueue } from './import-queue';
import { ImportLeaseLostError, processImport } from './import-processor';

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function run(): Promise<void> {
  logger.info('Pricing import worker process started');
  let stopping = false;
  process.on('SIGINT', () => { stopping = true; });
  process.on('SIGTERM', () => { stopping = true; });
  while (!stopping) {
    try {
      const job = await pricingImportQueue.claimNext();
      if (!job) {
        await wait(config.workerPollMs);
        continue;
      }
      const heartbeat = setInterval(() => {
        void pool.query(
          "UPDATE pricing_import_jobs SET locked_at = now() WHERE id = $1 AND attempts = $2 AND status = 'processing'",
          [job.id, job.attempts],
        ).catch((error: unknown) => logger.error({ jobId: job.id, correlationId: job.correlation_id, error }, 'Import lease heartbeat failed'));
      }, 60_000);
      heartbeat.unref();
      try {
        await processImport(job);
      } catch (error) {
        if (error instanceof ImportLeaseLostError) continue;
        logger.error({ jobId: job.id, correlationId: job.correlation_id, error }, 'Import job failed unexpectedly');
        await pool.query(
          `UPDATE pricing_import_jobs SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'queued' END,
           completed_at = CASE WHEN attempts >= 3 THEN now() ELSE NULL END, terminal_error = CASE WHEN attempts >= 3 THEN 'Import failed after repeated processing attempts; contact support with the job ID' ELSE NULL END, locked_at = NULL WHERE id = $1 AND attempts = $2 AND status = 'processing'`,
          [job.id, job.attempts],
        );
      } finally {
        clearInterval(heartbeat);
      }
    } catch (error) {
      logger.error({ error }, 'Worker queue poll failed');
      await wait(config.workerPollMs);
    }
  }
  await pool.end();
}

run().catch((error: unknown) => {
  logger.error(error);
  process.exitCode = 1;
});
