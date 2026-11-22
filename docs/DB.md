# DB

> Microsoft SQL Server, accessed through the `mssql`/`msnodesqlv8` driver. Raw parameterized
> T-SQL, no ORM. Schema and seed in one file (`backend/db/schema.sql`), applied by running the
> script once against a SQL Server instance.

## 1. ER overview

Two tables.

- `profiles` — one row per user. The identity root.
- `tasks` — one row per task, each owned by exactly one `profiles` row via `FK_tasks_profiles`.

Everything is scoped per user via `tasks.user_id`; there is no tenant or org concept above the
user.

## 2. Tables

### 2.1 `profiles`

Defined in [backend/db/schema.sql:21-28](../backend/db/schema.sql).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `UNIQUEIDENTIFIER` | NO | `NEWID()` | PK |
| `first_name` | `VARCHAR(100)` | NO | — | |
| `last_name` | `VARCHAR(100)` | NO | — | |
| `email` | `VARCHAR(255)` | NO | — | `UNIQUE` |
| `password` | `VARCHAR(255)` | NO | — | bcrypt hash (cost 10, see PRD §6) |
| `created_at` | `DATETIME2` | NO | `SYSUTCDATETIME()` | UTC |

Constraints: `PK(id)`, `UNIQUE(email)`.

### 2.2 `tasks`

Defined in [backend/db/schema.sql:32-47](../backend/db/schema.sql).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `UNIQUEIDENTIFIER` | NO | `NEWID()` | PK |
| `user_id` | `UNIQUEIDENTIFIER` | NO | — | FK → `profiles(id)` |
| `title` | `VARCHAR(255)` | NO | — | API caps at 255 (PRD §6) |
| `description` | `VARCHAR(MAX)` | YES | — | API caps at 4000 (PRD §6; see Decisions D-005) |
| `due_date` | `DATE` | NO | — | Date only, no time component (PRD §5) |
| `priority` | `VARCHAR(10)` | NO | `'medium'` | `CHECK (priority IN ('low','medium','high'))` |
| `status` | `VARCHAR(10)` | NO | `'pending'` | `CHECK (status IN ('pending','completed'))` |
| `is_deleted` | `BIT` | NO | `0` | Soft-delete flag |
| `completed_at` | `DATETIME2` | YES | — | Stamped UTC when `status` moves pending→completed |
| `created_at` | `DATETIME2` | NO | `SYSUTCDATETIME()` | UTC |
| `updated_at` | `DATETIME2` | NO | `SYSUTCDATETIME()` | UTC; updated by every write ([taskController.js:196](../backend/controllers/taskController.js)) |

Constraints: `PK(id)`, `FK_tasks_profiles FOREIGN KEY(user_id) REFERENCES profiles(id)`,
`CHECK(priority IN (...))`, `CHECK(status IN (...))`.

### 2.3 Indexes on `tasks`

Defined in [backend/db/schema.sql:51-54](../backend/db/schema.sql).

| Index | Columns | Purpose |
|---|---|---|
| `IX_tasks_user_id` | `(user_id)` | Per-user lookups |
| `IX_tasks_due_date` | `(due_date)` | Date filtering |
| `IX_tasks_status` | `(status)` | Status filtering |
| `IX_tasks_user_active` | `(user_id, is_deleted, status, due_date)` | Covers the dashboard query ([taskController.js:21-47](../backend/controllers/taskController.js)) |

## 3. Relationships and delete behaviour

- `tasks.user_id → profiles.id` — foreign key, no cascade declared. Deleting a profile would
  fail with a FK violation if any task rows exist; there is no API path that deletes a profile.
- **Hard delete is never performed.** `DELETE /api/tasks/:id` sets `is_deleted = 1`
  ([taskController.js:239-241](../backend/controllers/taskController.js)); the row is kept
  forever. Restore clears the flag ([taskController.js:264-265](../backend/controllers/taskController.js)).

## 4. Seed data

`backend/db/schema.sql:60-102` inserts one profile and twenty tasks:

- One `profiles` row: `lazar@lazaros.dev` / `Password123!` (bcrypt hash hardcoded in
  [schema.sql:70](../backend/db/schema.sql)), with id `11111111-1111-1111-1111-111111111111`.
- Twenty `tasks` rows seeded relative to `GETDATE()` — five on today, five on each of the
  three following days.

The seed is time-sensitive (`DATEADD(DAY, N, @today)`), so re-running it reproduces the same
dashboard experience on any date. It is intended as a one-shot setup script, not as a per-test
fixture.

## 5. Migrations

There is no migrations framework. The entire schema and seed live in one file
(`backend/db/schema.sql`) that drops and recreates tables; see the `IF OBJECT_ID(...) DROP TABLE`
guards on [schema.sql:16-17](../backend/db/schema.sql). This is listed as a known refactor
candidate in `docs/refactors/active/index.md` (campaign `refactor-01`).

## 6. Query cheat-sheet

The dashboard query is the hottest path. From [taskController.js:21-47](../backend/controllers/taskController.js):

```sql
SELECT id, title, description, due_date, priority, status,
       completed_at, created_at, updated_at,
       CASE
         WHEN status = 'pending'   AND due_date <  @today THEN 'overdue'
         WHEN status = 'pending'   AND due_date =  @today THEN 'today'
         WHEN status = 'completed' AND CAST(completed_at AS DATE) = @today THEN 'completed_today'
         ELSE 'other'
       END AS section,
       DATEDIFF(DAY, due_date, @today) AS days_overdue
FROM tasks
WHERE user_id = @user_id
  AND is_deleted = 0
  AND (
    (status = 'pending'   AND due_date <= @today)
    OR
    (status = 'completed' AND CAST(completed_at AS DATE) = @today)
  )
```

Case table — one row per state the query must classify:

| Row state | `status` | `due_date` vs `@today` | `completed_at::date` vs `@today` | Falls in |
|---|---|---|---|---|
| Overdue pending | `pending` | `<` | — | `overdue` |
| Due today | `pending` | `=` | — | `today` |
| Future pending | `pending` | `>` | — | excluded by `due_date <= @today` |
| Completed today | `completed` | any | `=` | `completed_today` |
| Completed earlier | `completed` | any | `<` | excluded |
| Completed later day | `completed` | any | `>` | excluded (would not occur in practice) |

**Every query that touches `tasks` additionally filters by `user_id = @user_id` and (except
archive/restore) `is_deleted = 0`.** That pair is the data-isolation invariant (PRD §6).
