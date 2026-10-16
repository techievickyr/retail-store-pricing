import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { config } from './config';
import { pool } from './infrastructure/database/pool';
import { mockAuth } from './auth';
import { errorHandler } from './middleware/error-handler';
import routes from './routes';
import { logger, redis, sharedRateLimitStore } from './services/cache-service';

const app = express();
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_AUTH_IN_PRODUCTION !== 'true') {
  throw new Error('Mock authentication is disabled in production. Integrate a trusted AuthProvider, or explicitly enable ALLOW_MOCK_AUTH_IN_PRODUCTION for an isolated demonstration.');
}
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.corsOrigin.split(',').map((origin) => origin.trim()), credentials: false }));
app.use(pinoHttp({ logger, genReqId: (req, res) => {
  const suppliedId = req.headers['x-correlation-id'];
  const correlationId = typeof suppliedId === 'string' && suppliedId.length <= 100 ? suppliedId : randomUUID();
  res.setHeader('x-correlation-id', correlationId);
  return correlationId;
} }));
app.use((req, _res, next) => {
  req.correlationId = String(req.id ?? randomUUID());
  next();
});
app.use(express.json({ limit: '64kb' }));
app.use(rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: sharedRateLimitStore,
  passOnStoreError: true,
  skip: (req) => req.path === '/health' || req.path === '/ready',
  handler: (req, res) => res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many requests; try again shortly', details: {}, correlationId: req.correlationId }),
}));
app.use('/api', mockAuth);
app.use(routes);
app.use(errorHandler);

export { app, redis };

if (require.main === module) {
  const server = app.listen(config.port, () => logger.info({ port: config.port }, 'Pricing API listening'));
  const shutdown = () => server.close(() => { void redis?.quit(); void pool.end(); });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
