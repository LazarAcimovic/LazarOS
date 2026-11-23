# DB

> PostgreSQL, accessed through the `pg` driver with an env-driven `DATABASE_URL`. Raw
> parameterized SQL, no ORM. Schema and seed in one file (`backend/db/schema.sql`), applied by
> running the script once against a PostgreSQL database (the engine switch is D-016).

## 1. ER overview

Two tables.

- `profiles` — one row per user. The identity root.
- `tasks` — one row per task, each owned by exactly one `profiles` row via `FK_tasks_profiles`.

Everything is scoped per user via `tasks.user_id`; there is no tenant or org concept above the
user.

## 2. Tables

### 2.1 `profiles`

Defined in [backend/db/schema.sql](../backend/db/schema.sql).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `first_name` | `varchar(100)` | NO | — | |
| `last_name` | `varchar(100)` | NO | — | |
| `email` | `varchar(255)` | NO | — | `UNIQUE` |
| `password` | `varchar(255)` | NO | — | bcrypt hash (cost 10, see PRD §6) |
| `created_at` | `timestamptz` | NO | `now() at time zone 'utc'` | UTC |

Constraints: `PK(id)`, `UNIQUE(email)`.

### 2.2 `tasks`

Defined in [backend/db/schema.sql](../backend/db/schema.sql).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NO | — | FK → `profiles(id)` |
| `title` | `varchar(255)` | NO | — | API caps at 255 (PRD §6) |
| `description` | `text` | YES | — | API caps at 4000 (PRD §6; see Decisions D-005) |
| `due_date` | `date` | NO | — | Date only, no time component (PRD §5) |
| `priority` | `varchar(10)` | NO | `'medium'` | `CHECK (priority IN ('low','medium','high'))` |
| `status` | `varchar(10)` | NO | `'pending'` | `CHECK (status IN ('pending','completed'))` |
| `is_deleted` | `boolean` | NO | `false` | Soft-delete flag |
| `completed_at` | `timestamptz` | YES | — | Stamped UTC when `status` moves pending→completed |
| `created_at` | `timestamptz` | NO | `now() at time zone 'utc'` | UTC |
| `updated_at` | `timestamptz` | NO | `now() at time zone 'utc'` | UTC; updated by every write ([taskController.js](../backend/controllers/taskController.js)) |

Constraints: `PK(id)`, `FK_tasks_profiles FOREIGN KEY(user_id) REFERENCES profiles(id)`,
`CHECK(priority IN (...))`, `CHECK(status IN (...))`.

### 2.3 Indexes on `tasks`

Defined in [backend/db/schema.sql](../backend/db/schema.sql).

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

`backend/db/schema.sql` inserts one profile and twenty tasks after the drop-recreate:

- One `profiles` row: `lazar@lazaros.dev` / `Password123!` (bcrypt hash hardcoded in
  `backend/db/schema.sql`), with id `11111111-1111-1111-1111-111111111111`.
- Twenty `tasks` rows anchored to `current_date` — five on today, five on each of the three
  following days.

The seed is date-anchored (`current_date + make_interval(days => N)`), so re-running it
reproduces the same dashboard experience on any date. It is a one-shot setup script for fresh
dev and test databases, not a per-test fixture. It is **not** the real-data cutover — preserving
the live rows is a separate procedure (DB §7, D-015).

## 5. Migrations

There is no migrations framework. The entire schema and seed live in one file
(`backend/db/schema.sql`) that drops and recreates tables; see the
`DROP TABLE IF EXISTS … CASCADE` guards in `backend/db/schema.sql` (`tasks` before `profiles`,
so the foreign key does not block the drop). Replacing this with a real migration tool is a
separate, tracked concern.

## 6. Query cheat-sheet

The dashboard query is the hottest path. From [taskController.js](../backend/controllers/taskController.js)
(`$1` = `user_id`, `$2` = the client's `today`):

```sql
SELECT id, title, description, due_date, priority, status,
       completed_at, created_at, updated_at,
       CASE
         WHEN status = 'pending'   AND due_date <  $2::date THEN 'overdue'
         WHEN status = 'pending'   AND due_date =  $2::date THEN 'today'
         WHEN status = 'completed' AND (completed_at AT TIME ZONE 'utc')::date = $2::date THEN 'completed_today'
         ELSE 'other'
       END AS section,
       ($2::date - due_date) AS days_overdue
FROM tasks
WHERE user_id = $1
  AND is_deleted = false
  AND (
    (status = 'pending'   AND due_date <= $2::date)
    OR
    (status = 'completed' AND (completed_at AT TIME ZONE 'utc')::date = $2::date)
  )
```

`days_overdue` is plain `date` subtraction, which yields an integer number of days (`0` for a
task due today, positive once it is overdue). `completed_at` is a `timestamptz`; converting it
`AT TIME ZONE 'utc'` before `::date` takes its UTC calendar date, matching the stored
UTC wall clock (Tech-Backend §8).

Case table — one row per state the query must classify:

| Row state | `status` | `due_date` vs `$2` | `(completed_at AT TIME ZONE 'utc')::date` vs `$2` | Falls in |
|---|---|---|---|---|
| Overdue pending | `pending` | `<` | — | `overdue` |
| Due today | `pending` | `=` | — | `today` |
| Future pending | `pending` | `>` | — | excluded by `due_date <= @today` |
| Completed today | `completed` | any | `=` | `completed_today` |
| Completed earlier | `completed` | any | `<` | excluded |
| Completed later day | `completed` | any | `>` | excluded (would not occur in practice) |

**Every query that touches `tasks` additionally filters by `user_id = $n` and (except
archive/restore) `is_deleted = false`.** That pair is the data-isolation invariant (PRD §6).

## 7. Data preservation across the engine migration

The engine migration (campaign `refactor-04`) ports the schema and the demo seed from SQL Server
to PostgreSQL but deliberately does **not** carry the live rows. Preserving the real data is a
separate, auditable procedure, decided in D-015. This section is its home.

### 7.1 What "preserved" means

Preservation is **complete and faithful**: every row of `profiles` and `tasks` is carried across
exactly as stored, with nothing filtered, de-duplicated, re-ordered in meaning, or altered. In
particular the migration must keep:

- **Soft-deleted rows** — `tasks` with `is_deleted = 1` are data, not garbage; they are the
  user's Archive (§3, PRD §4.11) and are carried like any other row.
- **`completed_at`** — including its `NULL` for never-completed tasks, distinct from an empty
  value.
- **Exact timestamps** — `created_at`, `updated_at`, `completed_at` to their full stored
  `DATETIME2(7)` precision; no truncation to seconds or milliseconds.
- **bcrypt hashes** — `profiles.password` is copied byte-for-byte; it is never re-hashed,
  trimmed or re-encoded, or every user's login breaks.
- **GUID identities** — `id` and `tasks.user_id` keep their exact values so the foreign-key
  relationships and any external references stay valid.

### 7.2 Procedure — backup, load, reconcile

1. **Backup (before `refactor-04` touches anything).** Take a native SQL Server `.bak` of
   `LazarOS` — the untouched safety copy you can always restore to — **and** a portable,
   engine-neutral export (per-table CSV) of every `profiles` and `tasks` row, all columns, nulls
   and soft-deleted rows included. Record a **manifest** (§7.3). Artifacts live outside the repo
   because they contain real personal data and bcrypt hashes; their location and the script that
   reproduces them are documented in Tech §2.
2. **Load (after `refactor-04` R04.3 created the Postgres schema).** Insert the exported rows
   into the migrated schema with identity-insert semantics — same `id`s, same timestamps, same
   `is_deleted`. The demo seed (`refactor-04` R04.5) is for fresh and test databases only and is
   not involved in the real-data cutover.
3. **Reconcile.** Re-run the parity test (§7.3) against the loaded Postgres data and prove it
   equals the manifest, table by table, before the cutover is considered done.

### 7.3 Parity test — counts plus a content checksum

Parity is proven two ways, both recorded in the manifest and both reproducible on either engine:

- **Per-table row counts** — `profiles` and `tasks` each match exactly.
- **A deterministic content checksum** — an ordered hash over *all* rows, so a single changed
  byte in any field fails the check even when the counts agree.

**Checksum definition (must be reproduced identically in Postgres during reconcile).**

- **Row order.** Sort rows by the lowercased 36-character string form of the primary key `id`
  (engine-neutral: `LOWER(CONVERT(char(36), id))` in SQL Server, `lower(id::text)` in Postgres).
- **Field encoding.** For each column, in the fixed order below, emit one token: `N` for a SQL
  `NULL`, otherwise `V` + the UTF-8 byte length of the value + `:` + the value. Length-prefixing
  makes the stream unambiguous regardless of commas, quotes or newlines inside a value, and keeps
  `NULL` distinct from the empty string.
- **Value rendering.** `DATETIME2` as ISO-8601 to full stored precision (SQL Server style 126,
  e.g. `2026-11-22T08:30:15.1234567`); `DATE` as `YYYY-MM-DD`; `UNIQUEIDENTIFIER` lowercased;
  `BIT` as `0`/`1`; text columns verbatim.
- **Hash.** Terminate each row with `\n`, feed the whole byte stream into one **SHA-256** hash;
  the hex digest is the table checksum. The manifest's `overallChecksum` is the SHA-256 of
  `profiles:<count>:<checksum>\ntasks:<count>:<checksum>\n`.

Fixed column order for the checksum:

- `profiles`: `id, first_name, last_name, email, password, created_at`
- `tasks`: `id, user_id, title, description, due_date, priority, status, is_deleted, completed_at, created_at, updated_at`

The manifest produced by the backup is the **source of truth for reconciliation**: records
`generatedAt`, the source server/database, `checksumAlgorithm` (`SHA-256`), the canonical-form
description, and for each table its `rowCount`, column list and `checksum`, plus the
`overallChecksum`. Reconciliation passes only when the Postgres figures equal it exactly.
