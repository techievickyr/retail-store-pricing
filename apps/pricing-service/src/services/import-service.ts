import { randomUUID } from 'node:crypto';
import type { User } from '../auth';
import { canAccessStore } from '../auth';
import { pool } from '../infrastructure/database/pool';
import { inTransaction } from '../infrastructure/database/transaction';
import { pricingImportQueue } from '../import-queue';
import { getStore } from './catalog-service';
import { ServiceError } from './http-service';
import { addCalendarDays, dateInTimezone } from '../csv';

export interface CreateImportInput {
  filename: string;
  storeId: string;
  csvContent: Buffer;
  user: User;
  correlationId: string;
}

function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const text = /^[\s]*[=+@-]|^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function createImport(input: CreateImportInput): Promise<{ id: string }> {
  if (!input.storeId) throw new ServiceError('Store ID is required', 400, 'STORE_ID_REQUIRED');
  if (!canAccessStore(input.user, input.storeId)) throw new ServiceError('You do not have access to this store', 403, 'STORE_SCOPE_FORBIDDEN');
  const store = await getStore(input.storeId);
  if (!store) throw new ServiceError('Selected store does not exist', 422, 'UNKNOWN_STORE', { storeId: input.storeId });
  const id = randomUUID();
  await pricingImportQueue.enqueue({
    id,
    filename: input.filename.slice(0, 255),
    storeId: input.storeId,
    csvContent: input.csvContent,
    requestedBy: input.user.userId,
    correlationId: input.correlationId,
    defaultEffectiveDate: addCalendarDays(dateInTimezone(new Date(), store.timezone), 1),
  });
  return { id };
}

export async function listImports(user: User) {
  const query = user.storeIds === '*'
    ? `SELECT id, filename, store_id AS "storeId", status, total_records AS "totalRecords", successful_records AS "successfulRecords", failed_records AS "failedRecords", skipped_records AS "skippedRecords", created_at AS "createdAt", completed_at AS "completedAt"
       FROM pricing_import_jobs ORDER BY created_at DESC LIMIT 100`
    : `SELECT id, filename, store_id AS "storeId", status, total_records AS "totalRecords", successful_records AS "successfulRecords", failed_records AS "failedRecords", skipped_records AS "skippedRecords", created_at AS "createdAt", completed_at AS "completedAt"
       FROM pricing_import_jobs WHERE store_id = ANY($1::text[]) ORDER BY created_at DESC LIMIT 100`;
  const result = user.storeIds === '*' ? await pool.query(query) : await pool.query(query, [user.storeIds]);
  return result.rows;
}

export async function getImport(user: User, jobId: string) {
  const result = await pool.query(
    `SELECT id, filename, store_id AS "storeId", status, terminal_error AS "terminalError", total_records AS "totalRecords", successful_records AS "successfulRecords", failed_records AS "failedRecords", skipped_records AS "skippedRecords", requested_by AS "createdBy", created_at AS "createdAt", started_at AS "startedAt", completed_at AS "completedAt"
     FROM pricing_import_jobs WHERE id = $1`, [jobId],
  );
  const job = result.rows[0];
  if (!job) throw new ServiceError('Import job not found', 404, 'IMPORT_NOT_FOUND');
  if (!canAccessStore(user, job.storeId)) throw new ServiceError('You do not have access to this store', 403, 'STORE_SCOPE_FORBIDDEN');
  return job;
}

async function getAccessibleImport(user: User, jobId: string): Promise<{ storeId: string; filename?: string }> {
  const result = await pool.query<{ store_id: string; filename?: string }>(
    'SELECT store_id, filename FROM pricing_import_jobs WHERE id = $1', [jobId],
  );
  const job = result.rows[0];
  if (!job) throw new ServiceError('Import job not found', 404, 'IMPORT_NOT_FOUND');
  if (!canAccessStore(user, job.store_id)) throw new ServiceError('You do not have access to this store', 403, 'STORE_SCOPE_FORBIDDEN');
  return { storeId: job.store_id, filename: job.filename };
}

export async function getImportRows(user: User, jobId: string) {
  await getAccessibleImport(user, jobId);
  const result = await pool.query(
    `SELECT row_number AS "rowNumber", status, field, rejected_value AS "rejectedValue", reason
     FROM pricing_import_rows WHERE import_job_id = $1 ORDER BY row_number`, [jobId],
  );
  return result.rows;
}

export async function getImportReport(user: User, jobId: string): Promise<{ filename: string; csv: string }> {
  const job = await getAccessibleImport(user, jobId);
  const result = await pool.query(
    'SELECT row_number, status, field, rejected_value, reason FROM pricing_import_rows WHERE import_job_id = $1 ORDER BY row_number',
    [jobId],
  );
  const csv = [
    'rowNumber,status,field,rejectedValue,reason',
    ...result.rows.map((row) => [row.row_number, row.status, row.field, row.rejected_value, row.reason].map(escapeCsvCell).join(',')),
  ].join('\r\n');
  return { filename: `${String(job.filename).replace(/\.csv$/i, '')}-results.csv`, csv };
}

export type RetryImportResult = { id: string; retryRows: number };

export async function retryFailedImport(user: User, jobId: string, correlationId: string): Promise<RetryImportResult> {
  return inTransaction(async (client) => {
    const source = await client.query('SELECT * FROM pricing_import_jobs WHERE id = $1 FOR UPDATE', [jobId]);
    const original = source.rows[0];
    if (!original) throw new ServiceError('Import job not found', 404, 'IMPORT_NOT_FOUND');
    if (!canAccessStore(user, original.store_id)) throw new ServiceError('You do not have access to this store', 403, 'STORE_SCOPE_FORBIDDEN');
    if (original.status === 'queued' || original.status === 'processing') throw new ServiceError('Wait until the import finishes before retrying', 409, 'IMPORT_NOT_FINISHED');
    if (original.terminal_error) throw new ServiceError('Correct the file and submit a new upload', 409, 'IMPORT_REUPLOAD_REQUIRED');
    const failed = await client.query(
      `SELECT row_number FROM pricing_import_rows WHERE import_job_id = $1 AND status = 'failed' ORDER BY row_number`,
      [original.id],
    );
    if (!failed.rowCount) throw new ServiceError('This import has no failed rows to retry', 409, 'NO_FAILED_ROWS');
    const id = randomUUID();
    await client.query(
      `INSERT INTO pricing_import_jobs (id, filename, store_id, csv_content, retry_row_numbers, parent_job_id, status, total_records, requested_by, correlation_id, default_effective_date)
       VALUES ($1, $2, $3, $4, $5, $6, 'queued', $7, $8, $9, $10::date)`,
      [id, original.filename, original.store_id, original.csv_content, failed.rows.map((row) => row.row_number), original.id, failed.rowCount, user.userId, correlationId, original.default_effective_date ?? addCalendarDays(dateInTimezone(new Date(original.created_at), (await getStore(original.store_id))?.timezone ?? 'UTC'), 1)],
    );
    return { id, retryRows: failed.rowCount };
  });
}
