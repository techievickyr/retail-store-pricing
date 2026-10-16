import { addCalendarDays, parseDateOnly, parsePricingCsv } from './csv';

describe('pricing CSV parsing', () => {
  it('normalizes headers and preserves source row numbers', () => {
    const parsed = parsePricingCsv(Buffer.from('Store ID,SKU,Product Name,Price,Date\nSTORE001,SKU1001,Coca Cola,45.00,2099-10-15\n'));
    expect(parsed.missingHeaders).toEqual([]);
    expect(parsed.rows).toEqual([{ rowNumber: 2, storeId: 'STORE001', sku: 'SKU1001', productName: 'Coca Cola', price: '45.00', effectiveDate: '2099-10-15' }]);
  });

  it('reports absent required headers', () => {
    const parsed = parsePricingCsv(Buffer.from('Store ID,SKU,Price\nSTORE001,SKU1001,45.00\n'));
    expect(parsed.missingHeaders).toEqual(['productname', 'date']);
  });

  it('accepts strict calendar dates and rejects invalid dates', () => {
    expect(parseDateOnly('2099-02-28')).toBe('2099-02-28');
    expect(parseDateOnly('2099-02-30')).toBeUndefined();
    expect(parseDateOnly('15/10/2099')).toBeUndefined();
  });

  it('adds calendar days without timezone drift', () => {
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
