### Refactor 05 — Replace raw SQL with the Prisma ORM

#### Overview

With the database on PostgreSQL (`refactor-04`), this campaign moves data access from raw `pg`
queries to **Prisma**. Prisma introspects the existing Postgres schema into `prisma/schema.prisma`,
owns migrations going forward (`prisma migrate`), and the generated Prisma Client replaces the
hand-written SQL in the controllers. The one query Prisma Client cannot express ergonomically —
the computed dashboard query (DB §6) — stays as a parameterized `$queryRaw`. Use the **latest
stable Prisma** (the newer the better; pin the exact version in R05.1 and record it in Decisions).
**No behaviour changes:** the `refactor-03` suite is the contract and must stay green.

**The data layer's target shape is defined in `Tech-Backend.md` §1–§2 and `DB.md` §5.** This file
is only the plan.

**Depends on:** refactor-04 · **Blocks:** task-05

#### Baseline — captured before step one

| Measure | Before | After (fill in at the end) |
|---|---|---|
| data access | raw parameterized `pg` SQL | |
| migrations | drop-recreate `schema.sql` | |
| `cd backend && npm test` | green on raw pg | |
| `npm run test:e2e` | green on raw pg | |
| Prisma version pinned | n/a | |

#### Out of scope

- **No schema or behaviour change.** Prisma must reproduce identical results; the suite proves it.
- **No new tables.** The `password_reset_tokens` model is added by `task-05`, which depends on
  this campaign so the model lands in Prisma, not raw SQL.
- **No database-engine change.** Postgres is fixed by `refactor-04`.
- **No rewrite of the dashboard semantics.** The computed query stays raw (`$queryRaw`),
  parameterized, matching DB §6.

#### Rollback

Each controller is ported in its own commit behind the generated client. If a Prisma mapping
changes a result, `git revert` that controller's commit, record the failing case in the box, and
keep the raw query for that path until the mapping is correct.

---

#### R05.1 — Docs: Define Prisma as the data layer and migration tool

Rules: none (this subtask creates the rules' home)
Not in scope: installing or generating anything (R05.2) — this only rewrites the documents.
Docs to update: Tech-Backend §1 (the `prisma/` folder and client), Tech-Backend §2 (where Prisma
sits in the pipeline), Tech.md §1 (`prisma` + `@prisma/client`, with the pinned version), Tech.md
§2 (Prisma as the DB tooling), DB §5 (migrations are now Prisma Migrate, not drop-recreate), PRD
§10 (remove "ORM" from the out-of-scope list), Decisions D-0NN (why Prisma; the pinned version;
the `$queryRaw` carve-out for the dashboard).
Verify: `node scripts/check-docs.mjs`

- [x] Tech-Backend and Tech.md describe Prisma Client as the data layer and `prisma migrate` as
      the migration workflow; the exact Prisma version is recorded.
- [x] DB §5 replaces the drop-recreate description with the Prisma Migrate workflow and keeps the
      test-DB reset note (refactor-03) accurate.
- [x] PRD §10 no longer lists "ORM" as out of scope; a Decisions entry records the reversal.
- Commit: `docs: adopt Prisma as the data and migration layer`

---

#### R05.2 — DevOps: Install Prisma, introspect the schema, generate the client

Rules: Tech-Backend §1, Tech.md §2
Not in scope: porting any controller (R05.3–R05.5).
Docs to update: Tech-Backend §1 (layout gains `prisma/`), DB §5 if the baseline-migration
mechanics need a note.
Verify: `npx prisma generate` succeeds; `prisma/schema.prisma` matches DB.md; the app still
boots and serves the (still-raw) endpoints.

- [x] `prisma` (dev) and `@prisma/client` added (plus `@prisma/adapter-pg` — Prisma 7 requires a
      driver adapter); the datasource URL resolves from `DATABASE_URL` via `prisma7.config.ts`.
- [x] `prisma db pull` introspects the Postgres schema into `schema.prisma`, reviewed against
      DB.md (models `profiles`, `tasks`; relation on `user_id`; the indexes). The two `CHECK`
      constraints (Prisma does not model them) are preserved by hand in the `0_init` migration.
- [x] A baseline migration (`0_init`) is created and marked `--applied`, so `prisma migrate` has a
      starting point without dropping data; `prisma migrate status` reports no drift.
- [x] The generated client is importable; nothing in the controllers uses it yet.
- Commit: `chore(backend): install prisma and baseline the existing schema`

---

#### R05.3 — Backend-service: Port the auth controller to Prisma Client

Rules: PRD §4.1, PRD §4.2, PRD §4.12, Tech-Backend §3
Not in scope: task controllers (R05.4–R05.5). Changing responses or status codes.
Docs to update: Tech-Backend §2 if the data-access description changes.
Verify: `cd backend && npm test` — the auth integration suite is green through Prisma.

- [x] `register`, `login`, `me` and `protect`'s user lookup go through `prisma.profiles`; no raw
      SQL remains in the auth path. The shared client is `config/prisma.js` (pg adapter on the
      `config/db.js` pool).
- [x] Responses are byte-for-byte equivalent (password omitted; same error strings, including the
      identical login failure message); the auth integration suite is green through Prisma.
- Commit: `refactor(backend): port auth controller to Prisma`

---

#### R05.4 — Backend-service: Port the task CRUD, archive and list queries to Prisma Client

Rules: PRD §4.3, PRD §4.4, PRD §4.5, PRD §4.6, PRD §4.9, PRD §4.10, PRD §4.11, PRD §7
Not in scope: the dashboard query (R05.5). Changing ordering or filtering behaviour.
Docs to update: Tech-Backend §2 if needed.
Verify: `cd backend && npm test` — the tasks integration suite is green through Prisma.

- [ ] Create / update / delete (soft) / restore / upcoming / all / archive go through
      `prisma.tasks`; `user_id` still comes from the session, never the body (PRD §7).
- [ ] `completed_at` transitions and `updated_at` stamping match the current behaviour.
- [ ] Ordering (`due_date`, `created_at`, `updated_at`) and the `is_deleted` filter are preserved.
- Commit: `refactor(backend): port task CRUD and lists to Prisma`

---

#### R05.5 — Backend-service: Keep the dashboard query as parameterized `$queryRaw`

Rules: PRD §4.7, PRD §4.8, DB §6, Tech-Backend §8
Not in scope: expressing the computed `section` / `days_overdue` in the Prisma query builder —
raw is the agreed shape for this one path.
Docs to update: Tech-Backend §8 / DB §6 if the raw query text is relocated.
Verify: `cd backend && npm test` and `npm run test:e2e` — the dashboard buckets and `days_overdue`
are identical to the pre-Prisma baseline.

- [ ] The dashboard runs through `prisma.$queryRaw` with parameters (never interpolation),
      reproducing the DB §6 case table exactly.
- [ ] The raw query is the only raw SQL left in the backend; every other path uses the client.
- Commit: `refactor(backend): dashboard via parameterized $queryRaw`

---

#### R05.6 — Docs: Refresh the layout block and close the baseline

Rules: Tech-Backend §1, Tech.md §1
Not in scope: code.
Docs to update: Tech-Backend §1 (layout + `verified at <sha>`), Tech.md §1.
Verify: `node scripts/check-docs.mjs` passes; the suite stays green.

- [ ] Layout block regenerated with `prisma/`; `verified at <sha>` updated.
- [ ] The baseline "After" column is filled in (data access = Prisma, suites green).
- [ ] No stale "raw SQL / no ORM" claims remain outside Decisions history.
- Commit: `docs(tech): refresh layout after the Prisma migration`
