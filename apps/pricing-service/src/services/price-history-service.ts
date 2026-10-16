import type { User } from '../auth';
import { canAccessStore } from '../auth';
import { pool } from '../infrastructure/database/pool';
import { ServiceError } from './http-service';

export async function getPriceHistory(user: User, recordId: string) {
  const record = await pool.query<{ store_id: string }>('SELECT store_id FROM pricing_records WHERE id = $1', [recordId]);
  if (!record.rows[0]) throw new ServiceError('Price record not found', 404, 'PRICE_NOT_FOUND');
  if (!canAccessStore(user, record.rows[0].store_id)) throw new ServiceError('You do not have access to this store', 403, 'STORE_SCOPE_FORBIDDEN');
  const events = await pool.query(
    `SELECT id, old_price::text AS "oldPrice", new_price::text AS "newPrice", old_effective_from::text AS "oldEffectiveDate", new_effective_from::text AS "newEffectiveDate", old_effective_through::text AS "oldEffectiveThrough", new_effective_through::text AS "newEffectiveThrough", changed_by AS "changedBy", changed_at AS "changedAt", reason, source
     FROM pricing_audit_events WHERE pricing_record_id = $1 ORDER BY changed_at DESC`, [recordId],
  );
  return events.rows;
}
