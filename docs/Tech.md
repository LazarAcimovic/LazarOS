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

> verified at 82e2378

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
| `pg` | `^8.16.3` | PostgreSQL driver — one shared `Pool` built from `DATABASE_URL` |
| `zod` | `^3.23.8` | Request validation |
| `dotenv` | `^16.4.5` | Loads `.env` on startup |
| `nodemon` (dev) | `^3.1.4` | Reload-on-change dev loop |
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

- **No ORM.** All DB access is raw parameterized SQL (Postgres dialect) through the shared pool.
  Adding one is `refactor-05` (Prisma), which lands on top of this migration.
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
- **Schema file:** [backend/db/schema.sql](../backend/db/schema.sql). Drop-and-recreate; no
  migration framework. Documented in `DB.md` §5.
- **Test database:** a throwaway SQL Server 2022 Docker container
  ([backend/docker-compose.test.yml](../backend/docker-compose.test.yml), host port 14333, SQL
  auth), selected via `TEST_DB_CONNECTION_STRING` set only by `vitest.config.js`. Details in
  `Tech-Backend.md` §9.
- **E2E database:** a second throwaway SQL Server 2022 container for Playwright
  ([frontend/e2e/docker-compose.e2e.yml](../frontend/e2e/docker-compose.e2e.yml), host port 14334,
  database `LazarOS_E2E`, SQL auth), created and schema-loaded per run by
  `frontend/e2e/run-e2e.mjs` and removed with `down -v`. Separate from the test DB on 14333.
  Details in `Tech-Frontend.md` §9.
- **Query style:** every call goes through `pool.query(text, params)` with `$1…$n` positional
  parameters, never string interpolation. This is the SQL-injection boundary (PRD §6).

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

## 3. Environment and configuration

### Backend env

Loaded by `dotenv/config` at the top of [server.js:1](../backend/server.js).

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `5000` |
| `JWT_SECRET` | Required to sign and verify JWTs | — (crash on missing is implicit; `jsonwebtoken` throws) |
| `NODE_ENV` | Toggles cookie `secure` flag and stack traces in error responses | — |

There is no `.env.example` yet; see `task-03`.

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
`http://localhost(:port)?` origin. Set `DATABASE_URL` (see §3), then seed the database by running
[backend/db/schema.sql](../backend/db/schema.sql) once against your PostgreSQL database with
`psql` (`psql "$DATABASE_URL" -f db/schema.sql` from `backend/`).

Backend tests (requires Docker; starts and removes the test database container itself):

```bash
cd backend && npm test
```

End-to-end tests (Playwright; requires Docker, starts the e2e database, backend and frontend,
and removes the database container itself; first run needs `npx playwright install chromium`):

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

- **No ORM** — see §1 above.
- **One pinned test per tier, no coverage threshold.** The backend has `tests/dashboard.test.js`;
  the frontend has `src/features/tasks/components/TaskCard.test.tsx`. Backfilling is future task
  work; `refactor-02` only installed the frameworks and added one test each.
- **One shared SQL Server pool, Windows auth, drop-recreate schema.** This is a
  single-developer, single-machine setup. Moving to env-based config and real migrations is a
  tracked refactor campaign, not a hidden assumption.
- **No rate limiting, no CSRF tokens, no account lockout.** `SameSite=Strict` on the JWT cookie
  is the only CSRF mitigation ([generateToken.js:10](../backend/utils/generateToken.js)). PRD §6
  documents the security posture; expanding it is out of scope.
