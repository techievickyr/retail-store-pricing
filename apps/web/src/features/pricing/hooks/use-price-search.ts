'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { pricingApi } from '../pricing-api';
import type { PaginationMetadata, PriceRecord, PriceSearchFilters, PriceSortDirection, PriceSortKey, StoreOption } from '../types';

interface QueryResult { query: string; data: PriceRecord[]; pagination: PaginationMetadata }
interface QueryFailure { query: string; message: string }

const emptyFilters: PriceSearchFilters = {
  storeId: '', productName: '', sku: '', minPrice: '', maxPrice: '', currency: '', effectiveDate: '',
};

export function usePriceSearch() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [filters, setFilters] = useState<PriceSearchFilters>({ ...emptyFilters });
  const [appliedFilters, setAppliedFilters] = useState<PriceSearchFilters>({ ...emptyFilters });
  const [result, setResult] = useState<QueryResult | null>(null);
  const [failure, setFailure] = useState<QueryFailure | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<PriceSortKey>('productName');
  const [direction, setDirection] = useState<PriceSortDirection>('asc');

  useEffect(() => {
    const controller = new AbortController();
    void pricingApi.getStores(controller.signal).then(setStores).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, direction });
  Object.entries(appliedFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const query = params.toString();

  useEffect(() => {
    const controller = new AbortController();
    void pricingApi.getPrices(query, controller.signal)
      .then((response) => setResult({ query, data: response.data, pagination: response.pagination }))
      .catch((cause: Error) => {
        if (!controller.signal.aborted) setFailure({ query, message: cause.message });
      });
    return () => controller.abort();
  }, [query]);

  const currentResult = result?.query === query ? result : null;
  const error = failure?.query === query ? failure.message : '';

  function updateFilter(key: keyof PriceSearchFilters, value: string): void {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPage(1);
    setFailure(null);
    setAppliedFilters({ ...filters });
  }

  function clearFilters(): void {
    setFilters({ ...emptyFilters });
    setAppliedFilters({ ...emptyFilters });
    setPage(1);
    setFailure(null);
  }

  function toggleSort(key: PriceSortKey): void {
    if (sort === key) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else { setSort(key); setDirection('asc'); }
  }

  function changePageSize(value: number): void {
    setPageSize(value);
    setPage(1);
  }

  return {
    stores,
    filters,
    updateFilter,
    submit,
    clearFilters,
    appliedFilterCount: Object.values(appliedFilters).filter(Boolean).length,
    rows: currentResult?.data ?? [],
    pagination: currentResult?.pagination,
    loading: currentResult === null && error.length === 0,
    error,
    page,
    setPage,
    pageSize,
    changePageSize,
    sort,
    direction,
    toggleSort,
  };
}
