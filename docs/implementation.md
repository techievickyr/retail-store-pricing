# Source and Implementation Guide

## Source structure

```text
apps/web/
  src/app/pricing/                   Next.js routes
  src/features/pricing/              views, hooks, API DTOs and calls
  src/components/ui/                 shared controls and confirmation
  src/lib/api.ts                     Axios / mock identity / errors
apps/pricing-service/
  src/routes/                        REST transport and role checks
  src/services/                      pricing/import rules and SQL
  src/infrastructure/database/       pools, transactions, migration runner
  src/import-queue.ts                PostgreSQL queue adapter
  src/import-processor.ts            validation and transactional row writes
  src/worker.ts                      child-process supervisor
  src/worker-process.ts              polling consumer and fenced heartbeat
  database/migrations/               numbered schema changes
  database/seeds/                    opt-in demonstration rows
compose.yaml                         local PostgreSQL and Redis
samples/                             valid, invalid and mixed CSV examples
docs/                                six case-study deliverables and verification
```

There is no separate pricing-worker application or packages/shared-types directory. Service functions contain SQL; a standalone repository layer is not claimed.

## Setup

Use Node.js 20.9+ and npm, with Docker Compose available. From the project root:

```sh
cp .env.example .env
npm ci
npm ci --prefix apps/pricing-service
npm ci --prefix apps/web
docker compose up -d
npm run migrate --prefix apps/pricing-service -- --seed
npm run dev
```

Web: http://localhost:3000. API: http://localhost:4000. Development database is on localhost:5433. Copy the root environment file before starting all processes. `NEXT_PUBLIC_API_URL` is a build-time browser URL; set it before a frontend production build. Schema updates must be applied before starting updated API/worker code. Run migrations without `--seed` for upgrades; the ledger records applied files and an advisory lock serializes migration runners. For a pre-ledger installation the idempotent initial migration is registered on first run. Always back up important databases before a deployment migration.

The default worker supervisor forks two children. Pools and concurrency are configured through .env.example. Do not enable mock-auth production override on a public deployment.

## Safe tests

Default `npm run test:api` skips database suites without an explicit TEST_DATABASE_URL. Test setup always replaces the application DATABASE_URL, and rejects explicit URLs whose database name does not end in `_test`. Fixtures use unique SKUs and remove only their own rows.

```sh
docker compose exec -T postgres createdb -U pricing pricing_test
DATABASE_URL=postgres://pricing:pricing@localhost:5433/pricing_test npm run migrate --prefix apps/pricing-service
TEST_DATABASE_URL=postgres://pricing:pricing@localhost:5433/pricing_test npm run test:api
npm run test:web
npm run lint:web
npm run build:api
npm run build:web
```

The database creation command is needed once; skip it if pricing_test already exists. These example credentials are for local development. Do not substitute a business database, even if it has a `_test` suffix. Integration tests mutate fixtures and use the real schema. Frontend build may need outbound access to fetch the configured Google fonts.

## Requirement traceability

| Requirement | Main source | Verification |
|---|---|---|
| CSV upload/persistence | routes/create-import.ts, services/import-service.ts, import-queue.ts | pricing-workflow.test.ts |
| Validation/partial success/duplicates | csv.ts, import-processor.ts | csv.test.ts, import-processor.test.ts |
| Search/filter/page/sort | services/pricing-service.ts | server.test.ts, pricing-workflow.test.ts |
| Edit/save/concurrency/date rules | services/price-write-service.ts, price-timeline-service.ts | price-write-service.test.ts, pricing-workflow.test.ts |
| RBAC/store scope | auth.ts, routes/* | server.test.ts, pricing-workflow.test.ts |
| Worker replay/recovery | import-queue.ts, worker-process.ts, import-processor.ts | import-processor.test.ts, pricing-workflow.test.ts |
| UI/API interaction | web/src/features/pricing, web/src/lib/api.ts | API client, shell, upload lifecycle and confirmation tests |

## API summary

GET /api/me, /api/users (admin listing only), /api/config, /api/stores, /api/products; POST /api/pricing-imports; GET /api/pricing-imports and /:id; GET /:id/errors and /:id/report.csv; POST /:id/retry; GET /api/prices and /:id; PATCH /:id with version; DELETE /:id for future cancellation; GET/DELETE /:id/history; POST /:id/undo with auditEventId; GET /health and /ready.

Errors carry code/message/details/correlationId. Health/readiness are public and exempt from the API limiter. PostgreSQL is the pricing authority; Redis outage does not block pricing writes.

## Evaluation walkthrough

Choose manager-store001, upload a single-store future-dated sample, inspect counts/report, search its SKU, edit a future price, verify history, try a stale version, cancel a schedule, then create a compensating change from an event with a previous price. Switch to viewer to confirm read-only behavior and to manager-store100 to verify scope. Only the admin may delete audit events, and a deletion record remains. Use unique future dates to avoid duplicate skips on repeat demonstrations.
