### Refactor 04 — Migrate the database from SQL Server to PostgreSQL

#### Overview

The backend talks to SQL Server through the `mssql`/`msnodesqlv8` native Windows driver, with a
connection string hardcoded to one machine (DB §1, Tech.md §2, Decisions D-010). This campaign
replaces the engine with PostgreSQL: the `pg` driver with an env-driven `DATABASE_URL`, a
Postgres port of the drop-recreate schema and seed, and a port of every raw query (T-SQL →
Postgres SQL). **The API contract and every product rule stay identical** — the behaviour suite
from `refactor-03` is the proof, and it must stay green through each subtask. This campaign does
**not** introduce an ORM; that is `refactor-05`, which lands on top of this.

> This campaign moves the connection to env-driven config as a side effect of swapping drivers,
> which overlaps `task-03` (env-driven DB config). Treat `task-03` as subsumed for Postgres —
> close or re-point it when R04.2 lands, rather than doing the mssql version first.

**The target schema lives in `DB.md`; the driver and tooling in `Tech.md` §2 and
`Tech-Backend.md`.** This file is only the plan. **No behaviour changes** — a SQL rewrite that
alters a result is a defect, caught by the suite.

**Depends on:** refactor-03 · **Blocks:** refactor-05

#### Baseline — captured before step one

| Measure | Before | After (fill in at the end) |
|---|---|---|
| database engine | SQL Server (`mssql`/`msnodesqlv8`) | |
| connection | hardcoded, Windows auth (D-010) | |
| `cd backend && npm test` | green on SQL Server | |
| `npm run test:e2e` | green on SQL Server | |
| schema source | `backend/db/schema.sql` (T-SQL) | |

#### Out of scope

- **No ORM.** Prisma is `refactor-05`; this campaign keeps raw parameterized SQL, now Postgres
  dialect.
- **No API or product-rule change.** Routes, payloads, status codes and the dashboard semantics
  are frozen by the `refactor-03` suite.
- **No new tables or columns.** The schema is ported one-for-one; the reset-token table is
  `task-05`.
- **No change to the time model.** `due_date` stays a pure date, server timestamps stay UTC,
  "today" stays the client-supplied param (PRD §4.7, Tech-Backend §8).
- **The existing production data is not carried by this campaign.** R04.5 ports only the demo
  seed (for fresh and test databases); backing up, loading and reconciling the real SQL Server
  rows is `task-06`, whose backup (6.1) is captured **before** this campaign starts.

#### Rollback

Each subtask is one commit. The `pg` driver swap (R04.2) and the schema port (R04.3) can be
reverted independently; if the suite goes red and the cause is not obvious within a few minutes,
`git revert` and record the failing case in the box before retrying.

---

#### R04.1 — Docs: Define the PostgreSQL schema, driver and tooling as the target

Rules: none (this subtask creates the rules' home)
Not in scope: any code change — this only rewrites the documents to describe the Postgres target.
Docs to update: DB.md header and §2 (type mapping: `UNIQUEIDENTIFIER`→`uuid`, `VARCHAR(MAX)`→
`text`, `BIT`→`boolean`, `DATETIME2`→`timestamptz`, `DATE`→`date`, `NEWID()`→`gen_random_uuid()`,
`SYSUTCDATETIME()`→`now() at time zone 'utc'`), DB §2.3 (indexes), DB §4 (seed), DB §5
(drop-recreate still, now Postgres), DB §6 (dashboard query in Postgres dialect), Tech.md §1 and
§2 (driver), Tech-Backend §8 (time functions), PRD §9 (deployment names Postgres), Decisions
D-0NN (why Postgres; the type mapping).
Verify: `node scripts/check-docs.mjs`

- [x] DB.md describes the Postgres column types, constraints and indexes one-for-one with the
      current schema; every PRD §6 limit still points at PRD.
- [x] DB §6 shows the dashboard query in Postgres dialect (`::date`, date subtraction for
      `days_overdue`, `$n` parameters) with the same case table and the same buckets.
- [x] A `docs/Decisions.md` entry records the engine switch and the type mapping; no §/path
      reference dangles.
- Commit: `docs: define the PostgreSQL schema, driver and tooling`

---

#### R04.2 — DevOps: Replace the mssql pool with an env-driven `pg` pool

Rules: Tech-Backend §7, Tech.md §2, Tech.md §3
Not in scope: porting the queries (R04.4) — this subtask only swaps the connection layer and
keeps the app booting. The SQL strings still read T-SQL until R04.4 and are expected to fail
until then; gate the cutover so the suite is run after R04.4.
Docs to update: Tech.md §1 (drop `mssql`/`msnodesqlv8`, add `pg`), Tech.md §3 (`DATABASE_URL`),
Tech-Backend §1 (the `config/db.js` description), backend `.env.example`.
Verify: the app boots against a local Postgres and establishes the pool; `GET /api/auth/me`
reaches the database layer.

- [x] `pg` added and `mssql`/`msnodesqlv8` removed from `backend/package.json`.
- [x] `config/db.js` exports a single `pg.Pool` built from `DATABASE_URL`, reused process-wide.
- [x] `DATABASE_URL` (and the `TEST_*` equivalent from refactor-03) in env + `.env.example`;
      no connection string hardcoded anywhere.
- [x] `server.js`, CORS, cookies and routing are untouched.
- Commit: `refactor(backend): env-driven pg pool in place of the mssql driver`

---

#### R04.3 — Backend-migration: Port the schema and indexes to PostgreSQL DDL

Rules: DB §2, DB §2.3, PRD §6
Not in scope: the seed (R04.5) and the queries (R04.4). Adding or dropping any column.
Docs to update: DB §5 (the file now holds Postgres DDL), Tech-Backend §1 if the file path moves.
Verify: the schema applies cleanly to a fresh Postgres database and every column type, default,
constraint and index matches DB.md.

- [x] `profiles` and `tasks` recreated with `uuid` PKs defaulting to `gen_random_uuid()`,
      `text`/`varchar(n)` per DB.md, `boolean` `is_deleted`, `timestamptz` timestamps.
- [x] `CHECK (priority in …)`, `CHECK (status in …)`, `UNIQUE(email)`, the `FK_tasks_profiles`
      foreign key, and all indexes including `IX_tasks_user_active` are present.
- [x] Drop-recreate guards work on Postgres (`DROP TABLE IF EXISTS … CASCADE` ordering).
- Commit: `feat(db): PostgreSQL schema and indexes`

---

#### R04.4 — Backend-service: Port every query from T-SQL to Postgres SQL

Rules: PRD §4.7, PRD §4.8, DB §6, Tech-Backend §8
Not in scope: changing any result — the `refactor-03` suite defines correctness. Restructuring
controllers beyond the dialect change.
Docs to update: Tech-Backend §2 if the query layer's shape changes.
Verify: `cd backend && npm test` and `npm run test:e2e` are fully green against Postgres —
dashboard buckets, `days_overdue` and every endpoint identical to the SQL Server baseline.

- [x] Every `pool.request().input(...).query(...)` becomes a parameterized `pool.query(text,
      [params])` with `$1…$n` placeholders — no string interpolation of user input anywhere.
- [x] The dashboard query reproduces the DB §6 case table exactly (`::date`, `due_date <= $today`,
      date subtraction for `days_overdue`).
- [x] `completed_at` transition logic and all timestamps use `now() at time zone 'utc'`; results
      match the UTC behaviour (Tech-Backend §8).
- [x] The full suite is green; no test was changed to accommodate a different result.
- Commit: `refactor(backend): port all queries to PostgreSQL`

---

#### R04.5 — Seed: Port the seed to PostgreSQL

Rules: DB §4, PRD §8
Not in scope: changing seed contents or counts — same one profile plus twenty date-anchored
tasks.
Docs to update: DB §4 (the Postgres seed mechanics).
Verify: running the seed against a fresh Postgres yields one profile and twenty tasks anchored
to the current date; logging in with the seeded credentials succeeds and the dashboard shows the
expected buckets.

- [ ] One `profiles` row with the existing bcrypt hash and a fixed id; twenty `tasks` rows.
- [ ] Dates anchored with `current_date + make_interval(days => n)` so re-running reproduces the
      same dashboard on any day.
- [ ] The seed is one-shot and not reentrant-sensitive beyond the documented drop-recreate.
- Commit: `feat(db): PostgreSQL seed data`

---

#### R04.6 — Docs: Refresh the layout and tooling blocks and close the baseline

Rules: Tech-Backend §1, Tech.md §1
Not in scope: code.
Docs to update: Tech-Backend §1 (layout block + `verified at <sha>`), Tech.md §1 (installed
table), DB §5.
Verify: `node scripts/check-docs.mjs` passes; the suite stays green.

- [ ] Layout and installed-package blocks regenerated from reality; `verified at <sha>` updated.
- [ ] The baseline table's "After" column is filled in (engine = PostgreSQL, suites green).
- [ ] No lingering mention of `mssql`/`msnodesqlv8` outside Decisions history.
- Commit: `docs(tech): refresh layout and tooling after the Postgres migration`
