import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './pool';
import { inTransaction } from './transaction';

async function runMigrations(): Promise<void> {
  const migrationDirectory = path.resolve(__dirname, '../../../database/migrations');
  const seedPath = path.resolve(__dirname, '../../../database/seeds/seed.sql');
  const migrations = (await readdir(migrationDirectory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();

  await inTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pricing-schema-migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const name of migrations) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
      if (applied.rowCount) continue;
      await client.query(await readFile(path.join(migrationDirectory, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    }
    if (process.argv.includes('--seed')) await client.query(await readFile(seedPath, 'utf8'));
  });
}

if (require.main === module) {
  runMigrations()
    .then(() => console.info('Database migrations completed; seed runs only with --seed.'))
    .catch((error: unknown) => {
      console.error('Database migration failed', error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

export { runMigrations };
