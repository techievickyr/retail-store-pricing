import request from 'supertest';
import { app, redis } from './server';
import { pool } from './infrastructure/database/pool';

afterAll(async () => {
  redis?.disconnect();
  await pool.end();
});

describe('mock identity and role controls', () => {
  it('keeps health probes public for load balancers', async () => {
    const live = await request(app).get('/health').set('x-mock-user', 'unknown');
    expect(live.status).toBe(200);
    expect(live.body.status).toBe('ok');
  });

  it('returns the default store manager identity', async () => {
    const response = await request(app).get('/api/me');
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('STORE_MANAGER');
    expect(response.body.user.storeIds).toEqual(['STORE001']);
  });

  it('rejects unknown mock identities', async () => {
    const response = await request(app).get('/api/me').set('x-mock-user', 'not-a-user');
    expect(response.status).toBe(401);
  });

  it('limits manager store discovery to assigned stores', async () => {
    const response = await request(app).get('/api/stores');
    expect(response.status).toBe(200);
    expect(response.body.stores.map((store: { storeId: string }) => store.storeId)).toEqual(['STORE001']);
  });

  it('allows store admins to list mock users and denies managers', async () => {
    const denied = await request(app).get('/api/users');
    expect(denied.status).toBe(403);
    const allowed = await request(app).get('/api/users').set('x-mock-user', 'store-admin');
    expect(allowed.status).toBe(200);
    expect(allowed.body.users).toHaveLength(4);
  });

  it('rejects malformed price filters before querying the database', async () => {
    const response = await request(app).get('/api/prices?minPrice=not-a-number');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_PRICE_FILTER');
  });

  it('requires currency for cross-country price range searches', async () => {
    const response = await request(app).get('/api/prices?minPrice=10').set('x-mock-user', 'store-admin');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('CURRENCY_REQUIRED');
  });

  it('rejects malformed currency codes', async () => {
    const response = await request(app).get('/api/prices?currency=USDX');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_CURRENCY');
  });

  it('rejects malformed UUIDs and fractional pagination without a database query', async () => {
    const invalidId = await request(app).get('/api/prices/not-a-uuid');
    expect(invalidId.status).toBe(400);
    expect(invalidId.body.code).toBe('INVALID_RECORD_ID');
    const pagination = await request(app).get('/api/prices?page=1.5');
    expect(pagination.status).toBe(400);
    expect(pagination.body.code).toBe('INVALID_PAGINATION');
  });

  it('returns a correlated 400 for malformed JSON', async () => {
    const response = await request(app).patch('/api/prices/00000000-0000-0000-0000-000000000001')
      .set('Content-Type', 'application/json').send('{');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_JSON');
    expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
  });
});
