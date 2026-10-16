import { API_BASE, api, currentMockUser, pricingHttpClient } from '@/lib/api';
import type {
  CompensatingChangeResponse,
  CurrentUserResponse,
  ImportDetailResponse,
  ImportJob,
  ImportListResponse,
  ImportRowsResponse,
  PriceDetailResponse,
  PriceHistoryResponse,
  PriceListResponse,
  PriceUpdateInput,
  RetryImportResponse,
  ScheduledPriceUpdateResponse,
  StoreListResponse,
  UploadLimitsResponse,
} from './types';

export const pricingApi = {
  async getStores(signal?: AbortSignal) {
    const response = await api<StoreListResponse>('/api/stores', { signal });
    return response.stores;
  },

  getUploadLimits(signal?: AbortSignal) {
    return api<UploadLimitsResponse>('/api/config', { signal });
  },

  getPrices(query: string, signal?: AbortSignal) {
    return api<PriceListResponse>(`/api/prices?${query}`, { signal });
  },

  getPrice(id: string, signal?: AbortSignal) {
    return api<PriceDetailResponse>(`/api/prices/${id}`, { signal });
  },

  getPriceHistory(id: string, signal?: AbortSignal) {
    return api<PriceHistoryResponse>(`/api/prices/${id}/history`, { signal });
  },

  getCurrentUser(signal?: AbortSignal) {
    return api<CurrentUserResponse>('/api/me', { signal });
  },

  updateScheduledPrice(id: string, input: PriceUpdateInput, signal?: AbortSignal) {
    return api<ScheduledPriceUpdateResponse>(`/api/prices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
      signal,
    });
  },

  cancelScheduledPrice(id: string, signal?: AbortSignal) {
    return api<void>(`/api/prices/${id}`, { method: 'DELETE', signal });
  },

  createCompensatingChange(id: string, auditEventId: number, signal?: AbortSignal) {
    return api<CompensatingChangeResponse>(`/api/prices/${id}/undo`, {
      method: 'POST',
      body: JSON.stringify({ auditEventId }),
      signal,
    });
  },

  deletePriceHistory(id: string, signal?: AbortSignal) {
    return api<void>(`/api/prices/${id}/history`, { method: 'DELETE', signal });
  },

  getImports(signal?: AbortSignal) {
    return api<ImportListResponse>('/api/pricing-imports', { signal });
  },

  getImport(id: string, signal?: AbortSignal) {
    return api<ImportDetailResponse>(`/api/pricing-imports/${id}`, { signal });
  },

  getImportRows(id: string, signal?: AbortSignal) {
    return api<ImportRowsResponse>(`/api/pricing-imports/${id}/errors`, { signal });
  },

  retryImport(id: string, signal?: AbortSignal) {
    return api<RetryImportResponse>(`/api/pricing-imports/${id}/retry`, { method: 'POST', signal });
  },

  async downloadImportReport(id: string, filename: string, signal?: AbortSignal): Promise<void> {
    const response = await pricingHttpClient.get<Blob>(`${API_BASE}/api/pricing-imports/${id}/report.csv`, {
      responseType: 'blob',
      signal,
      headers: { 'x-mock-user': currentMockUser() },
    });
    const objectUrl = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  },
};

export type ImportJobRecord = ImportJob;
