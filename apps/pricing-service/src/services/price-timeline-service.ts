import type { PoolClient } from 'pg';

// Call only while holding the store/SKU advisory lock in the caller's transaction.
export async function setPriceEnd(client: PoolClient, id: string, end: string | null, actor: string, correlationId: string, jobId: string | null = null): Promise<void> {
  await client.query(
    `WITH previous AS MATERIALIZED (
       SELECT * FROM pricing_records WHERE id = $1 FOR UPDATE
     ), changed AS (
       UPDATE pricing_records AS price SET effective_through = $2::date,
         version = price.version + 1, updated_at = now(), updated_by = $3
       FROM previous WHERE price.id = previous.id AND price.effective_through IS DISTINCT FROM $2::date
       RETURNING price.id, price.store_id, price.sku, price.price, price.effective_from,
         previous.effective_through AS old_end, price.effective_through AS new_end
     )
     INSERT INTO pricing_audit_events
       (pricing_record_id, store_id, sku, old_price, new_price, old_effective_from, new_effective_from,
        old_effective_through, new_effective_through, changed_by, reason, source, import_job_id, correlation_id)
     SELECT id, store_id, sku, price, price, effective_from, effective_from, old_end, new_end, $3,
       'Price interval end changed from ' || COALESCE(old_end::text, 'open') || ' to ' || COALESCE(new_end::text, 'open'),
       'timeline', $5::uuid, $4 FROM changed`,
    [id, end, actor, correlationId, jobId],
  );
}

export async function rebuildPriceTimeline(client: PoolClient, storeId: string, sku: string, actor: string, correlationId: string): Promise<void> {
  const rows = await client.query<{ id: string; expected_end: string | null }>(
    `SELECT id, ((lead(effective_from) OVER (ORDER BY effective_from)) - 1)::text AS expected_end
     FROM pricing_records WHERE store_id = $1 AND sku = $2 AND cancelled_at IS NULL ORDER BY effective_from`,
    [storeId, sku],
  );
  for (const row of rows.rows) await setPriceEnd(client, row.id, row.expected_end, actor, correlationId);
}
