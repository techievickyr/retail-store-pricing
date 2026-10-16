# Design Decisions

These records describe the current implementation and its trade-offs. Alternatives below are review considerations, not claims about an undocumented historical decision process.

| Decision | Context and rationale | Alternative / trade-off | Production implication |
|---|---|---|---|
| Separate Next.js UI and Express API in one source tree | Keeps UI presentation separate from pricing rules; preferred stack | Next.js route handlers would reduce deployables but couple backend runtime | Independently deploy and scale; version browser/API contracts |
| Client-driven React feature hooks | Operator workflows need interactive state, upload progress and polling | Server fetching could reduce browser orchestration; current data is not SSR-loaded | Browser API origin, auth and CORS must be configured correctly |
| Tailwind plus semantic CSS | Existing design is mostly reusable semantic classes | Utility-only styling would be another valid choice | Keep style conventions consistent; Tailwind presence is not proof all styles use it |
| PostgreSQL as pricing system of record | Constraints, transactions and effective timelines require durable consistency | NoSQL requires different integrity and query design | Test indexes and capacity; define HA/backup ownership |
| Numeric money and decimal-string transport | Avoid binary floating-point money calculations | Integer minor units require currency-specific scale | Current two-decimal model covers INR/GBP/USD, not all currencies |
| Single-store append scheduling | Clarified business rule; duplicate identity is store/SKU/date | Multi-store files would need per-row scope/currency semantics | Preserve later schedules and end the predecessor the day before |
| Cancelled dates remain reserved | Preserves stable identity/history under the existing unique constraint | A partial unique index could allow replacement after cancellation | Imports skip reserved dates; edit/undo checks consistently reject collisions |
| Per-SKU advisory lock, then row locks | Serializes timeline mutations and avoids mixed lock-order deadlocks | Serializable isolation or optimistic retries require different contention handling | All writers must follow the same order; test concurrency |
| Version precondition for edits | Prevents overwriting an edit unseen by the client | Last-write-wins loses changes | Stale PATCH returns 409; cancellation currently has no version precondition |
| PostgreSQL durable queue | Atomic job/payload persistence with no broker required for the case study | Kafka or another queue separates throughput but adds delivery/lifecycle concerns | Keep bounded local implementation; do not claim Kafka exists |
| Attempt generation fences worker ownership | Lease expiry alone cannot stop an old process | UUID claim token is equivalent if enforced consistently | Ownership is checked under row lock for side effects; crashes stop after 3 claims |
| Bounded in-memory CSV parser | Simple demonstration with configurable 5 MB cap | Streaming and object storage reduce memory/event-loop pressure | Do not increase file size without capacity testing; writes are per row, not bulk |
| Partial success and row-level commits | Valid feed rows should apply even when other rows fail | All-or-nothing files violate clarified behavior | Replay uses committed outcomes; reports explain failed/skipped rows |
| Capture default date at acceptance | Queue delays/retries must not silently move a price | Computing tomorrow at execution shifts business intent | If a captured date is no longer future when processed, reject that row rather than shift it |
| Mock Auth/Store/Product interfaces | Required integrations are out of implementation scope | Real services add unrelated delivery work | Call sites still use singleton mocks; add dependency injection/HTTP clients later |
| Optional Redis TTL cache and rate counters | Reference data may be cached; PostgreSQL remains authoritative | Always-required Redis adds an availability dependency | Current limiter fails open on store failure; define production degraded-mode quotas |
| Transactional audit plus audited deletion | Clarifications permit admin deletion and compensating undo | WORM/tamper-evident audit gives stronger compliance controls | Interval repairs are recorded, but DB privileges/retention need operational controls |
| Versioned migrations and explicit seeds | Setup/upgrade should be repeatable without reseeding production | Re-running one initial file obscures upgrade history | Migrations use a ledger/advisory lock; --seed is explicit; deployment coordination remains necessary |

Source: [price write service](../apps/pricing-service/src/services/price-write-service.ts), [timeline auditing](../apps/pricing-service/src/services/price-timeline-service.ts), [import processing](../apps/pricing-service/src/import-processor.ts), [migration runner](../apps/pricing-service/src/infrastructure/database/migrate.ts), [frontend hooks](../apps/web/src/features/pricing/hooks), [cache](../apps/pricing-service/src/services/cache-service.ts).
