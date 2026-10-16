import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app, redis } from './server';
import { pool } from './infrastructure/database/pool';
import { mockProductService } from './catalog';
import { pricingImportQueue } from './import-queue';
import { processImport } from './import-processor';
import { addCalendarDays, dateInTimezone } from './csv';

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const sku = `WORKFLOW-${randomUUID()}`;
const jobIds: string[] = [];
const today = dateInTimezone(new Date(), 'Asia/Kolkata');
const date = (days: number) => addCalendarDays(today, days);

describeDatabase('pricing workflow in disposable PostgreSQL', () => {
  beforeAll(() => {
    jest.spyOn(mockProductService, 'getProduct').mockImplementation(async (value) => value === sku ? { sku, name: 'Workflow product' } : undefined);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await pool.query('DELETE FROM pricing_history_deletions WHERE sku = $1', [sku]);
    await pool.query('DELETE FROM pricing_audit_events WHERE sku = $1', [sku]);
    await pool.query('DELETE FROM pricing_records WHERE sku = $1', [sku]);
    if (jobIds.length) await pool.query('DELETE FROM pricing_import_jobs WHERE id = ANY($1::uuid[])', [jobIds]);
    redis?.disconnect();
    await pool.end();
  });

  async function upload(body: string) {
    const response = await request(app).post('/api/pricing-imports').field('storeId', 'STORE001')
      .attach('file', Buffer.from(body), { filename: 'workflow.csv', contentType: 'text/csv' });
    expect(response.status).toBe(202);
    jobIds.push(response.body.id);
    const job = await pricingImportQueue.claimNext();
    expect(job?.id).toBe(response.body.id);
    return job!;
  }

  it('imports, reports, searches, edits, rejects stale/viewer writes, undoes, cancels and audits deletion', async () => {
    const job = await upload(`Store ID,SKU,Product Name,Price,Date\nSTORE001,${sku},Workflow product,10.00,${date(3)}`);
    await processImport(job);
    const detail = await request(app).get(`/api/pricing-imports/${job.id}`);
    expect(detail.body.import).toMatchObject({ status: 'completed', successfulRecords: 1 });
    const report = await request(app).get(`/api/pricing-imports/${job.id}/report.csv`);
    expect(report.text).toContain('success');
    const search = await request(app).get('/api/prices').query({ sku });
    expect(search.status).toBe(200);
    expect(search.body.pagination.total).toBe(1);
    const price = search.body.data[0];
    const forbidden = await request(app).patch(`/api/prices/${price.id}`).set('x-mock-user', 'pricing-viewer')
      .send({ price: '11.00', version: price.version });
    expect(forbidden.status).toBe(403);
    const scope = await request(app).get(`/api/prices/${price.id}`).set('x-mock-user', 'manager-store100');
    expect(scope.status).toBe(403);
    const edited = await request(app).patch(`/api/prices/${price.id}`).send({ price: '11.00', version: price.version });
    expect(edited.status).toBe(200);
    const stale = await request(app).patch(`/api/prices/${price.id}`).send({ price: '12.00', version: price.version });
    expect(stale.status).toBe(409);
    const history = await request(app).get(`/api/prices/${price.id}/history`);
    const editEvent = history.body.events.find((event: { source: string }) => event.source === 'manual');
    const undo = await request(app).post(`/api/prices/${price.id}/undo`).send({ auditEventId: Number(editEvent.id) });
    expect(undo.status).toBe(201);
    expect(undo.body.effectiveDate).toBe(date(1));
    const cancel = await request(app).delete(`/api/prices/${price.id}`);
    expect(cancel.status).toBe(204);
    const effective = await request(app).get('/api/prices').query({ sku, effectiveDate: date(4) });
    expect(effective.body.data).toHaveLength(1);
    expect(effective.body.data[0]).toMatchObject({ price: '10.00', effectiveThrough: null });
    const deniedDelete = await request(app).delete(`/api/prices/${price.id}/history`);
    expect(deniedDelete.status).toBe(403);
    const deleteHistory = await request(app).delete(`/api/prices/${price.id}/history`).set('x-mock-user', 'store-admin');
    expect(deleteHistory.status).toBe(204);
    const deletion = await pool.query('SELECT 1 FROM pricing_history_deletions WHERE pricing_record_id = $1', [price.id]);
    expect(deletion.rowCount).toBe(1);
  });

  it('rejects edits and cancellation of already-effective PostgreSQL DATE values', async () => {
    const id = randomUUID();
    await pool.query(`INSERT INTO pricing_records (id, store_id, sku, product_name, price, currency, effective_from, effective_through, created_by, updated_by)
      VALUES ($1, 'STORE001', $2, 'Workflow product', 5, 'INR', $3::date, $4::date, 'test', 'test')`, [id, sku, date(-1), today]);
    const edited = await request(app).patch(`/api/prices/${id}`).send({ price: '9.00', effectiveDate: date(5), version: 1 });
    expect(edited.status).toBe(409);
    expect(edited.body.code).toBe('PRICE_ALREADY_EFFECTIVE');
    const cancelled = await request(app).delete(`/api/prices/${id}`);
    expect(cancelled.status).toBe(409);
  });

  it('fences a stale worker before it writes prices or outcomes', async () => {
    const job = await upload(`Store ID,SKU,Product Name,Price,Date\nSTORE001,${sku},Workflow product,20.00,${date(8)}`);
    await pool.query('UPDATE pricing_import_jobs SET attempts = attempts + 1 WHERE id = $1', [job.id]);
    await expect(processImport(job)).rejects.toThrow('Import lease is no longer owned');
    const outcomes = await pool.query('SELECT 1 FROM pricing_import_rows WHERE import_job_id = $1', [job.id]);
    expect(outcomes.rowCount).toBe(0);
    await pool.query("UPDATE pricing_import_jobs SET status = 'failed' WHERE id = $1", [job.id]);
  });

  it('records malformed files as terminal failures requiring a corrected upload', async () => {
    const job = await upload('Store ID,SKU,Product Name,Price,Date\n"unterminated');
    await processImport(job);
    const detail = await request(app).get(`/api/pricing-imports/${job.id}`);
    expect(detail.body.import).toMatchObject({ status: 'failed', failedRecords: 1 });
    expect(detail.body.import.terminalError).toContain('CSV could not be parsed');
    const retry = await request(app).post(`/api/pricing-imports/${job.id}/retry`);
    expect(retry.status).toBe(409);
    expect(retry.body.code).toBe('IMPORT_REUPLOAD_REQUIRED');
  });

  it('reserves cancelled dates and rejects retrying an unfinished import', async () => {
    const job = await upload(`Store ID,SKU,Product Name,Price,Date\nSTORE001,${sku},Workflow product,13.00,${date(3)}`);
    const premature = await request(app).post(`/api/pricing-imports/${job.id}/retry`);
    expect(premature.body.code).toBe('IMPORT_NOT_FINISHED');
    await processImport(job);
    const detail = await request(app).get(`/api/pricing-imports/${job.id}`);
    expect(detail.body.import.skippedRecords).toBe(1);
  });

  it('serializes concurrent import/edit operations and audits predecessor interval changes', async () => {
    const first = await upload(`Store ID,SKU,Product Name,Price,Date\nSTORE001,${sku},Workflow product,30.00,${date(20)}\nSTORE001,${sku},Workflow product,40.00,${date(30)}`);
    await processImport(first);
    const found = await request(app).get('/api/prices').query({ sku, effectiveDate: date(20) });
    const price = found.body.data.find((record: { effectiveDate: string }) => record.effectiveDate === date(20));
    const middle = await upload(`Store ID,SKU,Product Name,Price,Date\nSTORE001,${sku},Workflow product,35.00,${date(25)}`);
    const [, edit] = await Promise.all([
      processImport(middle),
      request(app).patch(`/api/prices/${price.id}`).send({ price: '31.00', version: price.version }),
    ]);
    expect([200, 409]).toContain(edit.status);
    const timeline = await pool.query(`SELECT effective_from::text AS start, effective_through::text AS finish
      FROM pricing_records WHERE sku = $1 AND effective_from >= $2::date AND cancelled_at IS NULL ORDER BY effective_from`, [sku, date(20)]);
    expect(timeline.rows).toEqual([
      { start: date(20), finish: date(24) }, { start: date(25), finish: date(29) }, { start: date(30), finish: null },
    ]);
    const audit = await pool.query(`SELECT old_effective_through::text AS old_end, new_effective_through::text AS new_end
      FROM pricing_audit_events WHERE pricing_record_id = $1 AND source = 'timeline' ORDER BY id DESC LIMIT 1`, [price.id]);
    expect(audit.rows[0]).toEqual({ old_end: date(29), new_end: date(24) });
  });

  it('reclaims expired leases, excludes the previous generation and bounds repeated crashes', async () => {
    const old = await upload(`Store ID,SKU,Product Name,Price,Date\nSTORE001,${sku},Workflow product,50.00,${date(40)}`);
    await pool.query("UPDATE pricing_import_jobs SET locked_at = now() - interval '11 minutes' WHERE id = $1", [old.id]);
    const replacement = await pricingImportQueue.claimNext();
    expect(replacement?.id).toBe(old.id);
    expect(replacement?.attempts).toBe(old.attempts + 1);
    await expect(processImport(old)).rejects.toThrow('Import lease is no longer owned');
    await processImport(replacement!);
    const crashed = await upload(`Store ID,SKU,Product Name,Price,Date\nSTORE001,${sku},Workflow product,60.00,${date(50)}`);
    await pool.query("UPDATE pricing_import_jobs SET attempts = 3, locked_at = now() - interval '11 minutes' WHERE id = $1", [crashed.id]);
    expect(await pricingImportQueue.claimNext()).toBeUndefined();
    const failed = await request(app).get(`/api/pricing-imports/${crashed.id}`);
    expect(failed.body.import.status).toBe('failed');
    expect(failed.body.import.terminalError).toContain('attempt limit');
  });

  it('retries failed data rows after product availability recovers and preserves the captured date', async () => {
    jest.mocked(mockProductService.getProduct).mockResolvedValueOnce(undefined);
    const original = await upload(`Store ID,SKU,Product Name,Price,Date\nSTORE001,${sku},Workflow product,70.00,${date(60)}`);
    await processImport(original);
    const failed = await request(app).get(`/api/pricing-imports/${original.id}`);
    expect(failed.body.import.failedRecords).toBe(1);
    const retry = await request(app).post(`/api/pricing-imports/${original.id}/retry`);
    expect(retry.status).toBe(202);
    expect(retry.body.retryRows).toBe(1);
    jobIds.push(retry.body.id);
    const job = await pricingImportQueue.claimNext();
    expect(job?.id).toBe(retry.body.id);
    expect(job?.default_effective_date).toBe(original.default_effective_date);
    await processImport(job!);
    const complete = await request(app).get(`/api/pricing-imports/${job!.id}`);
    expect(complete.body.import).toMatchObject({ totalRecords: 1, successfulRecords: 1, failedRecords: 0 });
  });

  it('neutralizes spreadsheet formulas in exported rejected values', async () => {
    const job = await upload(`Store ID,SKU,Product Name,Price,Date\nSTORE001,${sku},Workflow product,=1+1,${date(70)}`);
    await processImport(job);
    const report = await request(app).get(`/api/pricing-imports/${job.id}/report.csv`);
    expect(report.status).toBe(200);
    expect(report.text).toContain("'=1+1");
  });
});
