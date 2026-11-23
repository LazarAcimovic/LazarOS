### Task 6 — Preserve the SQL Server data across the migration

#### Overview

The live `LazarOS` SQL Server database holds real data. `refactor-04` ports the **schema and the
demo seed** to PostgreSQL but deliberately does not carry the existing rows — so without this task
the migration would land an empty (or demo-only) database and the real `profiles`/`tasks` would be
lost. This task makes a complete, verifiable **backup** of the SQL Server data, loads it into the
migrated Postgres schema, and **reconciles** the two row-for-row so that absolutely nothing is
missing: every profile and every task, including soft-deleted rows, `completed_at` stamps, exact
timestamps and the bcrypt hashes.

**Ordering is the whole point.** Subtask 6.1 (the backup) must run **before** `refactor-04` changes
anything — it is the untouched safety copy you can always restore to. Subtasks 6.2–6.3 (load +
reconcile) run **after** `refactor-04`'s schema exists (R04.3). The demo seed (`refactor-04` R04.5)
is for fresh and test databases; this task is the real-data cutover and does not touch it.

**The rules for this task live in `DB.md`** (a new "Data preservation across the engine migration"
section, written in 6.0) and `Tech.md` §2. This file is only the plan — read the rules from those
sections, never from this Overview.

**Depends on:** nothing for the backup; `refactor-04` for the load/reconcile (see the subtask
`Depends on:` lines) · **Blocks:** nothing, but capture 6.1 before `refactor-04` begins

---

#### 6.0 — Docs: Define the backup, load and reconcile procedure

Rules: none (this subtask creates the rules' home)
Not in scope: any export, load or code — only documenting the procedure and the parity criteria.
Docs to update: DB.md (a new "Data preservation across the engine migration" section — what
"complete" means, the backup/load/reconcile steps, the parity criteria), Tech.md §2 (where the
backup artifacts live and how to reproduce them), Decisions D-0NN (the cutover approach: keep the
native `.bak` as the untouched safety copy, migrate via a portable export, prove parity by counts
plus a content checksum).
Verify: `node scripts/check-docs.mjs`

- [x] DB.md states that preservation means **every** row of `profiles` and `tasks` — soft-deleted
      (`is_deleted = 1`) rows, `completed_at`, exact timestamps and bcrypt hashes included —
      carried faithfully, nothing filtered or altered.
- [x] The backup → load → reconcile steps and the parity test (per-table counts + a deterministic
      content checksum) are written down; a Decisions entry records the approach.
- Commit: `docs: define the SQL Server → Postgres data-preservation procedure`

---

#### 6.1 — DevOps: Capture a complete, verifiable backup of the live SQL Server data

Depends on: nothing — run this before `refactor-04` changes the database.
Rules: DB §1, DB §2
Not in scope: loading anything into Postgres (6.2). Filtering, de-duplicating or transforming rows
— the backup is faithful and complete.
Docs to update: Tech.md §2 (the backup artifacts and how they were produced).
Verify: the native `.bak` restores cleanly to a scratch SQL Server database; the portable export's
row counts equal the live `profiles`/`tasks` counts; the manifest records per-table counts and a
content checksum.

- [x] A native SQL Server backup (`.bak`) of `LazarOS` is taken and stored **outside the repo** —
      the untouched safety copy that can always be restored if the migration goes wrong.
- [x] A portable, engine-neutral export (per-table CSV/JSON or `INSERT` statements) of every
      `profiles` and `tasks` row — all columns, nulls and soft-deleted rows included.
- [x] A manifest records each table's exact row count and a deterministic content checksum (an
      ordered hash over all rows) as the source of truth for reconciliation.
- Commit: `chore(db): complete verifiable backup of the SQL Server data`

---

#### 6.2 — DevOps: Load the preserved data into PostgreSQL

Depends on: refactor-04 (the Postgres schema must exist — R04.3).
Rules: DB §2, PRD §6
Not in scope: the demo seed (`refactor-04` R04.5, for fresh/test databases). Changing any value
beyond the documented type conversions.
Docs to update: Tech.md §2 (the import step).
Verify: after loading into the migrated schema, Postgres `profiles`/`tasks` counts equal the 6.1
manifest, and logging in with a real preserved account succeeds.

- [x] An idempotent import loads the 6.1 export into the Postgres `profiles` + `tasks` tables,
      applying only the documented type conversions (`uniqueidentifier`→`uuid`, `datetime2`→
      `timestamptz`, `bit`→`boolean`, `VARCHAR(MAX)`→`text`) — values unchanged.
- [x] Insert order respects the foreign key (`profiles` before `tasks`); `is_deleted` and
      `completed_at` are preserved exactly.
- [x] Re-running the import keys on the original ids and never duplicates rows.
- Commit: `feat(db): load the preserved SQL Server data into Postgres`

---

#### 6.3 — Backend-migration: Reconcile Postgres against the backup manifest

Depends on: refactor-04.
Rules: DB §2, PRD §4.7, PRD §4.8
Not in scope: folding this into the permanent suite — `refactor-03` owns ongoing tests; this is the
one-off cutover proof.
Docs to update: DB.md (record the reconciliation result in the preservation section).
Verify: per-table counts and the content checksum match the 6.1 manifest exactly; a known profile
(email + hash) and its tasks reconcile field-by-field across engines; the Today dashboard for a
real preserved user shows the same rows it did on SQL Server.

- [x] Postgres per-table counts and content checksums equal the 6.1 manifest — zero rows added,
      dropped or altered.
- [x] A spot-check reconciles a known profile and its tasks field-by-field across both engines.
- [x] The dashboard and archive for a real preserved user match the pre-migration output
      (PRD §4.7, §4.8), proving the data behaves identically, not just that it copied.
- Commit: `test(db): reconcile migrated Postgres data against the backup`
