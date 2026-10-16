import { randomUUID } from 'node:crypto';
import { pool } from './infrastructure/database/pool';
import { mockProductService } from './catalog';
import { processImport } from './import-processor';

const storeId = 'STORE001';
const sku = `TEST-${randomUUID()}`;
const previousDate = '2098-01-01';
const effectiveDate = '2098-02-01';
const nextDate = '2098-04-01';

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDatabase('pricing CSV import worker (dedicated test database)', () => {
  const jobIds: string[] = [];

  afterAll(async () => {
    await pool.query('DELETE FROM pricing_audit_events WHERE store_id = $1 AND sku = $2', [storeId, sku]);
    await pool.query('DELETE FROM pricing_records WHERE store_id = $1 AND sku = $2 AND effective_from >= $3::date', [storeId, sku, previousDate]);
    if (jobIds.length) await pool.query('DELETE FROM pricing_import_jobs WHERE id = ANY($1::uuid[])', [jobIds]);
    await pool.end();
  });

  it('allows partial success, skips duplicates, records failures, and preserves later schedules', async () => {
    const productLookup = jest.spyOn(mockProductService, 'getProduct')
      .mockImplementation(async (requestedSku) => requestedSku === sku ? { sku, name: 'Sparkling Water 1L' } : undefined);
    const earlierId = randomUUID();
    const laterId = randomUUID();
    await pool.query(
      `INSERT INTO pricing_records (id, store_id, sku, product_name, price, currency, effective_from, created_by, updated_by)
       VALUES ($1, $2, $3, 'Sparkling Water 1L', 7.00, 'INR', $4, 'test', 'test'),
              ($5, $2, $3, 'Sparkling Water 1L', 9.00, 'INR', $6, 'test', 'test')`,
      [earlierId, storeId, sku, previousDate, laterId, nextDate],
    );

    const jobId = randomUUID();
    jobIds.push(jobId);
    const csv = [
      'Store ID,SKU,Product Name,Price,Date',
      `${storeId},${sku},Sparkling Water 1L,8.75,${effectiveDate}`,
      `${storeId},${sku},Sparkling Water 1L,8.75,${effectiveDate}`,
      `${storeId},SKU4040,Unknown Product,1.00,${effectiveDate}`,
    ].join('\n');
    await pool.query(
      `INSERT INTO pricing_import_jobs (id, filename, store_id, csv_content, status, attempts, requested_by, correlation_id)
       VALUES ($1, 'integration.csv', $2, $3, 'processing', 1, 'test-user', 'test-correlation')`,
      [jobId, storeId, Buffer.from(csv)],
    );

    await processImport({
      id: jobId,
      attempts: 1,
      created_at: new Date(),
      default_effective_date: null,
      store_id: storeId,
      csv_content: Buffer.from(csv),
      retry_row_numbers: null,
      requested_by: 'test-user',
      correlation_id: 'test-correlation',
    });
    expect(productLookup).toHaveBeenCalledTimes(2);
    await pool.query("UPDATE pricing_import_jobs SET status = 'processing' WHERE id = $1", [jobId]);
    await processImport({
      id: jobId,
      attempts: 1,
      created_at: new Date(),
      default_effective_date: null,
      store_id: storeId,
      csv_content: Buffer.from(csv),
      retry_row_numbers: null,
      requested_by: 'test-user',
      correlation_id: 'test-correlation',
    });

    const job = await pool.query('SELECT status, successful_records, failed_records, skipped_records FROM pricing_import_jobs WHERE id = $1', [jobId]);
    expect(job.rows[0]).toMatchObject({ status: 'completed_with_errors', successful_records: 1, failed_records: 1, skipped_records: 1 });

    const outcomes = await pool.query('SELECT row_number, status FROM pricing_import_rows WHERE import_job_id = $1 ORDER BY row_number', [jobId]);
    expect(outcomes.rows.map((row) => [row.row_number, row.status])).toEqual([[2, 'success'], [3, 'skipped'], [4, 'failed']]);

    const timeline = await pool.query(
      `SELECT effective_from::text, effective_through::text, price::text
       FROM pricing_records WHERE store_id = $1 AND sku = $2 ORDER BY effective_from`,
      [storeId, sku],
    );
    expect(timeline.rows).toEqual([
      { effective_from: previousDate, effective_through: '2098-01-31', price: '7.00' },
      { effective_from: effectiveDate, effective_through: '2098-03-31', price: '8.75' },
      { effective_from: nextDate, effective_through: null, price: '9.00' },
    ]);
  });

  afterEach(() => jest.restoreAllMocks());
});
