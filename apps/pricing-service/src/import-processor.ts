import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from './infrastructure/database/pool';
import { inTransaction } from './infrastructure/database/transaction';
import { config } from './config';
import { addCalendarDays, dateInTimezone, parseDateOnly, parsePricingCsv, type PricingCsvRow } from './csv';
import { mockProductService, mockStoreService, type Store } from './catalog';
import type { ImportQueueMessage } from './import-queue';
import { setPriceEnd } from './services/price-timeline-service';

type ClaimedJob = ImportQueueMessage;

interface RowIssue {
  field: string;
  value?: string;
  reason: string;
}

type RowStatus = 'success' | 'failed' | 'skipped';

function validatePrice(value: string): boolean {
  return /^(?:\d{1,10})(?:\.\d{1,2})?$/.test(value);
}

async function saveRowIssue(jobId: string, rowNumber: number, issue: RowIssue, status: 'failed' | 'skipped' = 'failed', database: Pick<PoolClient, 'query'> = pool): Promise<void> {
  await database.query(
    `INSERT INTO pricing_import_rows (import_job_id, row_number, status, field, rejected_value, reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (import_job_id, row_number) DO NOTHING`,
    [jobId, rowNumber, status, issue.field, issue.value?.slice(0, 160) ?? null, issue.reason],
  );
}

function validateRow(row: PricingCsvRow, store: Store, jobStoreId: string, today: string, defaultEffectiveDate: string): { effectiveDate?: string; issue?: RowIssue } {
  if (!row.storeId) return { issue: { field: 'Store ID', reason: 'Store ID is required' } };
  if (row.storeId !== jobStoreId) return { issue: { field: 'Store ID', value: row.storeId, reason: 'Row store must match the selected store for this upload' } };
  if (!row.sku) return { issue: { field: 'SKU', reason: 'SKU is required' } };
  if (!row.productName) return { issue: { field: 'Product Name', reason: 'Product Name is required' } };
  if (!row.price || !validatePrice(row.price)) return { issue: { field: 'Price', value: row.price, reason: 'Price must be a non-negative decimal with at most two fractional digits' } };

  const effectiveDate = row.effectiveDate ? parseDateOnly(row.effectiveDate) : defaultEffectiveDate;
  if (!effectiveDate) return { issue: { field: 'Date', value: row.effectiveDate, reason: 'Date must use the valid YYYY-MM-DD format' } };
  if (effectiveDate <= today) return { issue: { field: 'Date', value: effectiveDate, reason: 'Effective date must be in the future in the store timezone' } };
  return { effectiveDate };
}

async function recordValidPrice(client: PoolClient, job: ClaimedJob, row: PricingCsvRow, store: Store, effectiveDate: string): Promise<'success' | 'skipped'> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [job.store_id, row.sku]);
  const duplicate = await client.query(
    'SELECT id FROM pricing_records WHERE store_id = $1 AND sku = $2 AND effective_from = $3::date',
    [job.store_id, row.sku, effectiveDate],
  );
  if (duplicate.rowCount) {
    await client.query(
      `INSERT INTO pricing_import_rows (import_job_id, row_number, status, field, reason)
       VALUES ($1, $2, 'skipped', 'SKU', 'Duplicate store, SKU, and effective date')
       ON CONFLICT (import_job_id, row_number) DO NOTHING`,
      [job.id, row.rowNumber],
    );
    return 'skipped';
  }

  const previous = await client.query<{ id: string; price: string; effective_from: string }>(
    `SELECT id, price::text, effective_from::text FROM pricing_records
     WHERE store_id = $1 AND sku = $2 AND effective_from < $3::date AND cancelled_at IS NULL
     ORDER BY effective_from DESC LIMIT 1 FOR UPDATE`,
    [job.store_id, row.sku, effectiveDate],
  );
  const next = await client.query<{ effective_from: string }>(
    `SELECT effective_from::text FROM pricing_records
     WHERE store_id = $1 AND sku = $2 AND effective_from > $3::date AND cancelled_at IS NULL
     ORDER BY effective_from ASC LIMIT 1`,
    [job.store_id, row.sku, effectiveDate],
  );

  if (previous.rows[0]) {
    await setPriceEnd(client, previous.rows[0].id, addCalendarDays(effectiveDate, -1), job.requested_by, job.correlation_id, job.id);
  }

  const id = randomUUID();
  const effectiveThrough = next.rows[0]?.effective_from ?? null;
  await client.query(
    `INSERT INTO pricing_records
       (id, store_id, sku, product_name, price, currency, effective_from, effective_through, source_import_job_id, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5::numeric, $6, $7::date, CASE WHEN $8::date IS NULL THEN NULL ELSE $8::date - 1 END, $9, $10, $10)`,
    [id, job.store_id, row.sku, row.productName, row.price, store.currency, effectiveDate, effectiveThrough, job.id, job.requested_by],
  );

  await client.query(
    `INSERT INTO pricing_audit_events
       (pricing_record_id, store_id, sku, old_price, new_price, old_effective_from, new_effective_from, changed_by, reason, source, import_job_id, correlation_id)
     VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6::date, $7::date, $8, 'Price CSV import', 'import', $9, $10)`,
    [id, job.store_id, row.sku, previous.rows[0]?.price ?? null, row.price, previous.rows[0]?.effective_from ?? null, effectiveDate, job.requested_by, job.id, job.correlation_id],
  );
  await client.query(
    `INSERT INTO pricing_import_rows (import_job_id, row_number, status, reason)
     VALUES ($1, $2, 'success', 'Price scheduled successfully')
     ON CONFLICT (import_job_id, row_number) DO NOTHING`,
    [job.id, row.rowNumber],
  );
  return 'success';
}

async function processRow(
  job: ClaimedJob,
  row: PricingCsvRow,
  store: Store,
  today: string,
  defaultEffectiveDate: string,
  processedRows: Set<number>,
  productValidation: Map<string, Promise<boolean>>,
): Promise<RowStatus | undefined> {
  if (processedRows.has(row.rowNumber)) return undefined;

  return inTransaction(async (client) => {
    await assertImportLease(client, job);
    const existing = await client.query('SELECT 1 FROM pricing_import_rows WHERE import_job_id = $1 AND row_number = $2', [job.id, row.rowNumber]);
    if (existing.rowCount) return undefined;
    const validation = validateRow(row, store, job.store_id, today, defaultEffectiveDate);
    if (validation.issue) {
      await saveRowIssue(job.id, row.rowNumber, validation.issue, 'failed', client);
      return 'failed';
    }
    let productExists = productValidation.get(row.sku);
    if (!productExists) {
      productExists = mockProductService.getProduct(row.sku).then((product) => Boolean(product));
      productValidation.set(row.sku, productExists);
    }
    if (!await productExists) {
      await saveRowIssue(job.id, row.rowNumber, { field: 'SKU', value: row.sku, reason: 'Product/SKU was not found' }, 'failed', client);
      return 'failed';
    }
    return recordValidPrice(client, job, row, store, validation.effectiveDate!);
  });
}

export class ImportLeaseLostError extends Error {
  constructor() { super('Import lease is no longer owned by this worker'); }
}

export async function assertImportLease(client: PoolClient, job: ClaimedJob): Promise<void> {
  const lease = await client.query(
    "SELECT 1 FROM pricing_import_jobs WHERE id = $1 AND status = 'processing' AND attempts = $2 FOR UPDATE",
    [job.id, job.attempts],
  );
  if (!lease.rowCount) throw new ImportLeaseLostError();
}

async function rejectImportFile(job: ClaimedJob, reason: string): Promise<void> {
  await inTransaction(async (client) => {
    await assertImportLease(client, job);
    await saveRowIssue(job.id, 1, { field: 'File', reason }, 'failed', client);
    await client.query(`UPDATE pricing_import_jobs SET total_records = 0, failed_records = 1,
      status = 'failed', terminal_error = $3, completed_at = now(), locked_at = NULL
      WHERE id = $1 AND attempts = $2 AND status = 'processing'`, [job.id, job.attempts, reason]);
  });
}

export async function processImport(job: ClaimedJob): Promise<void> {
  await inTransaction((client) => assertImportLease(client, job));
  let parsed: ReturnType<typeof parsePricingCsv>;
  try {
    parsed = parsePricingCsv(job.csv_content);
  } catch {
    await rejectImportFile(job, 'CSV could not be parsed. Check quoting, column counts and record size.');
    return;
  }
  if (parsed.missingHeaders.length) {
    await rejectImportFile(job, `Missing required CSV columns: ${parsed.missingHeaders.join(', ')}`);
    return;
  }

  const store = await mockStoreService.getStore(job.store_id);
  if (!store) {
    await rejectImportFile(job, 'Selected store was not found');
    return;
  }
  const defaultEffectiveDate = job.default_effective_date
    ?? addCalendarDays(dateInTimezone(new Date(job.created_at), store.timezone), 1);
  await pool.query("UPDATE pricing_import_jobs SET default_effective_date = $3::date WHERE id = $1 AND attempts = $2 AND status = 'processing'", [job.id, job.attempts, defaultEffectiveDate]);

  const retryRows = job.retry_row_numbers ? new Set(job.retry_row_numbers) : undefined;
  const selectedRows = retryRows ? parsed.rows.filter((row) => retryRows.has(row.rowNumber)) : parsed.rows;
  const today = dateInTimezone(new Date(), store.timezone);
  const existingOutcomes = await pool.query<{ row_number: number; status: RowStatus }>(
    'SELECT row_number, status FROM pricing_import_rows WHERE import_job_id = $1', [job.id],
  );
  const processedRows = new Set(existingOutcomes.rows.map((row) => row.row_number));
  const summary: Record<RowStatus, number> = { success: 0, failed: 0, skipped: 0 };
  for (const outcome of existingOutcomes.rows) summary[outcome.status] += 1;
  const productValidation = new Map<string, Promise<boolean>>();
  await pool.query("UPDATE pricing_import_jobs SET total_records = $2 WHERE id = $1 AND attempts = $3 AND status = 'processing'", [job.id, selectedRows.length, job.attempts]);

  for (let index = 0; index < selectedRows.length; index += config.workerBatchSize) {
    const batch = selectedRows.slice(index, index + config.workerBatchSize);
    const settled = await Promise.allSettled(batch.map((row) => processRow(job, row, store, today, defaultEffectiveDate, processedRows, productValidation)));
    const failure = settled.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    const outcomes = settled.map((result) => result.status === 'fulfilled' ? result.value : undefined);
    batch.forEach((row, rowIndex) => {
      const outcome = outcomes[rowIndex];
      if (!outcome) return;
      processedRows.add(row.rowNumber);
      summary[outcome] += 1;
    });
    await pool.query(
      `UPDATE pricing_import_jobs SET successful_records = $2, failed_records = $3, skipped_records = $4 WHERE id = $1 AND attempts = $5 AND status = 'processing'`,
      [job.id, summary.success, summary.failed, summary.skipped, job.attempts],
    );
  }

  const failed = summary.failed;
  const succeeded = summary.success;
  const skipped = summary.skipped;
  const status = failed > 0 || skipped > 0 ? 'completed_with_errors' : 'completed';
  await pool.query(
    `UPDATE pricing_import_jobs
     SET successful_records = $2, failed_records = $3, skipped_records = $4, status = $5, completed_at = now(), locked_at = NULL
     WHERE id = $1 AND attempts = $6 AND status = 'processing'`,
    [job.id, succeeded, failed, skipped, status, job.attempts],
  );
}
