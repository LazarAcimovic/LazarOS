### Refactor 03 — Behaviour test suite from the PRD, plus Playwright e2e

#### Overview

`refactor-02` lands one pinned test per tier and nothing more. This campaign fills in the rest:
a black-box suite that encodes **PRD behaviour** — unit tests for the pure logic, integration
tests for every endpoint against a real database, frontend tests at the `api/` boundary, and
an end-to-end Playwright journey against a Dockerized stack. The point of the suite is to be
the **safety net** the DB refactors (`refactor-04`, `refactor-05`) and the frontend transform
(`refactor-06`) stay green against: it must pass on today's SQL Server stack and keep passing
after every structural change, because nothing it asserts is allowed to change behaviour.

**The target structure is defined in `Tech-Backend.md` §9 and `Tech-Frontend.md` §9.** This
file is only the plan. **No behaviour changes** — this campaign only adds tests. Tests assert
what the **PRD** says, never what the current code happens to do: where the implementation
diverges from the PRD, the test encodes the PRD and the divergence becomes a `- [ ]` box on the
task that owns that behaviour — it is never "fixed" by asserting the wrong value.

**Depends on:** refactor-02 · **Blocks:** refactor-04, refactor-05, refactor-06, task-05

#### Baseline — captured before step one

| Measure | Before | After |
|---|---|---|
| backend tests | 1 pinned (dashboard query, from refactor-02) | 63 (3 unit + 3 integration files) |
| frontend tests | 1 pinned (`TaskCard`, from refactor-02) | 56 (10 files) |
| end-to-end tests | none | 5 (smoke + 4 core-loop journeys) |
| Dockerized isolated test DB | none | yes — `LazarOS_Test` on :14333; e2e `LazarOS_E2E` on :14334 |
| `cd backend && npm test` | runs 1 test | runs 63 against the container |
| `cd frontend && npm test` | runs 1 test | runs 56 |
| `npm run test:e2e` | command does not exist | runs 5 against a throwaway stack |

#### Out of scope

- **No production-code changes to make something testable.** If a path cannot be tested without
  touching production code, record it as a box on the owning task and move on — this campaign
  only adds tests.
- **No CI pipeline.** Running the suite in CI is a separate future campaign.
- **No coverage threshold.** Coverage numbers are not a gate here.
- **No new product behaviour.** The forgot-password journey is tested by `task-05`, not here;
  this campaign tests only what the PRD already specifies.
- **No assertion of current-implementation quirks.** A test that would only pass because the
  code disagrees with the PRD is a bug report, not a test.

#### Rollback

Each subtask is one commit adding test files (plus the harness in R03.2 / R03.6). If a runner
or harness choice misbehaves on this stack, `git revert` the commit and record what failed in
the box before picking differently. Reverting a test-only commit never touches production code.

---

#### R03.1 — Test: Backend unit tests for the pure logic — validation schemas and time handling

Rules: PRD §6, PRD §4.7, PRD §4.8, Tech-Backend §5, Tech-Backend §8, Tech-Backend §9
Not in scope: anything that needs a database connection (those are R03.3 / R03.4). Asserting
the current code where it disagrees with PRD §6 — encode the PRD limit and box the divergence.
Docs to update: Tech-Backend §9 (name the unit-test location and the "no DB in a unit test"
rule).
Verify: `cd backend && npm test` runs the unit tests and prints green.

- [x] `registerSchema` / `loginSchema` accept the PRD §6 limits (names 1–100, email format,
      password 8–20 with ≥1 of each class) and reject each boundary violation.
- [x] `createTaskSchema` / `updateTaskSchema` enforce PRD §6 (title 1–255, description 0–4000,
      `due_date` `YYYY-MM-DD`, `priority` ∈ {low,medium,high}, `status` ∈ {pending,completed}).
- [x] The `today` query-param guard accepts `^\d{4}-\d{2}-\d{2}$` and rejects anything else
      (PRD §4.13 "missing `today`" → 400).
- Commit: `test(backend): unit-test validation schemas and today guard`

---

#### R03.2 — DevOps: Dockerized isolated test database wired into `npm test`

Rules: Tech-Backend §9, Tech.md §2
Not in scope: writing the integration tests themselves (R03.3 / R03.4) — this subtask only
stands up the database they run against. Pointing tests at the developer's working database.
Docs to update: Tech-Backend §9 (how to spin the container up and tear it down), Tech.md §2
(the test-DB tooling), Tech.md §4 (the command to run it).
Verify: the documented command brings up the container, applies the schema, runs the existing
dashboard integration test green against it, and tears it down — never the dev database.

- [x] A `docker-compose`/script brings up the engine's image on its own port with a dedicated
      database name (e.g. `LazarOS_Test`), isolated from the dev instance.
- [x] A `TEST_*` connection env (read only by the test setup) points the backend at that
      container; the dev connection is never used by tests.
- [x] A setup/teardown hook applies the schema (and resets between runs) — the drop-recreate
      script is not reentrant, so tests never run in parallel against one database.
- [x] `cd backend && npm test` starts/uses the container and runs the dashboard test green.
- Commit: `chore(backend): dockerized isolated test database for integration tests`

---

#### R03.3 — Test: Backend integration tests for the auth surface

Rules: PRD §4.1, PRD §4.2, PRD §4.12, PRD §4.13, PRD §7, Tech-Backend §3, Tech-Backend §4
Not in scope: task endpoints (R03.4). The forgot-password / reset endpoints (task-05).
Docs to update: Tech-Backend §9 (list the auth integration suite).
Verify: `cd backend && npm test` runs the auth integration tests green against the R03.2
container.

- [x] `POST /api/auth/register`: happy path 201 + `jwt` cookie set with `httpOnly`,
      `sameSite=strict`; duplicate email → `400 Email already in use`; invalid body → 400.
- [x] `POST /api/auth/login`: unknown email and wrong password return the **identical**
      `401 Invalid email or password` (PRD §4.2 — no account enumeration).
- [x] `POST /api/auth/logout` clears the `jwt` cookie; a subsequent protected request is 401.
- [x] `protect` returns 401 for missing token, invalid token, and a token whose user no longer
      exists (PRD §4.13 / Tech-Backend §3).
- [x] Register / login / `me` responses never include the `password` column (PRD §7).
- Commit: `test(backend): integration-test the auth endpoints`

---

#### R03.4 — Test: Backend integration tests for the task surface and data isolation

Rules: PRD §4.3, PRD §4.4, PRD §4.5, PRD §4.6, PRD §4.7, PRD §4.8, PRD §4.9, PRD §4.10, PRD §4.11, PRD §7, DB §6
Not in scope: auth endpoints (R03.3). Changing the dashboard query — only pinning it.
Docs to update: Tech-Backend §9 (list the tasks integration suite).
Verify: `cd backend && npm test` runs the tasks integration tests green against the R03.2
container.

- [x] Dashboard: seed one overdue, one due-today, one completed-today task and assert the three
      buckets, the row counts, and `days_overdue` — one case per row of the DB §6 case table.
- [x] Overdue persistence (PRD §4.8): a `pending` task with `due_date < today` appears in
      Overdue for `today` and again for `today + 1`.
- [x] All tasks (PRD §4.10): `GET /api/tasks` returns the caller's non-deleted tasks ordered by
      `due_date ASC, created_at ASC`; a soft-deleted task is absent from the list.
- [x] Upcoming (PRD §4.9): `GET /api/tasks/upcoming` returns only `pending` tasks with
      `due_date > today` ordered by `due_date`; overdue, due-today, completed and soft-deleted
      rows are all excluded.
- [x] Create stamps `user_id` from the session, never from the body (PRD §7); the `201` row is
      owned by the caller.
- [x] Edit transitions: `pending → completed` sets `completed_at`; `completed → pending` nulls
      it (PRD §4.4 / §4.5).
- [x] Soft delete sets `is_deleted` and keeps the row; restore clears it (PRD §4.6); Archive
      lists only soft-deleted rows (PRD §4.11). A soft-deleted task is `404` to edit and to
      complete — only restore brings it back (PRD §4.8 terminal transition).
- [x] **Isolation:** user A cannot read, edit, delete or restore user B's task (404, not 403);
      every list excludes other users' rows (PRD §7).
- [x] Missing `today` on dashboard/upcoming → `400` (PRD §4.13).
- Commit: `test(backend): integration-test the task endpoints and isolation`

---

#### R03.5 — Test: Frontend tests at the `api/` boundary for the page flows

Rules: PRD §4.1, PRD §4.2, PRD §4.3, PRD §4.5, PRD §4.6, PRD §4.7, PRD §4.9, PRD §4.10, PRD §4.11, Tech-Frontend §4, Tech-Frontend §5, Tech-Frontend §9
Not in scope: end-to-end flows (R03.6 / R03.7). Stubbing `axios` globally — mock at
`features/*/api/*` (or MSW), per Tech-Frontend §9.
Docs to update: Tech-Frontend §9 (the mocking convention and the component/page suites).
Verify: `cd frontend && npm test` runs the component/page tests green.

- [x] Login and Register pages: client Zod errors render inline; a mocked server error renders
      in the `auth__error` strip; submit disables and changes copy (UI §3 / PRD §4.1 / §4.2).
- [x] Today page: mocked `dashboard` response renders the three sections and the "N days
      overdue" badge from `days_overdue` (PRD §4.7 / §4.8).
- [x] All Tasks page: in-memory search / status / priority / date filters narrow the mocked
      list and pagination pages at 10 (PRD §4.10).
- [x] `AuthGuard`: a mocked 401 from `GET /auth/me` redirects to `/login` (Tech-Frontend §5).
- [x] Upcoming page: a mocked `upcoming` response groups tasks by date, labels the next
      calendar day "Tomorrow", and paginates at 5 (PRD §4.9).
- [x] Archive page: a mocked `archive` response lists the soft-deleted tasks, and a Restore
      click calls the restore api and reloads (PRD §4.11).
- [x] Task write flows at the `api/` boundary: creating from the New Task modal `POST`s and
      reloads; the card checkmark toggles `status` both ways through `PUT` (`useTaskMutations`,
      PRD §4.5); confirming delete calls `DELETE` (PRD §4.3 / §4.6).
- Commit: `test(frontend): cover the page flows at the api boundary`

---

#### R03.6 — DevOps: Playwright end-to-end harness against the Dockerized stack

Rules: Tech-Frontend §9, Tech.md §2
Not in scope: writing the journeys (R03.7). Running against the dev database or a cloud DB —
e2e uses the R03.2-style container so the developer's data is never touched.
Docs to update: Tech-Frontend §9 (the e2e harness and `npm run test:e2e`), Tech.md §2
(Playwright + the e2e test DB), Tech.md §4 (the command).
Verify: `npm run test:e2e` boots backend + frontend + a throwaway Dockerized database, runs a
single smoke journey (register → land on Today), and tears everything down.

- [x] Playwright added to devDependencies with a config that starts the backend, the frontend
      and a dedicated Dockerized database before the run.
- [x] The e2e database is a throwaway container seeded per run — never the dev or the unit/
      integration database.
- [x] One smoke journey proves the wiring end to end; the rest come in R03.7.
- Commit: `chore(e2e): playwright harness on a dockerized throwaway database`

---

#### R03.7 — Test: Playwright journeys for the core product loop

Rules: PRD §4.1, PRD §4.3, PRD §4.7, PRD §4.8, PRD §4.5, PRD §4.6, PRD §4.11, PRD §4.12
Not in scope: the forgot-password journey (task-05 adds it). Visual / pixel assertions —
assert behaviour and copy, not styling.
Docs to update: Tech-Frontend §9 (list the e2e journeys).
Verify: `npm run test:e2e` runs the journeys green.

- [x] Register → create a task due today → it shows in Today; create one due yesterday (seeded)
      → it shows in Overdue with the right "N days overdue" badge.
- [x] Complete a task → it moves to Completed Today; reload "tomorrow" (client `today + 1`) →
      it leaves the dashboard.
- [x] Soft-delete a task → it leaves Today and appears in Archive; restore → it returns.
- [x] Logout → redirected to `/login`; the back button does not reveal an authenticated page.
- Commit: `test(e2e): cover the core task lifecycle journeys`

---

#### R03.8 — Test: Frontend-service unit tests for the date and label utils

Rules: PRD §4.7, PRD §4.9, PRD §6, Tech-Frontend §9
Not in scope: anything that renders a component or touches the `api/` layer (R03.5). Asserting
the current code where it disagrees with the PRD — encode the PRD and box the divergence.
Docs to update: Tech-Frontend §9 (name the utils unit suite).
Verify: `cd frontend && npm test` runs the utils unit tests and prints green.

- [x] `getLocalToday()` returns the machine's **local** calendar date as `YYYY-MM-DD`, built
      from local year/month/day parts (never a UTC ISO slice), so the `today` sent to the server
      is the user's local day and does not slip across the UTC boundary (PRD §4.7).
- [x] `formatDueDate` / `formatGroupDate` format in `en-US`; `formatGroupDate` labels the next
      calendar day "Tomorrow" and omits the year only when it equals the current year (PRD §4.9).
- [x] `priorityLabel` capitalises `low` / `medium` / `high` for display (PRD §6 values).
- Commit: `test(frontend): unit-test the date and label utils`
