import { pool } from '../infrastructure/database/pool';

export interface ReadinessResult {
  ready: boolean;
}

export async function checkReadiness(): Promise<ReadinessResult> {
  try {
    await pool.query('SELECT 1');
    return { ready: true };
  } catch {
    return { ready: false };
  }
}
