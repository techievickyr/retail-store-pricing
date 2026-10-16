import type { Pool, PoolClient } from 'pg';
import { pool } from './pool';

export async function inTransaction<T>(operation: (client: PoolClient) => Promise<T>, database: Pool = pool): Promise<T> {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
