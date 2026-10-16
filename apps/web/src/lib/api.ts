import axios from 'axios';
import type { UploadAccepted } from '@/features/pricing/types';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const pricingHttpClient = axios.create({ baseURL: API_BASE, timeout: 30_000 });

export class ApiError extends Error {
  status: number;
  code: string;
  correlationId?: string;
  constructor(status: number, code: string, message: string, correlationId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

export function currentMockUser(): string {
  if (typeof window === 'undefined') return 'manager-store001';
  return window.localStorage.getItem('pricing-mock-user') ?? 'manager-store001';
}

pricingHttpClient.interceptors.request.use((config) => {
  config.headers.set('x-mock-user', currentMockUser());
  return config;
});

pricingHttpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    if (axios.isAxiosError(error)) {
      const body = error.response?.data as { code?: string; message?: string; correlationId?: string } | undefined;
      return Promise.reject(new ApiError(
        error.response?.status ?? 0,
        body?.code ?? 'REQUEST_FAILED',
        body?.message ?? (error.response ? 'Request failed' : 'Could not reach the pricing service'),
        body?.correlationId,
      ));
    }
    return Promise.reject(error);
  },
);

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await pricingHttpClient.request<T>({
    url: path,
    method: init.method ?? 'GET',
    headers: Object.fromEntries(headers.entries()),
    data: init.body,
    signal: init.signal ?? undefined,
  });
  if (response.status === 204) return undefined as T;
  return response.data;
}

export async function uploadCsv(
  storeId: string,
  file: File,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
): Promise<UploadAccepted> {
  const body = new FormData();
  body.set('storeId', storeId);
  body.set('file', file);
  const response = await pricingHttpClient.post<UploadAccepted>('/api/pricing-imports', body, {
    signal,
    onUploadProgress: ({ loaded, total }) => {
      if (total) onProgress(Math.min(100, Math.round((loaded / total) * 100)));
    },
  });
  return response.data;
}
