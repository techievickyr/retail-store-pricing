import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { User } from '../auth';
import { canAccessStore } from '../auth';
import { addCalendarDays, dateInTimezone, parseDateOnly } from '../csv';
import { inTransaction } from '../infrastructure/database/transaction';
import { mockStoreService } from '../catalog';
import { config } from '../config';
import { ServiceError } from './http-service';
import { rebuildPriceTimeline, setPriceEnd } from './price-timeline-service';

export interface PriceUpdateInput {
  price?: string;
  effectiveDate?: string;
  version: number;
}

// Every timeline writer takes the advisory lock before row locks.
async function lockTimeline(client: PoolClient, user: User, recordId: string): Promise<void> {
  const found = await client.query<{ store_id: string; sku: string }>(
    'SELECT store_id, sku FROM pricing_records WHERE id = $1', [recordId],
  );
  const record = found.rows[0];
  if (!record) throw new ServiceError('Price record not found', 404, 'PRICE_NOT_FOUND');
  if (!canAccessStore(user, record.store_id)) throw new ServiceError('You do not have access to this store', 403, 'STORE_SCOPE_FORBIDDEN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [record.store_id, record.sku]);
}

export async function updateScheduledPrice(user: User, recordId: string, input: PriceUpdateInput, correlationId: string): Promise<void> {
  await inTransaction(async (client) => {
    await lockTimeline(client, user, recordId);
    const currentResult = await client.query('SELECT *, effective_from::text AS effective_from FROM pricing_records WHERE id = $1 AND cancelled_at IS NULL FOR UPDATE', [recordId]);
    const current = currentResult.rows[0];
    if (!current) throw new ServiceError('Price record not found', 404, 'PRICE_NOT_FOUND');
    if (!canAccessStore(user, current.store_id)) throw new ServiceError('You do not have access to this store', 403, 'STORE_SCOPE_FORBIDDEN');
    if (Number(current.version) !== input.version) throw new ServiceError('This price was changed or a price already exists on that effective date', 409, 'VERSION_CONFLICT');

    const store = await mockStoreService.getStore(current.store_id);
    if (!store) throw new ServiceError('Store configuration was not found', 422, 'UNKNOWN_STORE');
    const today = dateInTimezone(new Date(), store.timezone);
    if (String(current.effective_from).slice(0, 10) <= today) throw new ServiceError('Only future scheduled prices can be edited', 409, 'PRICE_ALREADY_EFFECTIVE');
    const effectiveDate = input.effectiveDate ?? String(current.effective_from).slice(0, 10);
    if (!parseDateOnly(effectiveDate) || effectiveDate <= today) throw new ServiceError('Effective date must be a valid future date', 422, 'INVALID_EFFECTIVE_DATE');

    const collision = await client.query(
      'SELECT id FROM pricing_records WHERE store_id = $1 AND sku = $2 AND effective_from = $3::date AND id <> $4',
      [current.store_id, current.sku, effectiveDate, current.id],
    );
    if (collision.rowCount) throw new ServiceError('This price was changed or a price already exists on that effective date', 409, 'VERSION_CONFLICT');

    const newPrice = input.price ?? String(current.price);
    await client.query(
      `UPDATE pricing_records SET price = $2::numeric, effective_from = $3::date, updated_by = $4, updated_at = now(), version = version + 1
       WHERE id = $1`, [current.id, newPrice, effectiveDate, user.userId],
    );
    await rebuildPriceTimeline(client, current.store_id, current.sku, user.userId, correlationId);
    await client.query(
      `INSERT INTO pricing_audit_events (pricing_record_id, store_id, sku, old_price, new_price, old_effective_from, new_effective_from, changed_by, reason, source, correlation_id)
       VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6::date, $7::date, $8, 'Scheduled price edited', 'manual', $9)`,
      [current.id, current.store_id, current.sku, current.price, newPrice, current.effective_from, effectiveDate, user.userId, correlationId],
    );
  });
}

export async function cancelScheduledPrice(user: User, recordId: string, correlationId: string): Promise<void> {
  await inTransaction(async (client) => {
    await lockTimeline(client, user, recordId);
    const found = await client.query('SELECT *, effective_from::text AS effective_from FROM pricing_records WHERE id = $1 AND cancelled_at IS NULL FOR UPDATE', [recordId]);
    const current = found.rows[0];
    if (!current) throw new ServiceError('Price record not found', 404, 'PRICE_NOT_FOUND');
    if (!canAccessStore(user, current.store_id)) throw new ServiceError('You do not have access to this store', 403, 'STORE_SCOPE_FORBIDDEN');
    const store = await mockStoreService.getStore(current.store_id);
    const today = dateInTimezone(new Date(), store?.timezone ?? config.defaultTimezone);
    if (String(current.effective_from).slice(0, 10) <= today) throw new ServiceError('Only future scheduled prices can be cancelled', 409, 'PRICE_ALREADY_EFFECTIVE');

    await client.query('UPDATE pricing_records SET cancelled_at = now(), cancelled_by = $2, version = version + 1 WHERE id = $1', [current.id, user.userId]);
    await rebuildPriceTimeline(client, current.store_id, current.sku, user.userId, correlationId);
    await client.query(
      `INSERT INTO pricing_audit_events (pricing_record_id, store_id, sku, old_price, new_price, old_effective_from, changed_by, reason, source, correlation_id)
       VALUES ($1, $2, $3, $4::numeric, NULL, $5::date, $6, 'Scheduled price cancelled', 'manual', $7)`,
      [current.id, current.store_id, current.sku, current.price, current.effective_from, user.userId, correlationId],
    );
  });
}

export async function scheduleCompensatingPrice(user: User, recordId: string, auditEventId: number, correlationId: string): Promise<{ id: string; effectiveDate: string }> {
  return inTransaction(async (client) => {
    await lockTimeline(client, user, recordId);
    const eventResult = await client.query(
      `SELECT id, store_id, sku, old_price::text AS old_price FROM pricing_audit_events
       WHERE id = $1 AND pricing_record_id = $2 FOR UPDATE`, [auditEventId, recordId],
    );
    const event = eventResult.rows[0];
    if (!event) throw new ServiceError('Price history event not found', 404, 'AUDIT_EVENT_NOT_FOUND');
    if (event.old_price === null) throw new ServiceError('This event has no previous price to restore', 409, 'NO_PRIOR_PRICE');
    if (!canAccessStore(user, event.store_id)) throw new ServiceError('You do not have access to this store', 403, 'STORE_SCOPE_FORBIDDEN');

    const source = await client.query('SELECT product_name, currency FROM pricing_records WHERE id = $1', [recordId]);
    const record = source.rows[0];
    if (!record) throw new ServiceError('Price history event not found', 404, 'AUDIT_EVENT_NOT_FOUND');
    const store = await mockStoreService.getStore(event.store_id);
    if (!store) throw new ServiceError('Store configuration was not found', 422, 'UNKNOWN_STORE');
    const effectiveDate = addCalendarDays(dateInTimezone(new Date(), store.timezone), 1);
    const duplicate = await client.query(
      'SELECT id FROM pricing_records WHERE store_id = $1 AND sku = $2 AND effective_from = $3::date',
      [event.store_id, event.sku, effectiveDate],
    );
    if (duplicate.rowCount) throw new ServiceError('A price already exists for tomorrow, including cancelled prices; choose another scheduling action', 409, 'PRICE_ALREADY_SCHEDULED');

    const previous = await client.query<{ id: string; price: string }>(
      `SELECT id, price::text FROM pricing_records
       WHERE store_id = $1 AND sku = $2 AND effective_from < $3::date AND cancelled_at IS NULL
       ORDER BY effective_from DESC LIMIT 1 FOR UPDATE`, [event.store_id, event.sku, effectiveDate],
    );
    const next = await client.query<{ effective_from: string }>(
      `SELECT effective_from::text FROM pricing_records
       WHERE store_id = $1 AND sku = $2 AND effective_from > $3::date AND cancelled_at IS NULL
       ORDER BY effective_from ASC LIMIT 1`, [event.store_id, event.sku, effectiveDate],
    );
    if (previous.rows[0]) {
      await setPriceEnd(client, previous.rows[0].id, addCalendarDays(effectiveDate, -1), user.userId, correlationId);
    }

    const id = randomUUID();
    await client.query(
      `INSERT INTO pricing_records (id, store_id, sku, product_name, price, currency, effective_from, effective_through, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5::numeric, $6, $7::date, CASE WHEN $8::date IS NULL THEN NULL ELSE $8::date - 1 END, $9, $9)`,
      [id, event.store_id, event.sku, record.product_name, event.old_price, record.currency, effectiveDate, next.rows[0]?.effective_from ?? null, user.userId],
    );
    await client.query(
      `INSERT INTO pricing_audit_events (pricing_record_id, store_id, sku, old_price, new_price, new_effective_from, changed_by, reason, source, correlation_id)
       VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6::date, $7, $8, 'undo', $9)`,
      [id, event.store_id, event.sku, previous.rows[0]?.price ?? null, event.old_price, effectiveDate, user.userId, `Compensating change for audit event ${event.id}`, correlationId],
    );
    return { id, effectiveDate };
  });
}

export async function deletePriceHistory(user: User, recordId: string, correlationId: string): Promise<void> {
  if (user.role !== 'STORE_ADMIN') throw new ServiceError('You do not have permission for this action', 403, 'FORBIDDEN');
  await inTransaction(async (client) => {
    await lockTimeline(client, user, recordId);
    const record = await client.query('SELECT store_id, sku FROM pricing_records WHERE id = $1 FOR UPDATE', [recordId]);
    if (!record.rows[0]) throw new ServiceError('Price record not found', 404, 'PRICE_NOT_FOUND');
    await client.query(
      `INSERT INTO pricing_history_deletions (pricing_record_id, store_id, sku, deleted_by, reason, correlation_id)
       VALUES ($1, $2, $3, $4, 'Store admin requested history deletion', $5)`,
      [recordId, record.rows[0].store_id, record.rows[0].sku, user.userId, correlationId],
    );
    await client.query('DELETE FROM pricing_audit_events WHERE pricing_record_id = $1', [recordId]);
  });
}
