# LazarOS — Personal Task & Deadline Tracker

A personal productivity application that resurfaces missed deadlines every day instead of letting them silently fall off the list. Create a task, give it a due date, and the app surfaces it on the right day — and keeps surfacing it, overdue, until it's done.

---

## Why it exists

LazarOS replaces the spreadsheet I used to track things I needed to **do or review by a certain date**. The idea is simple — a task with a due date that appears on the right day — but what makes it more than a to-do list is how it handles **missed deadlines**: a `pending` task whose due date has passed never disappears. It resurfaces in the **Overdue** section every single day, showing its original due date and how long it's overdue, until the user completes it. That single behaviour fixes the main weakness of a spreadsheet: obligations quietly scrolling out of view.

---

## Demo

The application walkthrough is recorded in four parts:

**Part 1**

https://github.com/user-attachments/assets/34ba4dd8-b035-43e6-9215-363e8424f993

**Part 2**

https://github.com/user-attachments/assets/d95338ba-240b-4bec-ae26-45931ad40ebf

**Part 3**

https://github.com/user-attachments/assets/c7160e64-6d9c-4edd-8a6c-2dce64eceebd

**Part 4**

https://github.com/user-attachments/assets/cb8565fd-11d7-417a-81ea-661ae7ab6a96

---

## Tech stack

A full-stack TypeScript/JavaScript system with a clear separation between a React SPA and an Express API over PostgreSQL.

| Category | Technology |
|---|---|
| **Frontend** | React 19 (React Compiler), TypeScript (strict), Vite |
| **Styling** | Tailwind CSS v4 with shadcn/ui (Radix primitives), CSS custom-property theming, light/dark mode |
| **Forms & validation** | React Hook Form + Zod (shared schemas via `@hookform/resolvers`) |
| **State management** | Zustand (auth and theme stores) |
| **HTTP client** | Axios (`withCredentials`, async/await + `AbortController` cancellation) |
| **Backend** | Node.js, Express |
| **Database** | PostgreSQL |
| **Data access** | Prisma (typed client on a shared `pg` pool) + one parameterized `$queryRaw` for the computed dashboard |
| **Authentication** | JWT in an **httpOnly, SameSite=Strict cookie**; bcrypt password hashing |
| **Testing** | Vitest + Supertest (backend), Testing Library + MSW (frontend), Playwright (E2E) |

> **Data access by design:** Prisma's generated client is the primary data-access layer — every query is parameterized and type-checked. The one exception is the dashboard's date-bucketing query, which runs as a **parameterized `prisma.$queryRaw`** tagged template; bind parameters are used everywhere, never string interpolation, which keeps the SQL-injection boundary explicit.

---

## Core business logic

- **Task lifecycle** — A task is created with a title, optional description, due date, and priority (`low` / `medium` / `high`). It starts as `pending` and can be marked `completed` (which stamps `completed_at`) or reverted back to `pending`.
- **Persistent overdue behaviour (the core feature)** — A task **never disappears** because its due date passed. While it is still `pending` past its due date, it resurfaces in the **Overdue** section every day — with its original due date and days-overdue count — until completed.
- **Local-date awareness** — "Today" is always derived from the **user's local date**, not the server's UTC clock, so a task can never appear on the wrong day because of a timezone offset.
- **Soft delete** — Deleting a task never removes the row. It sets an `is_deleted` flag and hides the task from the UI while keeping it in a read-only **Archive**, from which it can be restored.
- **Strict data isolation** — Every task belongs to exactly one user. All queries are scoped to the authenticated user's id (taken from the session cookie, never from the client), so no user can ever read or modify another user's data.

### Feature summary

- **Today dashboard** — the primary screen: today's date, summary counters (Overdue / Today / Completed), and three sections: Overdue, Today, and Completed Today.
- **Add / Edit task** — full create and update of title, description, due date, priority, and status.
- **Complete / reopen** — one-click completion with the option to reopen a task.
- **Upcoming** — future pending tasks grouped by date.
- **All Tasks** — the full list, sorted by due date, with search-by-title and filters by status, priority, and date, plus a reset action.
- **Archive** — soft-deleted tasks, with restore.
- **Settings** — dark-mode toggle, basic profile info, and logout.

---

## Architecture

### Backend — layered

The API follows a conventional layered structure, keeping request handling, business logic, and data access separated:

```
Request → Route → Middleware (auth / validation) → Controller (Prisma / $queryRaw) → PostgreSQL
```

- **config/** — a singleton `pg` connection pool (built from `DATABASE_URL`, pinned to `timezone=UTC`) and a singleton Prisma Client that rides the same pool via the pg driver adapter. The pool is created once on startup and reused for every request.
- **middleware/** — `protect` (reads and verifies the JWT cookie, loads the user), `asyncHandler`, `notFound`, and a central `errorHandler`.
- **controllers/** — one handler per operation, going through the Prisma client (with the dashboard's single parameterized raw query).
- **routes/** — thin Express routers grouped by domain (`auth`, `tasks`).
- **utils/** — `generateToken` (signs the JWT and sets the httpOnly cookie).
- **validation/** — Zod schemas for auth and task payloads.

### Frontend — Feature-Sliced Design (FSD)

Each feature (`auth`, `tasks`, `settings`) owns a self-contained slice with its own `api/`, `components/`, `hooks/`, `models/`, `pages/`, and `utils/`, each exposed through a barrel (`index.ts`). A feature never reaches into another feature's internals — only its barrel. Cross-cutting concerns live outside features: shadcn/ui primitives in `components/ui/`, app composites in `components/shared/`, a shared Axios client, the router, the `AuthGuard`, and the Zustand stores. API calls run through custom hooks that manage loading/error state and cancel in-flight requests on unmount via `AbortController`.

### Authentication flow

Authentication is entirely cookie-based — **no token in `localStorage`**, no `Authorization` header, and no client-readable token.

1. On register/login the server hashes/verifies the password with **bcrypt**, signs a JWT, and returns it in an **httpOnly, SameSite=Strict cookie**.
2. The Axios client sends every request with `withCredentials: true`, so the cookie travels automatically; the backend CORS allowlist permits the local dev origins with credentials.
3. `AuthGuard` determines authentication by calling `GET /api/auth/me`; a valid cookie returns the current user, otherwise it redirects to login.
4. Logout clears the cookie server-side.

### How "Today" and "Overdue" are computed

The client computes the user's local date (`YYYY-MM-DD`) and passes it to the dashboard and upcoming endpoints. Because `due_date` is stored as a pure `DATE` (no time component), the backend classifies tasks with clean date comparisons:

- **Overdue** — `due_date < @today AND status = 'pending'`
- **Today** — `due_date = @today AND status = 'pending'`
- **Completed today** — `status = 'completed' AND completed_at::date = @today`

All queries additionally require `is_deleted = false` and `user_id = @user_id`. Each pooled connection is pinned to UTC so these comparisons are stable regardless of the server's own timezone.

---

## Data model

PostgreSQL with UUID primary keys (`gen_random_uuid()`), `CHECK` constraints for the enum-like columns, soft delete, and indexes on the columns the dashboard filters by.

### `profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` |
| `first_name` | `varchar(100)` | |
| `last_name` | `varchar(100)` | |
| `email` | `varchar(255)` | Unique |
| `password` | `varchar(255)` | bcrypt hash |
| `created_at` | `timestamptz` | UTC default |

### `tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` |
| `user_id` | `uuid` | FK → `profiles(id)` |
| `title` | `varchar(255)` | Required |
| `description` | `text` | Nullable |
| `due_date` | `date` | Date only — avoids timezone drift |
| `priority` | `varchar(10)` | `CHECK (low / medium / high)`, default `medium` |
| `status` | `varchar(10)` | `CHECK (pending / completed)`, default `pending` |
| `is_deleted` | `boolean` | Soft delete, default `false` |
| `completed_at` | `timestamptz` | Nullable |
| `created_at` | `timestamptz` | UTC default |
| `updated_at` | `timestamptz` | UTC default |

**Indexes:** `user_id`, `due_date`, `status`, and a composite `(user_id, is_deleted, status, due_date)` covering the dashboard's most frequent query.

A third table, `password_reset_tokens`, stores single-use reset tokens — only the token **hash** is persisted (never the raw token), with a unique index for lookup.

The schema is owned by Prisma (`backend/prisma/schema.prisma`); migrations live in `backend/prisma/migrations/`, and demo data is loaded by `backend/prisma/seed.mjs`.

---

## API reference

> **Base URL (development):** `http://localhost:5000/api`
> The frontend calls the API with `withCredentials` so the httpOnly cookie is sent on every request. For manual testing (e.g. Postman), enable cookie handling.

### Auth

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/auth/register` | `POST` | Public | Register a new user, hash the password, set the JWT cookie |
| `/auth/login` | `POST` | Public | Authenticate credentials, set the JWT cookie |
| `/auth/logout` | `POST` | Private | Clear the JWT cookie |
| `/auth/me` | `GET` | Private | Return the current authenticated user (used by `AuthGuard`) |

### Tasks

All task endpoints are **Private** (require a valid JWT cookie) and are scoped to the authenticated user.

| Endpoint | Method | Description |
|---|---|---|
| `/tasks/dashboard?today=YYYY-MM-DD` | `GET` | Overdue, Today, and Completed-Today buckets for the given local date |
| `/tasks/upcoming?today=YYYY-MM-DD` | `GET` | Future pending tasks, grouped by date |
| `/tasks` | `GET` | All non-deleted tasks (client applies search/filter/sort) |
| `/tasks/archive` | `GET` | All soft-deleted tasks |
| `/tasks` | `POST` | Create a task |
| `/tasks/:id` | `PUT` | Edit a task (title, description, due date, priority, status — including complete/reopen) |
| `/tasks/:id` | `DELETE` | Soft delete (`is_deleted = true`) |
| `/tasks/:id/restore` | `PUT` | Restore a task from the archive |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [PostgreSQL](https://www.postgresql.org/) 14+

### 1. Backend

```bash
cd backend
cp .env.example .env     # then set DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate deploy   # apply the schema
node prisma/seed.mjs        # load demo data
npm run dev                 # starts the API on http://localhost:5000
```

Key environment variables (see `backend/.env.example`):

```env
PORT=5000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/LazarOS
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/LazarOS_Test
JWT_SECRET=replace-me-with-a-long-random-string
# NODE_ENV=production   # flips the cookie's `secure` flag on
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev     # Vite dev server, from http://localhost:5173
```

The frontend reads the API base URL from `VITE_API_URL` (defaults to `http://localhost:5000/api` in development).

### Testing

```bash
cd backend && npm test          # Vitest + Supertest against LazarOS_Test
cd frontend && npm run test:e2e  # Playwright E2E (prepares LazarOS_E2E; first run: npx playwright install chromium)
```

---

## Security notes

- Passwords are hashed with **bcrypt**; plaintext passwords are never stored or returned.
- The JWT lives in an **httpOnly, SameSite=Strict cookie**, inaccessible to client-side JavaScript — mitigating XSS token theft.
- `user_id` is always taken from the verified session, **never** trusted from the request body.
- All database access is **parameterized** (Prisma client plus a single parameterized `$queryRaw`), preventing SQL injection.
- Input is validated with **Zod on both the client and the server**.
- Password-reset tokens are stored **hashed**, single-use, and time-limited.
- Secrets are supplied via environment variables and kept out of version control.

---

## Development notes

LazarOS was developed with AI assistance (Claude Code) under a specification-first workflow: a detailed set of instructions driving each change, with every diff reviewed and anything that didn't meet the bar rejected. AI-assisted code is a reflection of the engineer orchestrating it — vague prompts and unreviewed output produce tangled, insecure code, while precise specifications, a clear architectural target, and disciplined review produce clean, secure, maintainable code. The tool amplifies judgment; it doesn't replace it.

That workflow rests on understanding the fundamentals it touches, among them:

- React and TypeScript
- Express and Express Router, REST API design
- JWT and httpOnly cookie-based sessions; HTTP client interceptors
- Relational data modelling and SQL-injection prevention (parameterized queries)
- Middleware, separation of concerns, DRY, and code reuse

The repository is also documented and governed by a set of internal engineering docs (`docs/`) and an agent workflow guide (`AGENTS.md`) that enforce single-source-of-truth rules, TDD discipline, and a docs-consistency pre-commit check.
