# LazarOS - Personal Task & Deadline Tracker

---

## 1. Technology Stack

The application is a full-stack system built with a clear separation between a React client and an Express API backed by MSSQL Server:

| Category | Technology |
|---|---|
| **Frontend** | React, TypeScript, Vite |
| **Styling** | Vanilla CSS (BEM methodology), CSS custom properties for theming |
| **State Management** | Zustand |
| **HTTP Client** | Axios (async/await + AbortController) |
| **Validation** | Zod
| **Backend** | Node.js, Express.js |
| **Database** | Microsoft SQL Server |
| **DB Access** | `mssql` driver (`msnodesqlv8`) - raw parameterized SQL, **no ORM** |
| **Authentication** | JWT stored in an **httpOnly cookie**, bcrypt password hashing |

> **No ORM by design:** All database access is written as raw, parameterized T-SQL through a single shared connection pool. This keeps the data layer transparent and gives full control over queries and indexing.

---

## 2. Project Description & Business Logic

LazarOS is a personal productivity application built to replace the spreadsheets I used to track things I need to **do or review by a certain date** manually. The concept is pretty simple: create a task, give it a due date, and let the application surface it on the right day - automatically.

What makes it more than a to-do list is how it treats **missed deadlines**.


## 3. Development Approach & Demo

LazarOS was built completely with Claude Code. The instructions.md had over 500+ lines of code, each one commited to the according part of the arhitecture. There is a common assumption that anything "vibe coded" is low quality by default. I don't share that view. In my experience, the quality of AI-assisted code is a reflection of the person orchestrating it, not of the tool itself. Given vague instructions and unreviewed output, an AI will easily produce a tangled, insecure, unmaintainable codebase. Given precise specifications, a clear architectural target, and a developer who reviews every change and rejects whatever doesn't meet the bar, it produces clean, well-structured, secure code just as happily. The tool amplifies the developer's judgment; it does not replace it. Besides, in AI era, if you don't use AI in day to day work, you will simply be out of the game no matter how skilled you are, because it writes code up to 10x faster. I am myself fan of manually written code, but given the situation in which we are, it simply has to be the daily part of the every workflow. 

Also, I would not be able to make this if I did not have a notion and knowledge of:
-React
-Typescript,
-Express & Express router
-How the JWT token works
-How the http only cookie works
-How the interceptor works
-How database works and relations between tables
-Middleware
-How the axios works
-How to prevent sql query from an SQL injection
-How REST API works
-DRY principles
-Separation of concerns
-Code Reusability

### Demo

The application walkthrough is recorded in three parts:

**Part 1 - Authentication & Today dashboard**
https://github.com/user-attachments/assets/0f2c4353-8e9f-4ab1-8714-6682d4a7dd74



**Part 2 - Creating, editing, completing & overdue behavior**

https://github.com/user-attachments/assets/d95338ba-240b-4bec-ae26-45931ad40ebf

**Part 3 - Upcoming, All Tasks (search & filters), Archive & Settings**

https://github.com/user-attachments/assets/c7160e64-6d9c-4edd-8a6c-2dce64eceebd



### Core Business Logic

- **Task lifecycle:** A task is created with a title, optional description, due date, and priority (`low` / `medium` / `high`). It starts as `pending` and can be marked `completed` (which stamps `completed_at`) or reverted back to `pending`.
- **Persistent overdue behavior (the core feature):** A task **never disappears** just because its due date has passed. If it is still `pending` after its due date, it resurfaces in the **Overdue** section every single day - showing its original due date and how many days it is overdue - until the user completes it. This solves the main weakness of spreadsheets: obligations silently falling out of view.
- **Local-date awareness:** "Today" is always determined from the **user's local date**, not the server's UTC clock, so a task can never appear on the wrong day due to a timezone offset.
- **Soft delete:** Deleting a task never removes the row. It sets an `is_deleted` flag and hides the task from the UI, while keeping it available in a read-only **Archive**, from which it can be restored.
- **Strict data isolation:** Every task belongs to exactly one user. All queries are scoped to the authenticated user's id (derived from the session cookie, never from the client), so a user can never read or modify another user's data.

### Feature Summary

- **Today dashboard** - the primary screen: today's date, summary counters (Overdue / Today / Completed), and three sections - Overdue, Today, and Completed Today.
- **Add / Edit task** - full create and update of title, description, due date, priority, and status.
- **Complete / Uncomplete** - one-click completion with the option to reopen a task.
- **Upcoming** - future pending tasks grouped by date.
- **All Tasks** - the full list, sorted by due date, with search-by-title and filters by status, priority, and date, plus a reset action.
- **Archive** - soft-deleted tasks, with restore.
- **Settings** - dark-mode toggle, basic profile info, and logout.

---




## 4. Architecture

### Backend - Layered

The API follows a conventional layered structure, keeping request handling, business logic, and data access separated:

```
Request → Route → Middleware (auth / validation) → Controller (raw SQL) → SQL Server
```

- **config/** - a singleton connection pool. The pool is created once on startup and reused for every request (it is never opened/closed per query).
- **middleware/** - `protect` (reads and verifies the JWT cookie, loads the user), `asyncHandler`, `notFound`, and a central `errorHandler`.
- **controllers/** - one handler per operation, using parameterized `mssql` queries.
- **routes/** - thin Express routers grouped by domain (`auth`, `tasks`).
- **utils/** - `generateToken` (signs the JWT and sets the httpOnly cookie).
- **validation/** - Zod schemas for auth and task payloads.

### Frontend - Feature-Sliced Design (FSD)

Each feature (`auth`, `tasks`) owns a self-contained slice with its own `api/`, `components/`, `hooks/`, `models/`, `pages/`, and `utils/`, each exposed via barrel files. Cross-cutting concerns live outside features: a shared Axios client, global UI components, the router, the `AuthGuard`, and Zustand stores. API calls run through custom hooks that manage loading/error state and cancel in-flight requests on unmount via `AbortController`.

### Authentication Flow

Authentication is entirely cookie-based - there is **no token in localStorage**, no Authorization header, and no client-readable token.

1. On signup/login, the server hashes/verifies the password with **bcrypt**, signs a JWT, and returns it in an **httpOnly cookie**.
2. The Axios client sends requests with `withCredentials: true`, so the cookie travels automatically.
3. `AuthGuard` determines authentication by calling `GET /api/auth/me`; a valid cookie returns the current user, otherwise it redirects to login.
4. Logout clears the cookie server-side.

### How "Today" and "Overdue" Are Computed

The client computes the user's local date (`YYYY-MM-DD`) and passes it to the dashboard and upcoming endpoints. Because `due_date` is stored as a pure `DATE` (no time component), the backend classifies tasks with clean date comparisons:

- **Overdue** - `due_date < @today AND status = 'pending'`
- **Today** - `due_date = @today AND status = 'pending'`
- **Completed today** - `status = 'completed' AND CAST(completed_at AS DATE) = @today`

All queries additionally require `is_deleted = 0` and `user_id = @user_id`.

---

## 5. Data Model

Two tables, using `UNIQUEIDENTIFIER` UUIDs, `CHECK` constraints for enums, soft delete, and indexes on the columns the dashboard filters by.

### `profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | `UNIQUEIDENTIFIER` | PK, `DEFAULT NEWID()` |
| `first_name` | `VARCHAR(100)` | |
| `last_name` | `VARCHAR(100)` | |
| `email` | `VARCHAR(255)` | Unique |
| `password` | `VARCHAR(255)` | bcrypt hash |
| `created_at` | `DATETIME2` | `DEFAULT SYSUTCDATETIME()` |

### `tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | `UNIQUEIDENTIFIER` | PK, `DEFAULT NEWID()` |
| `user_id` | `UNIQUEIDENTIFIER` | FK → `profiles(id)` |
| `title` | `VARCHAR(255)` | Required |
| `description` | `VARCHAR(MAX)` | Nullable |
| `due_date` | `DATE` | Date only - avoids timezone drift |
| `priority` | `VARCHAR(10)` | `CHECK (low / medium / high)` |
| `status` | `VARCHAR(10)` | `CHECK (pending / completed)` |
| `is_deleted` | `BIT` | Soft delete, `DEFAULT 0` |
| `completed_at` | `DATETIME2` | Nullable |
| `created_at` | `DATETIME2` | `DEFAULT SYSUTCDATETIME()` |
| `updated_at` | `DATETIME2` | `DEFAULT SYSUTCDATETIME()` |

**Indexes:** `user_id`, `due_date`, `status`, and a composite `(user_id, is_deleted, status, due_date)` covering the dashboard's most frequent query.

The full schema and seed data are provided in `schema-seed.sql`.

---

## 6. API Documentation

> **Base URL (development):** `http://localhost:5000/api`
> In the browser, the frontend calls `/api/...` and Vite proxies it to the backend, keeping requests same-origin so the httpOnly cookie is sent. For manual testing (e.g. Postman), call the backend directly and enable cookie handling.

### 6.1 Auth

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/auth/signup` | `POST` | Public | Register a new user, hash the password, set the JWT cookie |
| `/auth/login` | `POST` | Public | Authenticate credentials, set the JWT cookie |
| `/auth/logout` | `POST` | Private | Clear the JWT cookie |
| `/auth/me` | `GET` | Private | Return the current authenticated user (used by `AuthGuard`) |

### 6.2 Tasks

All task endpoints are **Private** (require a valid JWT cookie) and are scoped to the authenticated user.

| Endpoint | Method | Description |
|---|---|---|
| `/tasks/dashboard?today=YYYY-MM-DD` | `GET` | Overdue, Today, and Completed-Today buckets for the given local date |
| `/tasks/upcoming?today=YYYY-MM-DD` | `GET` | Future pending tasks, grouped by date |
| `/tasks` | `GET` | All non-deleted tasks (client applies search/filter/sort) |
| `/tasks/archive` | `GET` | All soft-deleted tasks |
| `/tasks` | `POST` | Create a task |
| `/tasks/:id` | `PUT` | Edit title, description, due date, priority, status |
| `/tasks/:id/complete` | `PATCH` | Mark completed and stamp `completed_at` |
| `/tasks/:id/uncomplete` | `PATCH` | Revert to pending and clear `completed_at` |
| `/tasks/:id` | `DELETE` | Soft delete (`is_deleted = 1`) |
| `/tasks/:id/restore` | `PATCH` | Restore a task from the archive |

---



## 7. Security Notes

- Passwords are hashed with **bcrypt**; plaintext passwords are never stored or returned.
- The JWT lives in an **httpOnly cookie**, so it is inaccessible to client-side JavaScript, reducing XSS token-theft risk.
- `user_id` is always taken from the verified session - **never** trusted from the request body.
- All SQL is **parameterized**, preventing SQL injection.
- Input is validated with **Zod on both the client and the server**.
- Secrets are supplied via environment variables and kept out of version control.



https://github.com/user-attachments/assets/cb8565fd-11d7-417a-81ea-661ae7ab6a96

