CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS pricing_import_jobs (
  id uuid PRIMARY KEY,
  filename text NOT NULL,
  store_id text NOT NULL,
  csv_content bytea NOT NULL,
  retry_row_numbers integer[],
  parent_job_id uuid REFERENCES pricing_import_jobs(id),
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'completed_with_errors', 'failed')),
  total_records integer NOT NULL DEFAULT 0,
  successful_records integer NOT NULL DEFAULT 0,
  failed_records integer NOT NULL DEFAULT 0,
  skipped_records integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  requested_by text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  locked_at timestamptz
);
CREATE INDEX IF NOT EXISTS pricing_import_jobs_queue_idx ON pricing_import_jobs (created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS pricing_import_jobs_requester_idx ON pricing_import_jobs (requested_by, created_at DESC);

CREATE TABLE IF NOT EXISTS pricing_records (
  id uuid PRIMARY KEY,
  store_id text NOT NULL,
  sku text NOT NULL,
  product_name text NOT NULL,
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  currency char(3) NOT NULL,
  effective_from date NOT NULL,
  effective_through date,
  cancelled_at timestamptz,
  cancelled_by text,
  version integer NOT NULL DEFAULT 1,
  source_import_job_id uuid REFERENCES pricing_import_jobs(id),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pricing_records_valid_period CHECK (effective_through IS NULL OR effective_through >= effective_from),
  CONSTRAINT pricing_records_store_sku_date_unique UNIQUE (store_id, sku, effective_from)
);
DROP INDEX IF EXISTS pricing_records_store_sku_timeline_idx;
CREATE INDEX IF NOT EXISTS pricing_records_sku_idx ON pricing_records (sku, effective_from DESC);
CREATE INDEX IF NOT EXISTS pricing_records_name_trgm_idx ON pricing_records USING gin (product_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS pricing_records_price_idx ON pricing_records (price);
CREATE INDEX IF NOT EXISTS pricing_records_effective_idx ON pricing_records (effective_from, effective_through);

CREATE TABLE IF NOT EXISTS pricing_import_rows (
  id bigserial PRIMARY KEY,
  import_job_id uuid NOT NULL REFERENCES pricing_import_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  field text,
  rejected_value text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_job_id, row_number)
);
CREATE INDEX IF NOT EXISTS pricing_import_rows_job_status_idx ON pricing_import_rows (import_job_id, status, row_number);

CREATE TABLE IF NOT EXISTS pricing_audit_events (
  id bigserial PRIMARY KEY,
  pricing_record_id uuid,
  store_id text NOT NULL,
  sku text NOT NULL,
  old_price numeric(12, 2),
  new_price numeric(12, 2),
  old_effective_from date,
  new_effective_from date,
  changed_by text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  source text NOT NULL,
  import_job_id uuid REFERENCES pricing_import_jobs(id),
  correlation_id text NOT NULL
);
CREATE INDEX IF NOT EXISTS pricing_audit_record_idx ON pricing_audit_events (pricing_record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS pricing_audit_store_sku_idx ON pricing_audit_events (store_id, sku, changed_at DESC);

CREATE TABLE IF NOT EXISTS pricing_history_deletions (
  id bigserial PRIMARY KEY,
  pricing_record_id uuid NOT NULL,
  store_id text NOT NULL,
  sku text NOT NULL,
  deleted_by text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  correlation_id text NOT NULL
);
