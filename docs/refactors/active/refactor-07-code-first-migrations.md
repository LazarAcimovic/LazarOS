### Refactor 07 — Adopt the Prisma Migrate code-first workflow

#### Overview

`refactor-05` introduced Prisma and *baselined* the existing schema (`0_init`, applied), so
`prisma migrate` already works. But the schema is still **defined in five places**:
`prisma/schema.prisma` (the datamodel), `backend/db/schema.sql` (the legacy drop-recreate file +
demo seed), and the inline `CREATE TABLE` DDL hand-copied into each of the three backend
integration suites (`tests/auth.test.js`, `tests/tasks.test.js`, `tests/dashboard.test.js`) — plus
the e2e runner (`frontend/e2e/run-e2e.mjs`) reads `schema.sql`. That is **database-first**: the
hand-written SQL is the source of truth and the datamodel merely mirrors it.

This campaign completes the flip to **code-first**: `prisma/schema.prisma` becomes the single source
of truth, the Prisma **migrations** become the one schema definition everyone applies (tests, e2e,
dev, prod), and `backend/db/schema.sql` is retired. The demo seed moves to a Prisma seed script.
From here, a schema change is: edit `schema.prisma` → `prisma migrate dev` → the new migration
applies everywhere. No behaviour changes — the `refactor-03` backend suite and the e2e journeys are
the contract and stay green.

**The workflow is defined in `DB.md` §5 and `Tech.md` §2; the test/e2e mechanics in
`Tech-Backend.md` §9 and `Tech-Frontend.md` §9.** This file is only the plan.

**Depends on:** refactor-05 · **Blocks:** nothing (task-05's new model is the first change authored
this way)

#### Baseline — captured before step one

| Measure | Before | After |
|---|---|---|
| schema definitions | 5 (schema.prisma, schema.sql, 3 suites' inline DDL; e2e reads schema.sql) | |
| `backend/db/schema.sql` | present (source of truth + seed) | |
| `cd backend && npm test` | 63 passing | |
| `npm run test:e2e` | 5 passing | |
| demo seed | SQL in `schema.sql` | |

#### Out of scope

- **No schema or behaviour change.** The migrations reproduce the identical schema; the suites prove
  it. New tables are other work (`task-05`).
- **No Prisma-version change.** Pinned `7.10.1` by `refactor-05` / D-018.
- **No switch to the new `prisma-client` generator.** The JS backend stays on `prisma-client-js`.

#### Rollback

Each subtask is one commit. If a suite goes red and the cause is not obvious within a few minutes,
`git revert` that commit and record the failing case in the box before retrying.

---

#### R07.1 — Docs: Define the code-first workflow and the single schema source

Rules: none (this subtask creates the rules' home)
Not in scope: any code change — this rewrites the documents to describe the target workflow.
Docs to update: DB §5 (schema.prisma is the source of truth; `migrate dev`/`deploy`; tests and e2e
apply migrations), DB §4 (the demo seed is now a Prisma seed script), Tech §2 (migration + seed
tooling), Tech-Backend §9 (suites apply migrations, not inline DDL), Tech-Frontend §9 (e2e applies
migrations, not `schema.sql`), Decisions D-0NN (adopt code-first; retire `schema.sql`; the seed move).
Verify: `node scripts/check-docs.mjs`

- [x] DB §5 describes `schema.prisma` as the source of truth and the `migrate dev` → migration →
      apply-everywhere loop; DB §4 points the seed at the Prisma seed script.
- [x] Tech-Backend §9 / Tech-Frontend §9 describe tests and e2e applying the migrations.
- [x] A Decisions entry (D-019) records the code-first adoption, the `schema.sql` retirement and the seed move.
- Commit: `docs: adopt the Prisma Migrate code-first workflow`

---

#### R07.2 — Test: Backend suites apply the migrations instead of inline DDL

Rules: Tech-Backend §9, DB §5
Not in scope: changing any assertion or the e2e runner (R07.3). Any product behaviour.
Docs to update: Tech-Backend §9 if the helper name settles differently.
Verify: `cd backend && npm test` — 63 green against the migrated schema.

- [x] A shared `tests/setup/resetSchema.js` drops the `public` schema and applies every
      `prisma/migrations/*/migration.sql` in order (the same SQL `migrate deploy` would).
- [x] `auth.test.js`, `tasks.test.js`, `dashboard.test.js` call `resetSchema` in `beforeAll`; no
      inline `CREATE TABLE` DDL remains in the suites (grep confirms zero).
- [x] The suite is green (63); the schema the tests run against is exactly the migrated one.
- Commit: `test(backend): apply prisma migrations instead of inline schema DDL`

---

#### R07.3 — DevOps: e2e applies migrations, add the Prisma seed, retire `schema.sql`

Rules: Tech-Frontend §9, DB §4, DB §5
Not in scope: changing any journey or backend behaviour.
Docs to update: Tech-Backend §1 (layout loses `db/schema.sql`, gains `prisma/seed.mjs`) — deferred
to R07.4's layout refresh; DB §4 if the seed contents are relocated.
Verify: `npm run test:e2e` (5 green) and `cd backend && npm test` (63 green); a fresh dev DB can be
built with `prisma migrate deploy` + `node prisma/seed.mjs`.

- [x] `frontend/e2e/run-e2e.mjs` drops the `public` schema and applies the migrations (no
      `schema.sql` read); e2e is green (5).
- [x] `backend/prisma/seed.mjs` recreates the demo seed (one user + the 20-task set) via the Prisma
      client, due dates anchored to the current date; verified against `LazarOS_Test` (1 profile, 20 tasks).
- [x] `backend/db/schema.sql` is deleted; the prose references (DB §2, PRD §8, Tech §5) are
      repointed. The layout block is refreshed in R07.4; the only remaining mention is the historical
      D-017 entry, kept per the append-only Decisions rule.
- Commit: `chore: retire db/schema.sql for migrations + a prisma seed`

---

#### R07.4 — Docs: Refresh the layout block and close the baseline

Rules: Tech-Backend §1
Not in scope: code.
Docs to update: Tech-Backend §1 (layout: no `db/schema.sql`, add `prisma/seed.mjs`; `verified at`).
Verify: `node scripts/check-docs.mjs`; both suites stay green.

- [ ] Layout block regenerated from a real directory listing; `verified at` updated.
- [ ] The baseline "After" column is filled in (one schema source; `schema.sql` gone; suites green).
- [ ] No doc or script references `backend/db/schema.sql`.
- Commit: `docs(tech): refresh layout after retiring schema.sql`
