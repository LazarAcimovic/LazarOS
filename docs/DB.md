# DB

> PostgreSQL, accessed through **Prisma** — the generated client, with the computed dashboard via
> parameterized `$queryRaw` — over the `pg` driver with an env-driven `DATABASE_URL`. The datamodel
> is `prisma/schema.prisma` and schema changes are owned by Prisma Migrate (ORM + migrations: D-018;
> engine switch: D-016; migrations: §5).

## 1. ER overview

Two tables.

- `profiles` — one row per user. The identity root.
- `tasks` — one row per task, each owned by exactly one `profiles` row via `FK_tasks_profiles`.

Everything is scoped per user via `tasks.user_id`; there is no tenant or org concept above the
user.

## 2. Tables

### 2.1 `profiles`

Defined in `prisma/schema.prisma` (applied by migration `0_init`).

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

Defined in `prisma/schema.prisma` (applied by migration `0_init`).

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

Defined in `prisma/schema.prisma` (applied by migration `0_init`).

| Index | Columns | Purpose |
|---|---|---|
| `IX_tasks_user_id` | `(user_id)` | Per-user lookups |
| `IX_tasks_due_date` | `(due_date)` | Date filtering |
| `IX_tasks_status` | `(status)` | Status filtering |
| `IX_tasks_user_active` | `(user_id, is_deleted, status, due_date)` | Covers the dashboard query ([taskController.js:21-47](../backend/controllers/taskController.js)) |

## 3. Relationships and delete behaviour

- `tasks.user_id → profiles.id` — foreign key, no cascade declared. Deleting a profile would
  fail with a FK violation if any task rows exist; there is no API path that deletes a profile.
- **Hard delete is never performed.** `DELETE /api/tasks/:id` sets `is_deleted = true`
  ([taskController.js:239-241](../backend/controllers/taskController.js)); the row is kept
  forever. Restore clears the flag ([taskController.js:264-265](../backend/controllers/taskController.js)).

## 4. Seed data

The demo seed is a Prisma seed script (`prisma/seed.mjs`), run with `node prisma/seed.mjs` after
`prisma migrate deploy` against a fresh database:

- One `profiles` row: `lazar@lazaros.dev` / `Password123!` (bcrypt hash in the seed script), with
  id `11111111-1111-1111-1111-111111111111`.
- Twenty `tasks` rows anchored to the current date — five today, five on each of the next three days.

The seed is date-anchored, so re-running it reproduces the same dashboard experience on any date. It
is a one-shot setup for a fresh dev database, not a per-test fixture (the suites seed their own rows)
and **not** the real-data cutover — preserving the live rows is a separate procedure (DB §7, D-015).

## 5. Migrations

`prisma/schema.prisma` is the **single source of truth** for the schema (code-first, D-019), and
**Prisma Migrate** owns changes (`prisma` `7.10.1`, D-018). The loop is: edit the datamodel →
`prisma migrate dev` writes a timestamped SQL migration under `prisma/migrations/` → `prisma migrate
deploy` replays those migrations verbatim on any database. Incremental and non-destructive, unlike
the old drop-and-recreate.

The existing Postgres schema (D-016) was adopted **without data loss** by *baselining*
(`refactor-05`): `prisma db pull` introspected it into the datamodel, then the baseline migration
(`0_init`) was generated with `prisma migrate diff` and marked already-applied with
`prisma migrate resolve --applied`, so Prisma never drops or recreates the live tables. Prisma does
not model `CHECK` constraints, so `0_init` recreates the two on `tasks` by hand (D-018).

**One schema source everywhere.** The backend integration suites and the e2e runner reset their
databases by applying those same migrations — the backend via `tests/setup/resetSchema.js` in each
`beforeAll`, the e2e runner in [frontend/e2e/run-e2e.mjs](../frontend/e2e/run-e2e.mjs) — against the
separate `LazarOS_Test` / `LazarOS_E2E` databases (Tech-Backend §9, Tech-Frontend §9), never the dev
database. A fresh dev database is built with `prisma migrate deploy` and then seeded (§4).

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
| Future pending | `pending` | `>` | — | excluded by `due_date <= $2::date` |
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
- **Timestamps** — `created_at`, `updated_at`, `completed_at` carried to **microsecond**
  precision: the maximum a PostgreSQL `timestamptz` column (§2) stores and the maximum both
  engines share. SQL Server `DATETIME2(7)` holds a 100-ns (7th) fractional digit that a
  `timestamptz` cannot store, so the portable export's parity checksum operates at microsecond
  precision, rounded half-to-even on the 100-ns tick exactly as the `timestamptz` cast rounds
  (§7.3). The untouched native `.bak` (§7.2) keeps the original 100-ns values, so nothing is lost
  from the record; only the Postgres target and its parity proof are bounded by what `timestamptz`
  can physically hold. No truncation to seconds or milliseconds. (per D-017)
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
- **Value rendering.** Timestamps as ISO-8601 at **microsecond** precision —
  `YYYY-MM-DDTHH:MM:SS.ffffff`, UTC wall-clock, no offset — rounded half-to-even on the 100-ns
  tick, which is exactly what a PostgreSQL `timestamptz` cast produces (§7.1, D-017). SQL Server's
  native style-126 value carries a 7th fractional digit; the canonical form drops it to the shared
  microsecond precision so the *identical* string is reproducible on both engines. `DATE` as
  `YYYY-MM-DD`; `UNIQUEIDENTIFIER`/`uuid` lowercased 36-char; `BIT`/`boolean` as `0`/`1`; text
  columns verbatim.
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

A backup captured before this microsecond canonicalization (D-017) carries native 100-ns
checksums; its manifest is regenerated to microsecond precision **from the existing CSVs**,
deterministically and with no live SQL Server, before reconcile. The regeneration and the import
step both live in Tech §2; the shared canonical-form code is the single definition both the export
and the reconcile use, so the three never drift.

### 7.4 Reconciliation — the cutover proof

[`backend/scripts/reconcile-postgres-data.mjs`](../backend/scripts/reconcile-postgres-data.mjs) is
the one-off proof that the loaded Postgres data equals the backup (run from `backend` as
`DATABASE_URL=<postgres url> node scripts/reconcile-postgres-data.mjs [backup-dir]`; it exits
non-zero on any mismatch). It is not part of the permanent suite. It asserts, in order:

1. **Row counts** — `profiles` and `tasks` each equal the manifest.
2. **Content checksums** — the checksum recomputed from the loaded Postgres rows, and the one
   recomputed from the CSVs, each equal the manifest's, table by table, plus the `overallChecksum`
   (§7.3). Zero rows added, dropped or altered.
3. **A field-by-field spot-check** of one known profile and all of its tasks across both engines.
4. **Behavioural parity** — for every date present in the data, the Today dashboard buckets
   (overdue / today / completed-today, with `days_overdue`) and the Archive for a real preserved
   user match what the backup data implies (PRD §4.7, §4.8, §4.11) — proving the data behaves
   identically, not merely that it copied.

The reconcile recomputes the canonical form through the shared `canonical.mjs`, the same definition
the manifest was built with; the manifest's microsecond checksums remain the recorded source of
truth (§7.3).
