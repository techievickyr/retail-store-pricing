# Assumptions and Business Rules

## Confirmed in local requirement clarifications

- Managers operate only within assigned stores; admins operate across stores. Viewer is a read-only demonstration role.
- One selected store per CSV, including admin uploads. Multi-store/multi-country files are not supported.
- CSV columns are Store ID, SKU, Product Name, Price, Date. The Date header remains required; a blank Date value means tomorrow in the store timezone.
- All new prices and edits must be future-dated in the store timezone. Already-effective prices cannot be edited/cancelled. Undo creates a new compensating change for tomorrow.
- Duplicate identity is store/SKU/effective date; duplicates are skipped and reported. Valid rows apply despite invalid rows.
- A newly inserted schedule closes the predecessor the day before its effective date and preserves later schedules.
- Future records may be edited/cancelled. Cancellation preserves the record and reserves its date; creating another record on that date is not supported.
- Imports have persisted status, successful/failed/skipped counts, per-row reasons and downloadable reports. A retry selects failed data rows only and requires a finished source job.
- History persists until an admin deletes it. The deletion itself is recorded separately.

## Implementation interpretations

- A missing date is resolved at upload acceptance, retained through retries, and never silently shifted after delay. A row whose resolved date is no longer future at processing time fails validation and needs a new corrected upload.
- A malformed file/header requires correction and reupload. Retry is useful for recoverable row failures, not editing the original CSV.
- Cancelled price dates remain reserved by the unconditional unique constraint. This is now consistent across duplicate and collision checks; changing this policy requires a deliberate data-model change.
- Store metadata determines currency/timezone. Account profile settings do not override store pricing currency. Browser locale controls display formatting.
- Money allows nonnegative amounts up to ten integral and two fractional digits. The mock country/currency set is India/INR, UK/GBP, US/USD.
- Product existence is validated by SKU; the submitted product name is required but is not forced to equal the mock catalog name.
- Store/SKU identity is immutable for a pricing record. All pricing writers must follow the advisory-then-row lock order.
- Worker claim generation is the attempts counter. Jobs stop automatically after three claimed attempts. The queue lease is ten minutes; heartbeat is every minute.
- Mock authorization is checked at upload/retry acceptance. Workers use captured requester/store data; revocation during an already accepted job is not re-evaluated against a real identity service.

## Planning assumptions — require stakeholder confirmation

3,000 stores; up to 10,000 active SKUs/store; 3,000 signed-in browser sessions; 300 active users; 10 concurrent processing jobs; default 5 MB file cap; first-page search p95 <2 seconds; 99.5% availability. Proposed daily backups retained 30 days, RPO 24h and RTO 8h are not implemented. Earlier discussion proposed 100 concurrent users; this package uses the existing README's 300 as a sizing target, not a confirmed business requirement. Uploads/day, rows/day, price history growth, import completion target, residency, raw-file retention and DR ownership remain open.

## Infrastructure assumptions

Compose is local development infrastructure with one PostgreSQL and one Redis. Production TLS, ingress, identity, secrets, HA, backups, monitoring and orchestration are external delivery work. Kafka, object storage and real Auth/Store/Product services are planned replacements, not existing deployables. No Git repository URL or remote was available during review.
