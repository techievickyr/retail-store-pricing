import { parse } from 'csv-parse/sync';

export interface PricingCsvRow {
  rowNumber: number;
  storeId: string;
  sku: string;
  productName: string;
  price: string;
  effectiveDate: string;
}

export interface ParsedCsv {
  rows: PricingCsvRow[];
  missingHeaders: string[];
}

const requiredHeaders = ['storeid', 'sku', 'productname', 'price', 'date'];

export function parsePricingCsv(content: Buffer): ParsedCsv {
  const rows = parse(content, {
    bom: true,
    columns: (headers: string[]) => headers.map((header) => header.trim().toLowerCase().replace(/[^a-z0-9]/g, '')),
    skip_empty_lines: true,
    trim: true,
    max_record_size: 16 * 1024,
  }) as Record<string, string>[];

  const headers = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  return {
    missingHeaders,
    rows: rows.map((row, index) => ({
      rowNumber: index + 2,
      storeId: row.storeid?.trim() ?? '',
      sku: row.sku?.trim() ?? '',
      productName: row.productname?.trim() ?? '',
      price: row.price?.trim() ?? '',
      effectiveDate: row.date?.trim() ?? '',
    })),
  };
}

export function parseDateOnly(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) return undefined;
  return value;
}

export function dateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addCalendarDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
