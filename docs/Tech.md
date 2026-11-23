# Tech — stack, tooling, deployment

## Section index

> Agents: do not Read this file whole. `grep -n "^## " docs/Tech.md` for live line numbers,
> then Read with `offset`/`limit`. No line numbers here on purpose.

| Section | Title |
|---|---|
| 1 | Stack snapshot |
| 2 | Database tooling |
| 3 | Environment and configuration |
| 4 | Running locally |
| 5 | What's intentionally simple |

## 1. Stack snapshot

> verified at 67ce275

Two deployable tiers in one repository:

- `backend/` — Node.js + Express HTTP API.
- `frontend/` — React + Vite SPA served by Vite in dev, served as a static build in production.

Shared layer: none (no monorepo tooling, no shared packages).

### Backend — installed

From [backend/package.json](../backend/package.json):

| Package | Version | Role |
|---|---|---|
| `express` | `^4.19.2` | HTTP framework |
| `cors` | `^2.8.5` | CORS middleware |
| `cookie-parser` | `^1.4.6` | Parses the `jwt` cookie into `req.cookies` |
| `jsonwebtoken` | `^9.0.2` | Signs and verifies the JWT in the cookie |
| `bcrypt` | `^5.1.1` | Password hashing (cost 10) |
| `pg` | `^8.16.3` | PostgreSQL driver — shared `Pool` from `DATABASE_URL`; retained for the test-suite schema setup and the dashboard `$queryRaw` |
| `@prisma/client` | `7.10.1` | Prisma Client — generated, typed data-access layer; replaces the hand-written SQL (D-018) |
| `zod` | `^3.23.8` | Request validation |
| `dotenv` | `^16.4.5` | Loads `.env` on startup |
| `nodemon` (dev) | `^3.1.4` | Reload-on-change dev loop |
| `prisma` (dev) | `7.10.1` | Prisma CLI — datamodel, introspection (`db pull`) and migrations (`migrate`) (D-018) |
| `vitest` (dev) | `^5.1.1` | Test runner |
| `supertest` (dev) | `^7.3.2` | HTTP integration test client |

### Frontend — installed

From [frontend/package.json](../frontend/package.json):

| Package | Version | Role |
|---|---|---|
| `react`, `react-dom` | `^18.3.1` | UI |
| `react-router-dom` | `^6.24.1` | Client-side routing |
| `axios` | `^1.7.2` | HTTP client with `withCredentials: true` |
| `zustand` | `^4.5.4` | Global state (auth, theme) |
| `zod` | `^3.23.8` | Form validation |
| `vite` (dev) | `^6.4.6` | Dev server and build tool |
| `@vitejs/plugin-react` (dev) | `^4.7.0` | Vite React plugin |
| `typescript` (dev) | `^5.5.3` | Type checker; strict mode on, see [tsconfig.json](../frontend/tsconfig.json) |
| `vitest` (dev) | `^5.1.1` | Test runner (matches backend version) |
| `@testing-library/react` (dev) | `^16.3.3` | Component rendering for tests |
| `@testing-library/user-event` (dev) | `^14.6.13` | User interaction simulation |
| `@testing-library/jest-dom` (dev) | `^8.0.0` | DOM matchers (`toBeInTheDocument`, etc.) |
| `jsdom` (dev) | `^29.1.1` | DOM environment for vitest |

### Deliberately not installed

- **No linter or formatter.** No `eslint`/`prettier` config in either tier.
- **No pre-commit tooling** before this documentation system (the hook in `.githooks/pre-commit`
  runs only the docs check; see §4).

## 2. Database tooling

- **Driver:** the `pg` package; a single `pg.Pool` is built from `DATABASE_URL`; see
  [backend/config/db.js](../backend/config/db.js).
- **Connection:** single shared pool, created on first use and reused forever
  ([config/db.js](../backend/config/db.js)). On failure the cached promise is nulled so a later
  request retries. Each pooled connection is pinned to `timezone=UTC` so the UTC time model holds
  regardless of the server's own zone (Tech-Backend §8).
- **Connection string:** `DATABASE_URL` (e.g. `postgres://user:pass@localhost:5432/LazarOS`),
  read from the environment — nothing is hardcoded (the engine switch and env move are D-016).
- **ORM:** [Prisma](https://www.prisma.io/) `7.10.1` (D-018). The generated Prisma Client is the
  data-access layer; `prisma/schema.prisma` is the source of truth and `prisma migrate` owns schema
  changes code-first (DB §5, D-019). The one computed path (the dashboard, DB §6) stays raw via a
  parameterized `prisma.$queryRaw`. The demo seed is a Prisma seed script (`prisma/seed.mjs`).
- **Test database:** a separate PostgreSQL database `LazarOS_Test` on the same server as dev,
  selected via `DATABASE_URL` set to `TEST_DATABASE_URL` by `vitest.config.js`. No Docker.
  Details in `Tech-Backend.md` §9.
- **E2E database:** a separate PostgreSQL database `LazarOS_E2E` on the same server, reset per run
  by applying the Prisma migrations ([frontend/e2e/run-e2e.mjs](../frontend/e2e/run-e2e.mjs)).
  Separate from the dev and test databases. Details in `Tech-Frontend.md` §9.
- **Query style:** data access goes through the Prisma Client (`prisma.profiles`, `prisma.tasks`),
  which parameterizes every query. The single raw path (the dashboard) uses a **parameterized**
  `prisma.$queryRaw` tagged template — bind parameters, never string interpolation. This is the
  SQL-injection boundary (PRD §6).

### Backup and data-preservation artifacts

Before the engine migration (`refactor-04`) alters the database, the live SQL Server data is
captured so nothing is lost. The fidelity requirements, the backup → load → reconcile steps and
the parity test live in **DB §7**; the approach is recorded in D-015. Two kinds of artifact are
produced, both kept **outside the repository** because they hold real personal data and bcrypt
hashes:

- A **native SQL Server `.bak`** of `LazarOS`, produced with SQL Server's own backup tooling —
  the untouched rollback copy.
- A **portable, engine-neutral export** (one CSV per table for `profiles` and `tasks`) plus a
  `manifest.json` of per-table counts and the SHA-256 content checksum (DB §7.3), regenerated by
  [`backend/scripts/export-mssql-data.mjs`](../backend/scripts/export-mssql-data.mjs). Run it from
  `backend` as `node scripts/export-mssql-data.mjs [out-dir]`; it is read-only and deterministic
  (re-running yields identical checksums). `out-dir` defaults to a sibling `LazarOS-data-backup/`
  directory beside the repo checkout (overridable by argument), and `DB_SERVER`/`DB_NAME` override
  the source. The `manifest.json` written there is the reconciliation source of truth (DB §7.3).

The cutover into Postgres (DB §7.2 step 2, D-017) uses three more scripts, all run from `backend`:

- **Load** — [`backend/scripts/import-postgres-data.mjs`](../backend/scripts/import-postgres-data.mjs):
  `DATABASE_URL=<postgres url> node scripts/import-postgres-data.mjs [backup-dir]`. Inserts
  `profiles` then `tasks` (foreign-key order) with `ON CONFLICT (id) DO NOTHING`, so it is
  idempotent and safe to re-run. The only conversions are the documented type mappings (D-016);
  dates normalize to `YYYY-MM-DD` and timestamps round to microsecond on the `timestamptz` cast.
- **Re-manifest** — [`backend/scripts/remanifest-usec.mjs`](../backend/scripts/remanifest-usec.mjs):
  `node scripts/remanifest-usec.mjs [backup-dir]`. A backup produced before D-017 carries native
  100-ns checksums; this recomputes `manifest.json` from the existing CSVs at microsecond precision
  (preserving the original as `manifest.native.json`), needs no live SQL Server, and leaves the
  CSVs untouched. Run it once before reconcile.
- The canonical form — CSV parsing, the microsecond rounding and the SHA-256 checksum — is defined
  once in [`backend/scripts/lib/canonical.mjs`](../backend/scripts/lib/canonical.mjs) and shared by
  the export, the re-manifest and the reconcile, so the three never drift (DB §7.3).

## 3. Environment and configuration

### Backend env

Loaded by `dotenv/config` at the top of [server.js:1](../backend/server.js).

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `5000` |
| `DATABASE_URL` | PostgreSQL connection for the `pg` pool (`postgres://user:pass@host:port/db`) | — (the pool rejects on missing) |
| `JWT_SECRET` | Required to sign and verify JWTs | — (crash on missing is implicit; `jsonwebtoken` throws) |
| `NODE_ENV` | Toggles cookie `secure` flag and stack traces in error responses | — |

A template of every backend variable lives in [backend/.env.example](../backend/.env.example);
copy it to `backend/.env` (gitignored) and fill in the values.

### Frontend env

Loaded by Vite from [frontend/.env.development](../frontend/.env.development).

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Base URL the axios client points at | `/api` (fallback in [apiClient.ts:6](../frontend/src/shared/api/apiClient.ts)) |

Dev config sets it to `http://localhost:5000/api` so requests go cross-origin straight to the
backend; CORS is wide open on `localhost:*` ([server.js:13-23](../backend/server.js)).

## 4. Running locally

From the repo root:

```bash
cd backend && npm install && npm run dev
```

```bash
cd frontend && npm install && npm run dev
```

Vite picks any free port starting at 5173; the backend CORS allowlist accepts any
`http://localhost(:port)?` origin. Set `DATABASE_URL` (see §3), then from `backend/` build the
schema and seed: `npx prisma migrate deploy` (applies the migrations), then `node prisma/seed.mjs`
(the demo data).

Backend tests (against the local PostgreSQL server; `globalSetup` creates `LazarOS_Test` if it
is missing):

```bash
cd backend && npm test
```

End-to-end tests (Playwright boots the backend and frontend; `run-e2e.mjs` prepares the
`LazarOS_E2E` database first; first run needs `npx playwright install chromium`):

```bash
cd frontend && npm run test:e2e
```

The docs pre-commit hook is enabled with:

```bash
git config core.hooksPath .githooks
```

That makes `scripts/check-docs.mjs` run on every commit that touches `docs/`, `AGENTS.md` or the
script itself.

## 5. What's intentionally simple

- **Prisma with a single driver adapter** — see §1–§2 above. The one computed query (the
  dashboard) stays raw via a parameterized `$queryRaw`; every other path uses the generated client.
- **One pinned test per tier, no coverage threshold.** The backend has `tests/dashboard.test.js`;
  the frontend has `src/features/tasks/components/TaskCard.test.tsx`. Backfilling is future task
  work; `refactor-02` only installed the frameworks and added one test each.
- **One shared PostgreSQL pool, env-driven `DATABASE_URL`.** This is a single-developer setup; the
  pool backs both the test schema setup and the Prisma adapter. Schema changes go through Prisma
  Migrate (DB §5); the legacy drop-recreate `schema.sql` is retired by the code-first campaign.
- **No rate limiting, no CSRF tokens, no account lockout.** `SameSite=Strict` on the JWT cookie
  is the only CSRF mitigation ([generateToken.js:10](../backend/utils/generateToken.js)). PRD §6
  documents the security posture; expanding it is out of scope.
