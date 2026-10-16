import type { Pool } from 'pg';
import { config } from './config';
import { pool } from './infrastructure/database/pool';
import { inTransaction } from './infrastructure/database/transaction';

export interface ImportQueueMessage {
  id: string;
  attempts: number;
  created_at: Date;
  default_effective_date: string | null;
  store_id: string;
  csv_content: Buffer;
  retry_row_numbers: number[] | null;
  requested_by: string;
  correlation_id: string;
}

export interface EnqueueImport {
  id: string;
  filename: string;
  storeId: string;
  csvContent: Buffer;
  requestedBy: string;
  correlationId: string;
  defaultEffectiveDate: string;
}

export interface PricingImportQueue {
  enqueue(input: EnqueueImport): Promise<void>;
  claimNext(): Promise<ImportQueueMessage | undefined>;
}

export class PostgresPricingImportQueue implements PricingImportQueue {
  constructor(private readonly database: Pool) {}

  async enqueue(input: EnqueueImport): Promise<void> {
    await this.database.query(
      `INSERT INTO pricing_import_jobs (id, filename, store_id, csv_content, status, requested_by, correlation_id, default_effective_date)
       VALUES ($1, $2, $3, $4, 'queued', $5, $6, $7::date)`,
      [input.id, input.filename, input.storeId, input.csvContent, input.requestedBy, input.correlationId, input.defaultEffectiveDate],
    );
  }

  async claimNext(): Promise<ImportQueueMessage | undefined> {
    return inTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('pricing-import-worker-slots'))");
      await client.query(`UPDATE pricing_import_jobs SET status = 'failed', completed_at = now(), locked_at = NULL, terminal_error = 'Import exceeded the processing attempt limit'
        WHERE attempts >= 3 AND (status = 'queued' OR (status = 'processing' AND locked_at < now() - interval '10 minutes'))`);
      const activeJobs = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM pricing_import_jobs
         WHERE status = 'processing' AND locked_at > now() - interval '10 minutes'`,
      );
      if (Number(activeJobs.rows[0]?.count ?? 0) >= config.maxConcurrentImports) return undefined;
      const result = await client.query<ImportQueueMessage>(
        `WITH candidate AS (
           SELECT id FROM pricing_import_jobs
           WHERE attempts < 3 AND (status = 'queued' OR (status = 'processing' AND locked_at < now() - interval '10 minutes'))
           ORDER BY created_at
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE pricing_import_jobs AS job
         SET status = 'processing', started_at = COALESCE(job.started_at, now()), locked_at = now(), attempts = job.attempts + 1
         FROM candidate WHERE job.id = candidate.id
         RETURNING job.id, job.attempts, job.created_at, job.default_effective_date::text, job.store_id, job.csv_content, job.retry_row_numbers, job.requested_by, job.correlation_id`,
      );
      return result.rows[0];
    }, this.database);
  }
}

export const pricingImportQueue: PricingImportQueue = new PostgresPricingImportQueue(pool);
