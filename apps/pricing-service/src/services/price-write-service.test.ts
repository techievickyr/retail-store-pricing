import type { PoolClient } from 'pg';
import type { User } from '../auth';
import { inTransaction } from '../infrastructure/database/transaction';
import { updateScheduledPrice, cancelScheduledPrice } from './price-write-service';

jest.mock('../infrastructure/database/transaction', () => ({ inTransaction: jest.fn() }));

const user: User = {
  userId: 'date-test', username: 'Date test', role: 'STORE_MANAGER',
  storeIds: ['STORE001'], timezone: 'Asia/Kolkata', currency: 'INR',
};
const query = jest.fn();

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-16T20:00:00Z'));
  query.mockReset();
  jest.mocked(inTransaction).mockImplementation(async (operation) => operation({ query } as unknown as PoolClient));
});

afterEach(() => jest.useRealTimers());

function record(date: string) {
  return { id: 'record', store_id: 'STORE001', sku: 'SKU1001', price: '45.00', version: 1, effective_from: date };
}

describe('store-local scheduled price rules', () => {
  it.each(['2026-10-16', '2026-10-17'])('rejects editing an effective record dated %s', async (date) => {
    query.mockResolvedValue({ rows: [record(date)] });
    await expect(updateScheduledPrice(user, 'record', { price: '46.00', version: 1 }, 'test'))
      .rejects.toMatchObject({ code: 'PRICE_ALREADY_EFFECTIVE', status: 409 });
  });

  it.each(['2026-10-16', '2026-10-17'])('rejects cancellation of an effective record dated %s', async (date) => {
    query.mockResolvedValue({ rows: [record(date)] });
    await expect(cancelScheduledPrice(user, 'record', 'test'))
      .rejects.toMatchObject({ code: 'PRICE_ALREADY_EFFECTIVE', status: 409 });
  });

  it('keeps the existing future date for a price-only PATCH', async () => {
    query.mockImplementation(async (sql: string) => sql.startsWith('SELECT *,') || sql.startsWith('SELECT store_id, sku')
      ? { rows: [record('2026-10-18')], rowCount: 1 } : { rows: [], rowCount: 0 });
    await updateScheduledPrice(user, 'record', { price: '46.00', version: 1 }, 'test');
    const advisoryLock = query.mock.calls.findIndex(([sql]) => String(sql).includes('pg_advisory_xact_lock'));
    const rowLock = query.mock.calls.findIndex(([sql]) => String(sql).includes('FOR UPDATE'));
    expect(advisoryLock).toBeLessThan(rowLock);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('SET price ='), ['record', '46.00', '2026-10-18', user.userId]);
  });

  it('rejects stale versions', async () => {
    query.mockResolvedValue({ rows: [record('2026-10-18')] });
    await expect(updateScheduledPrice(user, 'record', { price: '46.00', version: 2 }, 'test'))
      .rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});
