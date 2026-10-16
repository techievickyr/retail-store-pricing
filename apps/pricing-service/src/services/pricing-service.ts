import { canAccessStore, type User } from '../auth';
import { pool } from '../infrastructure/database/pool';
import { dateInTimezone, parseDateOnly } from '../csv';
import { mockStoreService } from '../catalog';
import { getCached } from './cache-service';
import { ServiceError } from './http-service';

export interface PriceSearchInput {
  page?: string;
  pageSize?: string;
  sort?: string;
  direction?: string;
  storeId?: string;
  sku?: string;
  productName?: string;
  minPrice?: string;
  maxPrice?: string;
  currency?: string;
  effectiveDate?: string;
  fromDate?: string;
  toDate?: string;
}

export interface PricingRecordDto {
  id: string;
  storeId: string;
  sku: string;
  productName: string;
  price: string;
  currency: string;
  effectiveDate: string;
  effectiveThrough: string | null;
  version: number;
  createdAt: Date;
  createdBy: string;
  isScheduled?: boolean;
}

export interface PriceSearchResult {
  data: PricingRecordDto[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const sortableColumns: Record<string, string> = {
  productName: 'product_name',
  sku: 'sku',
  price: 'price',
  effectiveDate: 'effective_from',
  storeId: 'store_id',
};

function parsePriceFilter(key: 'minPrice' | 'maxPrice', value: string | undefined): void {
  if (value !== undefined && !/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) {
    throw new ServiceError(`${key} must be a non-negative decimal with at most two fractional digits`, 400, 'INVALID_PRICE_FILTER');
  }
}

function addFilter(where: string[], values: unknown[], sql: string, value: unknown): void {
  values.push(value);
  where.push(sql.replace('?', `$${values.length}`));
}

export async function searchPrices(user: User, input: PriceSearchInput): Promise<PriceSearchResult> {
  const page = input.page === undefined ? 1 : Number(input.page);
  const pageSize = input.pageSize === undefined ? 25 : Number(input.pageSize);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ServiceError('page must be an integer from 1 to 1000000 and pageSize from 1 to 100', 400, 'INVALID_PAGINATION');
  }
  if (input.fromDate && input.toDate && input.fromDate > input.toDate) throw new ServiceError('fromDate must not follow toDate', 400, 'INVALID_DATE_RANGE');
  if (input.minPrice && input.maxPrice && /^\d{1,10}(?:\.\d{1,2})?$/.test(input.minPrice) && /^\d{1,10}(?:\.\d{1,2})?$/.test(input.maxPrice)) {
    const cents = (value: string) => BigInt(value.split('.')[0]!) * 100n + BigInt((value.split('.')[1] ?? '').padEnd(2, '0'));
    if (cents(input.minPrice) > cents(input.maxPrice)) throw new ServiceError('minPrice must not exceed maxPrice', 400, 'INVALID_PRICE_RANGE');
  }
  const sort = sortableColumns[input.sort ?? 'productName'] ?? sortableColumns.productName!;
  const direction = input.direction?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const where = ['cancelled_at IS NULL'];
  const values: unknown[] = [];

  if (user.storeIds !== '*') addFilter(where, values, 'store_id = ANY(?::text[])', user.storeIds);
  if (input.storeId) {
    if (!canAccessStore(user, input.storeId)) throw new ServiceError('You do not have access to this store', 403, 'STORE_SCOPE_FORBIDDEN');
    addFilter(where, values, 'store_id = ?', input.storeId);
  }
  if (input.sku) addFilter(where, values, 'sku ILIKE ?', `%${input.sku.slice(0, 100)}%`);
  if (input.productName) addFilter(where, values, 'product_name ILIKE ?', `%${input.productName.slice(0, 100)}%`);

  parsePriceFilter('minPrice', input.minPrice);
  parsePriceFilter('maxPrice', input.maxPrice);
  if (input.minPrice) addFilter(where, values, 'price >= ?::numeric', input.minPrice);
  if (input.maxPrice) addFilter(where, values, 'price <= ?::numeric', input.maxPrice);

  const currency = input.currency?.toUpperCase() ?? '';
  if (currency && !/^[A-Z]{3}$/.test(currency)) throw new ServiceError('currency must be a three-letter ISO code', 400, 'INVALID_CURRENCY');
  if (currency) {
    addFilter(where, values, 'currency = ?', currency);
  } else if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    let stores = await getCached('stores:all', () => mockStoreService.getStores());
    if (user.storeIds !== '*') stores = stores.filter((store) => user.storeIds !== '*' && user.storeIds.includes(store.storeId));
    if (input.storeId) stores = stores.filter((store) => store.storeId === input.storeId);
    const currencies = [...new Set(stores.map((store) => store.currency))];
    if (currencies.length > 1) throw new ServiceError('Select a currency when filtering prices across multiple currencies', 400, 'CURRENCY_REQUIRED');
    if (currencies[0]) addFilter(where, values, 'currency = ?', currencies[0]);
  }

  if (input.effectiveDate) {
    const date = parseDateOnly(input.effectiveDate);
    if (!date) throw new ServiceError('effectiveDate must use YYYY-MM-DD', 400, 'INVALID_DATE');
    values.push(date, date);
    where.push(`effective_from <= $${values.length - 1}::date AND (effective_through IS NULL OR effective_through >= $${values.length}::date)`);
  }
  if (input.fromDate) {
    const date = parseDateOnly(input.fromDate);
    if (!date) throw new ServiceError('fromDate must use YYYY-MM-DD', 400, 'INVALID_DATE');
    addFilter(where, values, '(effective_through IS NULL OR effective_through >= ?::date)', date);
  }
  if (input.toDate) {
    const date = parseDateOnly(input.toDate);
    if (!date) throw new ServiceError('toDate must use YYYY-MM-DD', 400, 'INVALID_DATE');
    addFilter(where, values, 'effective_from <= ?::date', date);
  }

  const clause = `WHERE ${where.join(' AND ')}`;
  const count = await pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM pricing_records ${clause}`, values);
  const offset = (page - 1) * pageSize;
  const data = await pool.query<PricingRecordDto>(
    `SELECT id, store_id AS "storeId", sku, product_name AS "productName", price::text, currency,
            effective_from::text AS "effectiveDate", effective_through::text AS "effectiveThrough",
            version, created_at AS "createdAt", created_by AS "createdBy"
     FROM pricing_records ${clause} ORDER BY ${sort} ${direction}, id ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, offset],
  );
  const total = Number(count.rows[0]?.total ?? 0);
  return { data: data.rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getPrice(user: User, recordId: string): Promise<PricingRecordDto> {
  const result = await pool.query<PricingRecordDto>(
    `SELECT id, store_id AS "storeId", sku, product_name AS "productName", price::text, currency,
            effective_from::text AS "effectiveDate", effective_through::text AS "effectiveThrough", version,
            created_at AS "createdAt", created_by AS "createdBy"
     FROM pricing_records WHERE id = $1 AND cancelled_at IS NULL`, [recordId],
  );
  const price = result.rows[0];
  if (!price) throw new ServiceError('Price record not found', 404, 'PRICE_NOT_FOUND');
  if (!canAccessStore(user, price.storeId)) throw new ServiceError('You do not have access to this store', 403, 'STORE_SCOPE_FORBIDDEN');
  const store = await mockStoreService.getStore(price.storeId);
  return { ...price, isScheduled: price.effectiveDate > dateInTimezone(new Date(), store?.timezone ?? 'UTC') };
}
