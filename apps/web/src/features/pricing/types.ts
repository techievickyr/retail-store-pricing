export interface StoreOption {
  storeId: string;
  name: string;
  country?: string;
  currency: string;
}

export interface StoreListResponse {
  stores: StoreOption[];
}

export interface UploadLimitsResponse {
  maxUploadBytes: number;
}

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PriceRecord {
  id: string;
  storeId: string;
  sku: string;
  productName: string;
  price: string;
  currency: string;
  effectiveDate: string;
  effectiveThrough: string | null;
  version: number;
  isScheduled?: boolean;
  createdAt?: string;
  createdBy?: string;
}

export interface PriceSearchFilters {
  storeId: string;
  productName: string;
  sku: string;
  minPrice: string;
  maxPrice: string;
  currency: string;
  effectiveDate: string;
}

export type PriceSortKey = 'productName' | 'sku' | 'price' | 'effectiveDate' | 'storeId';
export type PriceSortDirection = 'asc' | 'desc';

export type PriceConfirmation =
  | { action: 'cancel-price' }
  | { action: 'delete-history' }
  | { action: 'compensate'; auditEventId: number };

export interface PriceListResponse {
  data: PriceRecord[];
  pagination: PaginationMetadata;
}

export interface ImportJob {
  id: string;
  filename: string;
  storeId: string;
  status: 'queued' | 'processing' | 'completed' | 'completed_with_errors' | 'failed' | string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  skippedRecords: number;
  createdAt: string;
  completedAt: string | null;
  startedAt?: string | null;
  createdBy?: string;
  terminalError?: string | null;
}

export interface ImportRowResult {
  rowNumber: number;
  status: 'success' | 'failed' | 'skipped';
  field: string | null;
  rejectedValue: string | null;
  reason: string;
}

export interface ImportListResponse {
  imports: ImportJob[];
}

export interface ImportDetailResponse {
  import: ImportJob;
}

export interface ImportRowsResponse {
  rows: ImportRowResult[];
}

export interface RetryImportResponse {
  id: string;
  retryRows: number;
}

export interface UploadAccepted {
  id: string;
  status: string;
}

export interface PriceDetailResponse {
  price: PriceRecord;
}

export interface AuditEvent {
  id: number;
  oldPrice: string | null;
  newPrice: string | null;
  oldEffectiveDate: string | null;
  newEffectiveDate: string | null;
  changedBy: string;
  changedAt: string;
  reason: string;
  source: string;
}

export interface PriceHistoryResponse {
  events: AuditEvent[];
}

export interface CurrentUserResponse {
  user: { role: string };
}

export interface PriceUpdateInput {
  price: string;
  effectiveDate: string;
  version: number;
}

export interface ScheduledPriceUpdateResponse {
  id: string;
  message: string;
}

export interface CompensatingChangeResponse {
  id: string;
  effectiveDate: string;
  message: string;
}
