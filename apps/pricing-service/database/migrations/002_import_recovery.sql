ALTER TABLE pricing_import_jobs ADD COLUMN IF NOT EXISTS default_effective_date date;
ALTER TABLE pricing_import_jobs ADD COLUMN IF NOT EXISTS terminal_error text;
