import { logger } from './services/logger';
import { fork, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { config } from './config';

const sourceMode = __filename.endsWith('.ts');
const workerEntry = path.join(__dirname, sourceMode ? 'worker-process.ts' : 'worker-process.js');
const serviceRoot = path.resolve(__dirname, '..');
const children = new Set<ChildProcess>();
let stopping = false;

function spawnWorker(index: number): void {
  if (stopping) return;
  const child = fork(workerEntry, [], {
    cwd: serviceRoot,
    execArgv: sourceMode ? ['--import', 'tsx'] : [],
    env: { ...process.env, DB_POOL_MAX: process.env.WORKER_DB_POOL_MAX ?? '2' },
    stdio: 'inherit',
  });
  children.add(child);
  logger.info({ worker: index, pid: child.pid }, 'Pricing worker child started');
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (stopping) return;
    logger.error({ worker: index, code, signal }, 'Pricing worker child exited; restarting');
    const restart = setTimeout(() => spawnWorker(index), 1_000);
    restart.unref();
  });
}

function shutdown(): void {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  const deadline = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 10_000);
  deadline.unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logger.info({ workers: config.workerProcessCount }, 'Pricing worker supervisor started');
for (let index = 0; index < config.workerProcessCount; index += 1) spawnWorker(index + 1);
