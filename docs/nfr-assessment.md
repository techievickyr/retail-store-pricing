# Non-functional Requirements Assessment

## Targets versus evidence

The original requirement names a 3,000-store international retailer but does not specify tested throughput, history volume, availability or recovery objectives. The values below are initial planning assumptions, not measured guarantees.

| NFR | Initial target / expected behavior | Implemented evidence | Remaining validation or deployment work |
|---|---|---|---|
| Scale | 3,000 stores, up to 10,000 active SKUs/store; history additional | Stateless API/UI; durable async workers; global 10-job cap; bounded pools | No 30M-record test, throughput benchmark or replica sizing; no autoscaler |
| Performance | First-page search p95 <2 seconds; 300 active users | SQL filtering/pagination/sort; name trigram index; reference cache | No load result; exact COUNT/OFFSET and SKU substring query need query-plan testing |
| Resource use | 5 MB default upload; small bounded pools | Upload size limit; worker batches; max concurrent claims | Files/rows are buffered; no aggregate queued-byte quota; reports/outcomes unpaginated |
| Availability | Proposed 99.5% monthly | Liveness/DB readiness, persistent jobs, worker restart supervisor, optional cache | Single PostgreSQL/Redis in Compose; no deployed load balancing/failover; no availability measurement |
| Reliability | Partial success, no lost accepted jobs, safe replay | Durable 202 acceptance; row transactions; unique identity; generation-fenced writes; lease reclaim and 3-attempt cap | Chaos tests and DB outage drills absent; no exactly-once claim across external systems |
| Concurrency | No accidental stale edit overwrite or timeline corruption | PATCH version check; consistent advisory-before-row lock order; interval repairs/audit | Cancellation lacks version precondition; more contention/load tests needed |
| Security | Server authorization and safe input processing | Mock RBAC/store checks, production mock guard, parameterized SQL, secure headers/CORS, bounded uploads, UUID/JSON validation, CSV formula neutralization | Real identity, TLS, secrets, network controls, dependency scanning and explicit proxy/rate-limit policy required |
| Observability | Trace requests/jobs and diagnose failures | Request/job correlation IDs, structured API/worker logs, terminal job errors, audit history, /health and /ready | No metrics exporter, distributed tracing, alert rules, worker readiness, SLO dashboard or retention pipeline |
| Recovery | Proposed daily backup, 30-day retention, RPO 24h, RTO 8h | Persistent local database volume only | No backup/restore implementation or restore test; targets unverified |
| Maintainability | Repeatable setup and modular code | TypeScript, thin routes, services/hooks, tests, migration ledger, explicit seeds | Singleton mock/global dependencies remain; API DTOs duplicated across apps; no CI/CD |
| Accessibility | Aim for WCAG 2.1 AA | Labelled controls, semantic tables, notices, focus-managed confirmation with keyboard containment/restoration | No formal audit, screen-reader/contrast/browser matrix or conformance claim |
| International use | Store-specific currency/timezone | INR/GBP/USD mock stores; future-date checks and upload defaults use store timezone; backend supplies scheduled status | No locale translation, currency conversion, data-residency policy or general currency precision model |
| Retention | History retained until admin deletes | History deletion records; no automatic price/audit purge | Raw CSV and row-result retention/archival policy absent; DB admins can modify audit storage |

## Required production evidence

Before rollout, agree feed volume/arrival rates and data distribution; test representative search/import contention, queue age and memory; test Redis/DB outages, lease expiry and process crashes; restore a backup into a clean environment; perform security/accessibility reviews; deploy and verify health-based failover. Assign owners for alerts, secrets, backups, residency and incident response.

This case study demonstrates the architecture and core safeguards. It does not establish production capacity or availability.
