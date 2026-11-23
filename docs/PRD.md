# PRD — LazarOS

## Section index

> Agents: do not Read this file whole. `grep -n "^## " docs/PRD.md` for live line numbers,
> then Read with `offset`/`limit`.

| Section | Title |
|---|---|
| 1 | One-line summary |
| 2 | Actors and permissions |
| 3 | Domain model |
| 4 | Flows |
| 5 | Screens |
| 6 | Numbers, limits and formats |
| 7 | Security |
| 8 | Seeding |
| 9 | Deployment target |
| 10 | Out of scope |

## 1. One-line summary

A personal task tracker that resurfaces missed deadlines every day as **Overdue** instead of
letting them fall out of view.

## 2. Actors and permissions

There is one actor: **user**. There is no admin, no shared workspace, no role system.

Every user may act only on their own tasks (PRD §7). Accounts come to exist by **public
signup** — `POST /api/auth/register` is unauthenticated and creates a profile with a hashed
password ([backend/controllers/authController.js:10-47](../backend/controllers/authController.js)).
There is no email verification, no invite flow and no password reset.

## 3. Domain model

Two objects — see `docs/DB.md` for the authoritative schema.

- **Profile** — a user account. Holds identity and the bcrypt password hash.
- **Task** — a thing the user has to do by a date. Owns `title`, optional `description`,
  `due_date` (`DATE`), `priority`, `status`, and an `is_deleted` flag.

A task is owned by exactly one profile. Nothing else is owned by anything.

## 4. Flows

### 4.1 Register

1. User fills the register form at `/register`.
2. Client validates with Zod — all four fields present, email format valid, password meets
   §6, confirmation matches ([frontend/src/features/auth/validation/index.ts:17-28](../frontend/src/features/auth/validation/index.ts)).
3. On submit, `POST /api/auth/register` with `{ first_name, last_name, email, password }`.
4. Server validates again ([backend/validation/authSchemas.js:12-17](../backend/validation/authSchemas.js)).
5. If email already exists → `400 Email already in use`.
6. Otherwise bcrypt-hash the password (cost 10), insert, sign JWT, set `jwt` cookie, respond
   `201` with the user payload.
7. Client stores the user in `authStore` and navigates to `/` (Today).

### 4.2 Login

1. User fills the form at `/login`.
2. `POST /api/auth/login` with `{ email, password }`.
3. Unknown email → `401 Invalid email or password`. Wrong password → **the same**
   `401 Invalid email or password` ([authController.js:67-78](../backend/controllers/authController.js)).
   The two paths return an identical string so the endpoint cannot be used to enumerate
   accounts. Soft-deleted users are not a concept here — profiles have no soft-delete flag.
4. On success: sign JWT, set cookie, respond `200` with the user (sans password).

### 4.3 Create task

1. User opens the **New Task** modal (from Today or All Tasks).
2. Required: `title`, `due_date`, `priority`. Optional: `description`.
3. `POST /api/tasks` with the form payload. Server stamps `user_id` from the session, not the
   body ([taskController.js:139](../backend/controllers/taskController.js)).
4. `201` with the full row.
5. Client calls `reload()` on the page's `useAsync`.

### 4.4 Edit task

1. Edit opens a modal with the task preloaded.
2. `PUT /api/tasks/:id` with any subset of `{ title, description, due_date, priority, status }`
   ([backend/validation/taskSchemas.js:10-19](../backend/validation/taskSchemas.js)).
3. Server verifies ownership and that `is_deleted = false`; else `404 Task not found`
   ([taskController.js](../backend/controllers/taskController.js)).
4. If `status` changes `pending → completed`, `completed_at = now() at time zone 'utc'`. If
   `completed → pending`, `completed_at = NULL` ([taskController.js](../backend/controllers/taskController.js)).
5. `updated_at = now() at time zone 'utc'` on every update.

### 4.5 Complete and uncomplete

The UI's single-click checkmark toggles `status` and is implemented as a `PUT /api/tasks/:id`
with `{ status: "completed" | "pending" }` ([useTaskMutations.ts:10-15](../frontend/src/features/tasks/hooks/useTaskMutations.ts));
there is **no** `PATCH /tasks/:id/complete` endpoint. The README still lists one; see `task-01`.

### 4.6 Delete and restore

- `DELETE /api/tasks/:id` sets `is_deleted = true` and `updated_at = now() at time zone 'utc'`
  ([taskController.js](../backend/controllers/taskController.js)). The row is never
  removed from the database.
- `PUT /api/tasks/:id/restore` clears `is_deleted` ([taskController.js](../backend/controllers/taskController.js)).
  README lists this as PATCH; see `task-01`.
- The Archive page lists all `is_deleted = true` rows for the user. Only restore is available
  from there — no edit, no complete, no hard-delete.

### 4.7 Dashboard — Today

1. Client computes the local date (`getLocalToday()` in [frontend/src/features/tasks/utils/index.ts:1-7](../frontend/src/features/tasks/utils/index.ts))
   and calls `GET /api/tasks/dashboard?today=YYYY-MM-DD`.
2. Server runs the one dashboard query (see `DB.md` §6) and returns `{ overdue, today,
   completed_today }`.
3. **Overdue** = `pending` tasks with `due_date < today`. They stay on the dashboard every day
   until completed. This is the central product rule — see §4.8.
4. **Today** = `pending` tasks with `due_date = today`.
5. **Completed today** = `completed` tasks with `(completed_at AT TIME ZONE 'utc')::date = today`.
6. The server does not use `now()` or the server clock for classification. `today` comes from the client's
   local date, so a task created in New York at 23:00 and reopened in Tokyo does not slip a
   day.

### 4.8 The overdue rule (central product rule)

> **A task never disappears because its due date passed.** As long as its `status = 'pending'`
> and `is_deleted = false`, it appears in the Overdue section of Today every day, showing its
> original `due_date` and `today - due_date` (in days) as a "N days overdue" badge.

Terminal transitions out of Overdue:

- User completes the task → it moves to "Completed Today" for the rest of the day, then
  disappears from the dashboard tomorrow.
- User soft-deletes the task → it moves to the Archive.
- User edits the `due_date` forward to today or later → it moves to Today/Upcoming.

### 4.9 Upcoming

`GET /api/tasks/upcoming?today=YYYY-MM-DD` — `pending` tasks with `due_date > today`, ordered
by date then priority ([taskController.js:92-101](../backend/controllers/taskController.js)).
The client groups them by date and paginates at `PAGE_SIZE = 5`
([UpcomingPage.tsx:13](../frontend/src/features/tasks/pages/UpcomingPage.tsx)).

### 4.10 All tasks

`GET /api/tasks` returns every non-deleted task for the user, ordered by `due_date ASC,
created_at ASC`. The client applies search-by-title, status filter, priority filter and
date-equality filter in memory, then paginates at `PAGE_SIZE = 10`
([AllTasksPage.tsx:13, 29-45](../frontend/src/features/tasks/pages/AllTasksPage.tsx)).

### 4.11 Archive

`GET /api/tasks/archive` — all `is_deleted = true` tasks for the user, ordered by `updated_at
DESC` ([taskController.js:108-123](../backend/controllers/taskController.js)). Only restore is
exposed from the UI.

### 4.12 Logout

`POST /api/auth/logout` clears the `jwt` cookie server-side. The client then clears its auth
store and navigates to `/login` ([SettingsPage.tsx:12-16](../frontend/src/pages/SettingsPage.tsx)).

### 4.13 Failure paths

- **Connection lost mid-write.** The frontend `useAsync` reports the generic
  `"Failed to load ..."` error for reads; mutations surface the API message via
  `getApiError`. There is no retry, no offline queue.
- **Double-submit.** No idempotency key, no server-side guard beyond the primary key. Two
  identical POSTs produce two task rows.
- **Expired JWT.** `protect` returns 401; the axios interceptor hard-redirects to `/login`
  unless the current route is already an auth page (apiClient.ts).
- **Missing `today` query param on dashboard/upcoming.** Server returns `400 Query param
  'today' (YYYY-MM-DD) is required`.

## 5. Screens

See `docs/UI.md` for visual rules. Screen inventory:

| Route | Component | Auth |
|---|---|---|
| `/login` | `LoginPage` | Public |
| `/register` | `RegisterPage` | Public |
| `/` | `TodayPage` | Private |
| `/upcoming` | `UpcomingPage` | Private |
| `/tasks` | `AllTasksPage` | Private |
| `/archive` | `ArchivePage` | Private |
| `/settings` | `SettingsPage` | Private |

From [frontend/src/config/constants.ts:1-9](../frontend/src/config/constants.ts) and
[frontend/src/providers/router.tsx](../frontend/src/providers/router.tsx).

## 6. Numbers, limits and formats

> **PRD owns every number.** If a value appears elsewhere (UI.md, DB.md) it points here.

| Value | Limit | Source |
|---|---|---|
| `first_name` length | 1–100 | [backend/validation/authSchemas.js:13](../backend/validation/authSchemas.js) + schema `VARCHAR(100)` |
| `last_name` length | 1–100 | authSchemas.js:14 + schema `VARCHAR(100)` |
| `email` format | RFC via Zod `.email()`; schema `VARCHAR(255) UNIQUE` | authSchemas.js:15 |
| `password` length | 8–20 | authSchemas.js:5-6 |
| `password` content | ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 non-alphanumeric | authSchemas.js:7-10 |
| `title` length | 1–255 | [backend/validation/taskSchemas.js:4](../backend/validation/taskSchemas.js) + schema `VARCHAR(255)` |
| `description` length | 0–4000 | taskSchemas.js:5 (API contract; column is `text`, see Decisions D-005) |
| `due_date` format | `YYYY-MM-DD` (ISO 8601 calendar date, no time) | taskSchemas.js:6 |
| `priority` values | `low` \| `medium` \| `high` | taskSchemas.js:7, schema CHECK constraint |
| `status` values | `pending` \| `completed` | taskSchemas.js:18, schema CHECK constraint |
| Dashboard query `today` format | `/^\d{4}-\d{2}-\d{2}$/` | [taskController.js:10](../backend/controllers/taskController.js) |
| JWT lifetime | 30 days | [backend/utils/generateToken.js:5](../backend/utils/generateToken.js) |
| JWT cookie flags | `httpOnly`, `sameSite=strict`, `secure` in production | generateToken.js:7-11 |
| bcrypt cost | 10 rounds | [authController.js:30](../backend/controllers/authController.js) |
| Upcoming page size | 5 | [UpcomingPage.tsx:13](../frontend/src/features/tasks/pages/UpcomingPage.tsx) |
| All Tasks page size | 10 | [AllTasksPage.tsx:13](../frontend/src/features/tasks/pages/AllTasksPage.tsx) |
| Mobile breakpoint | `max-width: 768px` | [frontend/src/app/styles/global.css:976](../frontend/src/app/styles/global.css) |
| Locale | `en-US` for date formatting | [frontend/src/features/tasks/utils/index.ts:12, 33](../frontend/src/features/tasks/utils/index.ts) |

**Timezone:** the business day is **the user's local date**. The server never computes "today"
from its own clock for classification; it uses the `today=YYYY-MM-DD` the client sends.
Server-stored timestamps (`created_at`, `updated_at`, `completed_at`) are UTC.

## 7. Security

- Passwords are **bcrypt**-hashed with cost 10; the plaintext never leaves the controller
  function. Login and register responses omit the password column
  ([authController.js:81, 44](../backend/controllers/authController.js)).
- The JWT is kept in an **httpOnly cookie**, inaccessible to JavaScript, reducing XSS token
  theft risk.
- `SameSite=Strict` on the cookie is the only CSRF defence. There are no CSRF tokens.
- **`user_id` for every task operation comes from the verified session, never from the
  request body or URL path.** Every task query filters on `user_id = $n`
  ([taskController.js, every handler](../backend/controllers/taskController.js)).
- All SQL is **parameterized** through `pool.request().input(...)`; there is no string
  interpolation of user input anywhere.
- Validation runs on both **client** (Zod) and **server** (Zod). The server is authoritative.
- `JWT_SECRET` is read from the environment. There is no fallback.
- Login's error message is **identical** for "unknown email" and "wrong password" to prevent
  user enumeration (§4.2).
- There is **no rate limiting**, **no account lockout**, **no password reset**, **no email
  verification**. See §10.

## 8. Seeding

The only seed path is the Prisma seed script (`prisma/seed.mjs`, run with `node prisma/seed.mjs`),
which upserts one profile plus twenty task rows anchored to the current date. See `DB.md` §4.

There is no automated or per-test seeding. There is no admin UI for reseeding.

## 9. Deployment target

Local development on Windows, against a local **PostgreSQL** database (the `pg` driver with an
env-driven `DATABASE_URL`; see Tech §2 and DB). The only configured production signal is
`NODE_ENV=production` which flips the JWT cookie's `secure` flag to `true`
([generateToken.js:9](../backend/utils/generateToken.js)). There is no deployment target
documented beyond that.

## 10. Out of scope

- **Multi-user sharing.** No shared tasks, no teams, no org accounts.
- **Email verification, password reset.** A forgotten password means the account is
  effectively dead; the DB has to be edited by hand.
- **Rate limiting, account lockout, CSRF tokens.** Known omissions.
- **Mobile app.** Web only.
- **Notifications of any kind.** No email, no push, no reminders.
- **Recurring tasks.** Each task has one `due_date`.
- **Attachments on tasks.** Title + description only.
- **Subtasks or hierarchy.** Flat list.
- **Hard delete.** Everything soft-deletes; nothing ever leaves the database.
- **Changing the hashing policy, the JWT lifetime, or the CSRF posture.** Those three are
  decisions the system treats as settled (see Decisions D-006, D-007, D-008).
- **Frontend test framework.** A known refactor campaign; not in scope of routine feature work.
  (The ORM and migrations framework are now adopted — Prisma Migrate, D-018; the backend test
  framework is Vitest.)
