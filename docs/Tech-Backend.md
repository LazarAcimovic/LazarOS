# Tech — Backend

## Section index

> Agents: do not Read this file whole. `grep -n "^## " docs/Tech-Backend.md` for live line
> numbers, then Read with `offset`/`limit`.

| Section | Title |
|---|---|
| 1 | Project layout |
| 2 | Request pipeline |
| 3 | Authorization layering |
| 4 | Tokens and cookies |
| 5 | Validation |
| 6 | Error handling |
| 7 | Secrets and configuration |
| 8 | Time handling |
| 9 | Testing |

## 1. Project layout

> verified at 82e2378

```
backend/
├── config/
│   └── db.js                     # mssql pool singleton
├── controllers/
│   ├── authController.js         # register / login / logout / me
│   └── taskController.js         # dashboard / upcoming / all / archive / CRUD / restore
├── db/
│   └── schema.sql                # drop-recreate schema + seed
├── middleware/
│   ├── asyncHandler.js           # async error adapter
│   ├── errorMiddleware.js        # notFound + central errorHandler
│   └── protect.js                # cookie-based JWT auth
├── routes/
│   ├── authRoutes.js
│   └── taskRoutes.js
├── utils/
│   └── generateToken.js          # signs JWT, sets httpOnly cookie
├── validation/
│   ├── authSchemas.js            # Zod — register, login
│   └── taskSchemas.js            # Zod — create, update
├── package.json
└── server.js                     # app bootstrap
```

## 2. Request pipeline

The `express` app is assembled in [server.js:10-32](../backend/server.js):

```
request
  → cors (allowlisted localhost origins, credentials: true)   server.js:13
  → express.json + urlencoded                                 server.js:24
  → cookie-parser                                             server.js:26
  → /api/auth  → authRoutes                                   server.js:28
  → /api/tasks → taskRoutes (protect applied at router level) server.js:29
  → notFound (404 adapter)                                    server.js:31
  → errorHandler (central JSON responder)                     server.js:32
```

Every controller is wrapped in `asyncHandler` ([middleware/asyncHandler.js](../backend/middleware/asyncHandler.js))
so a rejected promise forwards to `errorHandler` — no `try/catch` boilerplate in controllers.

## 3. Authorization layering

- **Public routes:** `POST /api/auth/register`, `POST /api/auth/login`
  ([authRoutes.js:7-8](../backend/routes/authRoutes.js)).
- **Everything else is authenticated:** `/api/auth/logout`, `/api/auth/me`, and every
  `/api/tasks/*` route pass through `protect`
  ([authRoutes.js:9-10](../backend/routes/authRoutes.js), [taskRoutes.js:16](../backend/routes/taskRoutes.js)).
- `protect` ([middleware/protect.js](../backend/middleware/protect.js)):
  1. Reads `req.cookies.jwt`. Missing → `401 Not authorized, no token`.
  2. `jwt.verify(token, JWT_SECRET)`. Invalid → `401 Not authorized, token failed`.
  3. Loads `profiles` row by `decoded.userId`. Missing → `401 Not authorized, user not found`.
  4. Attaches `req.user = { id, first_name, last_name, email, created_at }` (no password).
- **Data isolation:** every task controller takes `user_id` from `req.user.id`, never from the
  request body or URL; see every `.input("user_id", sql.UniqueIdentifier, req.user.id)` call in
  [taskController.js](../backend/controllers/taskController.js). This is the single source of
  the ownership check (PRD §6).

## 4. Tokens and cookies

[`utils/generateToken.js`](../backend/utils/generateToken.js):

- Payload: `{ userId }` only.
- `expiresIn: "30d"`.
- Cookie flags: `httpOnly: true`, `sameSite: "strict"`, `secure: process.env.NODE_ENV === "production"`,
  `maxAge: 30 * 24 * 60 * 60 * 1000`.
- Cookie name: `jwt`.

Logout clears the cookie with `res.clearCookie("jwt")` ([authController.js:89](../backend/controllers/authController.js)).

**`SameSite=Strict` is the only CSRF mitigation.** There are no CSRF tokens. In dev, the
frontend runs on `http://localhost:5173` and the backend on `http://localhost:5000`; both are
on the same registrable site (`localhost`), so `Strict` permits the cookie. The comment in
[frontend/src/shared/api/apiClient.ts:6](../frontend/src/shared/api/apiClient.ts) that claims
`SameSite=None` is stale; see `task-02` in `docs/tasks/active/`.

## 5. Validation

Every write-path handler calls `schema.safeParse(req.body)` and returns `400` with the first
Zod error message:

- `registerSchema`, `loginSchema` in [validation/authSchemas.js](../backend/validation/authSchemas.js).
- `createTaskSchema`, `updateTaskSchema` in [validation/taskSchemas.js](../backend/validation/taskSchemas.js).

All size and format limits enforced here are mirrored on the frontend and documented in PRD §6.

## 6. Error handling

[`middleware/errorMiddleware.js`](../backend/middleware/errorMiddleware.js):

- `notFound` sets `res.status(404)` and forwards to `errorHandler` with the URL in the message.
- `errorHandler` takes the current `res.statusCode` (keeping `200` → `500`), responds
  `{ message, stack? }` — `stack` only when `NODE_ENV === "development"`.

Controllers set `res.status(4xx)` then `throw new Error(...)`; `asyncHandler` forwards it; the
`errorHandler` preserves the 4xx code.

## 7. Secrets and configuration

- `JWT_SECRET` must be present; there is no fallback. Starting the app without it will throw
  when the first login happens.
- DB connection: Windows auth, server name hardcoded in [config/db.js:4-10](../backend/config/db.js).
  Tracked in `task-03`.
- Nothing is written to logs beyond `console.log` for startup and `console.error` on DB
  connect failure ([server.js:37-44](../backend/server.js)).

## 8. Time handling

- All server-side timestamps (`created_at`, `updated_at`, `completed_at`) are stamped
  `SYSUTCDATETIME()` — UTC.
- `due_date` is a pure `DATE`; the server never converts it to a time, so there is no timezone
  drift. **The classification of "today" uses the client-supplied `today=YYYY-MM-DD` query
  param, built from the user's local date.** The server validates the shape and passes it
  through ([taskController.js:9-13](../backend/controllers/taskController.js)); it does not
  recompute from `GETDATE()`.
- `completed_at` is set with `SYSUTCDATETIME()` on the pending→completed transition and
  nulled on the reverse transition
  ([taskController.js:186-190](../backend/controllers/taskController.js)).

## 9. Testing

**Framework:** [Vitest](https://vitest.dev/) as the test runner, [Supertest](https://github.com/ladjs/supertest) for HTTP assertions. Run with:

```bash
cd backend && npm test
```

### Test file location

All backend tests live under `backend/tests/`. Each file is an ES module; import `app` from `../app.js` and `getPool`/`sql` from `../config/db.js`.

### Mocking boundary

**Do not mock `getPool`.** Every integration test hits a real SQL Server database. The dashboard
query is the most important rule in the system and must be exercised end-to-end. Mocking the
pool hides the exact query shape from the test.

### Test database

Tests run against a separate database — `LazarOS_Test` on the same SQL Server instance used
for development (`DESKTOP-8R6Q0B4`, Windows authentication). The database must be created once
manually:

```sql
-- Run once in SSMS or sqlcmd connected to master:
IF DB_ID('LazarOS_Test') IS NULL
    CREATE DATABASE LazarOS_Test;
```

`vitest.config.js` sets `DB_NAME=LazarOS_Test` and a test-only `JWT_SECRET` for every test
run. Each test suite drops and recreates the tables it needs in `beforeAll`, so the developer's
working database (`LazarOS`) is never touched.

### Pinned tests

| File | What it covers |
|---|---|
| `tests/dashboard.test.js` | `GET /api/tasks/dashboard` — three-bucket shape, row counts, `days_overdue` (PRD §4.7–4.8) |

### Rules that always apply

- Do not assert against `completed_at` to the millisecond; compare `CAST(completed_at AS DATE)`.
- Do not reseed in parallel; the drop-recreate schema is not reentrant.
