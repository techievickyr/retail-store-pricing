process.env.NODE_ENV = 'test';
// Never inherit the application database, including from .env.
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl && !decodeURIComponent(new URL(testUrl).pathname).endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must name a dedicated database ending in _test');
}
process.env.DATABASE_URL = testUrl || 'postgres://pricing:pricing@localhost:5433/pricing_test';
process.env.REDIS_URL = '';
