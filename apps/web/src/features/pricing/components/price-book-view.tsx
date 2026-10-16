'use client';

import Link from 'next/link';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, CircleAlert, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/feedback-state';
import { Notice } from '@/components/ui/notice';
import { PageHeading } from '@/components/ui/page-heading';
import { StatusBadge } from '@/components/ui/status-badge';
import type { PaginationMetadata, PriceRecord, PriceSearchFilters, PriceSortDirection, PriceSortKey, StoreOption } from '../types';

export interface PriceBookViewProps {
  stores: StoreOption[];
  filters: PriceSearchFilters;
  updateFilter: (key: keyof PriceSearchFilters, value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  clearFilters: () => void;
  appliedFilterCount: number;
  rows: PriceRecord[];
  pagination?: PaginationMetadata;
  loading: boolean;
  error: string;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  pageSize: number;
  changePageSize: (value: number) => void;
  sort: PriceSortKey;
  direction: PriceSortDirection;
  toggleSort: (key: PriceSortKey) => void;
}

function formatMoney(value: string, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value));
}

export function PriceBookView(props: PriceBookViewProps) {
  const {
    stores, filters, updateFilter, submit, clearFilters, appliedFilterCount, rows, pagination,
    loading, error, page, setPage, pageSize, changePageSize, sort, direction, toggleSort,
  } = props;
  const scheduledCutoff = new Date().toISOString().slice(0, 10);

  return <div className="page-stack">
    <PageHeading
      eyebrow="PRICE OPERATIONS"
      title="Price book"
      description="Search current and scheduled prices across your authorized stores."
      action={<Link href="/pricing/upload" className="button button-primary"><span className="button-plus">+</span> Upload price feed</Link>}
    />

    <section className="summary-strip" aria-label="Price book summary">
      <div className="summary-item"><span className="summary-icon summary-icon-green"><SlidersHorizontal size={17} /></span><div><small>VISIBLE RECORDS</small><strong>{loading ? '—' : (pagination?.total ?? 0).toLocaleString()}</strong></div></div>
      <div className="summary-divider" />
      <div className="summary-item"><span className="summary-icon summary-icon-orange"><CircleAlert size={17} /></span><div><small>ACTIVE FILTERS</small><strong>{appliedFilterCount ? `${appliedFilterCount} applied` : 'None'}</strong></div></div>
      <div className="summary-spacer" />
      <span className="sync-status"><span /> LIVE DATA</span>
    </section>

    <section className="filter-panel" aria-labelledby="filter-title">
      <div className="section-topline">
        <div><h2 id="filter-title">Find a price</h2><p>Refine by store, product, SKU, price, or effective date.</p></div>
        {appliedFilterCount > 0 && <Button type="button" variant="quiet" className="text-button" icon={<X size={14} />} onClick={clearFilters}>Clear filters</Button>}
      </div>
      <form onSubmit={submit} className="filter-grid">
        <label className="field"><span>Store</span><select value={filters.storeId} onChange={(event) => updateFilter('storeId', event.target.value)}><option value="">All permitted stores</option>{stores.map((store) => <option value={store.storeId} key={store.storeId}>{store.name} ({store.storeId})</option>)}</select></label>
        <label className="field"><span>Product name</span><input value={filters.productName} onChange={(event) => updateFilter('productName', event.target.value)} placeholder="Search product" /></label>
        <label className="field"><span>SKU</span><input value={filters.sku} onChange={(event) => updateFilter('sku', event.target.value)} placeholder="e.g. SKU1001" /></label>
        <label className="field"><span>Effective on</span><input type="date" value={filters.effectiveDate} onChange={(event) => updateFilter('effectiveDate', event.target.value)} /></label>
        <label className="field"><span>Min price</span><input inputMode="decimal" value={filters.minPrice} onChange={(event) => updateFilter('minPrice', event.target.value)} placeholder="0.00" /></label>
        <label className="field"><span>Max price</span><input inputMode="decimal" value={filters.maxPrice} onChange={(event) => updateFilter('maxPrice', event.target.value)} placeholder="Any" /></label>
        <label className="field"><span>Currency</span><select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}><option value="">All currencies</option>{Array.from(new Set(stores.map((store) => store.currency))).map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
        <div className="filter-action"><Button type="submit" variant="dark" icon={<Search size={16} />}>Search prices</Button></div>
      </form>
    </section>

    <section className="data-panel" aria-labelledby="results-title">
      <div className="data-panel-head"><div><h2 id="results-title">Pricing records</h2><p>{pagination ? `${pagination.total.toLocaleString()} records found` : 'Search results'}</p></div><label className="page-size">Rows <select value={pageSize} onChange={(event) => changePageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label></div>
      {error && <Notice variant="error">{error}</Notice>}
      <div className="table-scroll"><table className="pricing-table"><thead><tr>
        <th><button onClick={() => toggleSort('productName')}>PRODUCT {sort === 'productName' ? direction === 'asc' ? <ArrowDown size={12} /> : <ArrowUp size={12} /> : null}</button></th>
        <th><button onClick={() => toggleSort('sku')}>SKU {sort === 'sku' ? direction === 'asc' ? <ArrowDown size={12} /> : <ArrowUp size={12} /> : null}</button></th>
        <th>STORE</th>
        <th><button onClick={() => toggleSort('price')}>PRICE {sort === 'price' ? direction === 'asc' ? <ArrowDown size={12} /> : <ArrowUp size={12} /> : null}</button></th>
        <th>EFFECTIVE FROM</th><th>STATUS</th><th><span className="sr-only">Actions</span></th>
      </tr></thead><tbody>
        {loading && <tr><td colSpan={7}><LoadingState>Loading price records…</LoadingState></td></tr>}
        {!loading && rows.length === 0 && <tr><td colSpan={7}><EmptyState icon={<Search size={20} />} title="No prices found" description="Try another search or clear filters." /></td></tr>}
        {!loading && rows.map((row) => {
          const scheduled = row.effectiveDate > scheduledCutoff;
          return <tr key={row.id}>
            <td><Link className="product-link" href={`/pricing/${row.id}`}>{row.productName}</Link><small className="cell-subtitle">{row.storeId}</small></td>
            <td><span className="sku-code">{row.sku}</span></td>
            <td>{stores.find((store) => store.storeId === row.storeId)?.name ?? row.storeId}</td>
            <td><strong className="price-value">{formatMoney(row.price, row.currency)}</strong></td>
            <td><span className="date-value">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${row.effectiveDate}T00:00:00Z`))}</span>{row.effectiveThrough && <small className="cell-subtitle">Until {row.effectiveThrough}</small>}</td>
            <td><StatusBadge kind={scheduled ? 'scheduled' : 'current'}>{scheduled ? 'Scheduled' : 'Current'}</StatusBadge></td>
            <td><Link className="icon-link" href={`/pricing/${row.id}`} aria-label={`Open ${row.productName}`}><ChevronRight size={17} /></Link></td>
          </tr>;
        })}
      </tbody></table></div>
      <div className="table-footer"><span>{pagination && pagination.total > 0 ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, pagination.total)} of ${pagination.total}` : 'No results'}</span><div className="pagination-controls"><button className="pagination-button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span>Page <strong>{page}</strong> of <strong>{Math.max(1, pagination?.totalPages ?? 1)}</strong></span><button className="pagination-button" disabled={loading || page >= (pagination?.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)} aria-label="Next page"><ChevronRight size={16} /></button></div></div>
    </section>
  </div>;
}
