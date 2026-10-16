ALTER TABLE pricing_audit_events ADD COLUMN IF NOT EXISTS old_effective_through date;
ALTER TABLE pricing_audit_events ADD COLUMN IF NOT EXISTS new_effective_through date;
