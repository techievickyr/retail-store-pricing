# Tiger Retail Pricing

A runnable pricing-management module for a multi-store retail chain. The implementation includes a Next.js operator UI, stateless Express API, PostgreSQL pricing and durable import-job queue, a separate Node worker, mock auth/store/product adapters, and optional Redis caching.

## Architecture and assumptions

See [docs/architecture.md](docs/architecture.md) for the context, schema, API, import lifecycle, RBAC, reliability assumptions, and scaling decisions. The local implementation assumes 3,000 signed-in sessions, 300 active users, 10 concurrent imports, 5 MB CSV uploads, a 2-second p95 search target, and 99.5% availability. These are initial targets to verify through load testing, not measured guarantees.

The mock auth header is for local development only; production API startup rejects it unless ALLOW_MOCK_AUTH_IN_PRODUCTION=true explicitly enables an isolated demonstration. Replace `AuthProvider` with a trusted OIDC/SSO integration before deployment. Store and product adapters use deterministic mock data. PostgreSQL polling is a durable local queue implementation behind the worker boundary; Kafka/object storage are future integrations requiring payload and lifecycle adapters; neither is implemented.

## Requirements

- Node.js 20.9 or later
- npm
- Docker Compose for PostgreSQL and Redis

## Run locally

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Start dependencies: `docker compose up -d` (PostgreSQL is exposed on port 5433 to avoid a conflict with a common host PostgreSQL port).
3. Install packages: `npm ci`, `npm ci --prefix apps/pricing-service`, and `npm ci --prefix apps/web`.
4. Create schema and sample rows: `npm run migrate --prefix apps/pricing-service -- --seed`.
5. Start web, API, and worker: `npm run dev`.
6. Open <http://localhost:3000>. The API listens at <http://localhost:4000>.

The root `npm run dev` starts the web app, API, and worker supervisor. The supervisor forks two child workers by default; set `WORKER_PROCESS_COUNT` to change that count. To run just one service, use `npm run dev:web`, `npm run dev:api`, or `npm run dev:worker`.

Mock identities are selectable in the top-right UI control:

- `manager-store001`: store manager scoped to STORE001
- `manager-store100`: store manager scoped to STORE100
- `store-admin`: cross-store admin with mock-user listing
- `pricing-viewer`: read-only cross-store viewer

## Import behavior

Upload a single-store `.csv` with `Store ID,SKU,Product Name,Price,Date` headers. `MAX_UPLOAD_BYTES` defaults to 5 MB. Valid rows process even if other rows fail. Duplicate `(store, SKU, effective date)` rows are skipped. Missing date values are resolved to tomorrow in the store timezone when the upload is accepted, and retries preserve that date. Delayed rows whose date is no longer future fail validation rather than being silently shifted. Each import reports per-row results and offers a downloadable CSV; retries include only failed source rows after completion. Malformed files require correction and reupload. Cancelled dates remain reserved.

Run the example import files in `samples/`. Dates in the examples are deliberately far in the future so they remain valid during development.

## Useful commands

```sh
npm run build:api
npm run build:web
npm run test:api
npm run test:web
npm run lint:web
npm run migrate --prefix apps/pricing-service
```

`GET /health` is a liveness check and `GET /ready` checks PostgreSQL readiness. `GET /api/me` reports the current mock identity. Redis is optional: cache reads/writes fall back safely if it is unavailable. PostgreSQL is always the pricing system of record.

## Safe database testing

The default test run skips database integration tests unless `TEST_DATABASE_URL` is explicitly set. Tests never inherit `DATABASE_URL` or the development database from `.env`. A supplied test URL must name a dedicated database ending in `_test`.

Create a separate disposable `pricing_test` database, apply the schema with `DATABASE_URL=postgres://pricing:pricing@localhost:5433/pricing_test npm run migrate --prefix apps/pricing-service`, then run `TEST_DATABASE_URL=postgres://pricing:pricing@localhost:5433/pricing_test npm run test:api`. Integration fixtures use a unique test SKU and clean up only their own records. Do not point test commands at a database containing business data.

See [the implementation guide](docs/implementation.md) for complete setup, test and submission instructions.

## Production deployment

The sample credentials in Compose are for local development only. Do not expose this setup publicly. Configure TLS, secret management, a real authentication provider, Redis for shared rate limits, object storage for upload payloads, worker concurrency, database pooling, backups, and monitoring for production. Current mock adapters do not replace real store/product authorization data.
