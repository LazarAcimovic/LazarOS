### Refactor 02 — Introduce a test framework on both tiers

#### Overview

The repo ships without automated tests. Every `Verify:` line in every task currently spells
out a manual check. This campaign installs a test framework on the backend and the frontend,
establishes the mocking boundary for each, and converts the dashboard query (the system's
most important rule, PRD §4.7) into a first pinned test. It does **not** backfill tests for
the rest of the surface — that is for individual tasks.

**The target structure is defined in `Tech-Backend.md` §9 and `Tech-Frontend.md` §9.** This
file is only the plan. **No behaviour changes** — adding tests does not change what the code
does.

**Depends on:** nothing · **Blocks:** every future `Test:` subtask

#### Baseline — captured before step one

| Measure | Before | After (fill in at the end) |
|---|---|---|
| backend test framework | none | Vitest + Supertest |
| frontend test framework | none | Vitest + @testing-library/react + jsdom |
| `cd backend && npm test` | command does not exist | runs dashboard integration test, green |
| `cd frontend && npm test` | command does not exist | runs TaskCard test, green |
| dashboard-query test pinned | no | yes — `tests/dashboard.test.js` |

#### Out of scope

- **No end-to-end (Playwright, Cypress) in this campaign.** That is its own future campaign
  once unit/integration tests exist.
- **No refactor of production code to make it testable** — if a code path cannot be tested
  today, record it and move on. A follow-up campaign changes the code.
- **No CI pipeline.** Running tests in CI is a separate campaign.
- **No coverage threshold.**
- **Not writing tests for every existing module.** One pinned test per tier is the goal of
  this campaign; backfill is future task work.

#### Rollback

Each subtask is one commit. If the framework choice turns out to misbehave on this stack,
`git revert` and pick differently.

---

#### R02.1 — DevOps: Install the backend test runner and pin one dashboard-query test

Rules: Tech-Backend §9
Not in scope: backfilling tests for authController or taskController beyond the single
dashboard integration test. Mocking `getPool`.
Docs to update: Tech-Backend §9 (replace the "no tests yet" paragraphs with the real setup);
Tech.md §1 (add the runner to the "installed" table), Tech.md §5 (remove the "no tests yet"
bullet).
Verify: `cd backend && npm test` runs the dashboard-query test and prints green.

- [x] A test runner (e.g. `node --test` with `supertest`, or `vitest` + `supertest`) added
      to `backend/devDependencies` and wired into `npm test`.
- [x] Decide the mocking boundary: the dashboard test hits a real SQL Server database (per
      Tech-Backend §9 anti-pattern "do not mock getPool"). Document how to spin one up —
      Docker, or an existing local instance — in Tech-Backend §9.
- [x] One integration test: given a user + three tasks (overdue / today / completed today),
      `GET /api/tasks/dashboard?today=...` returns the expected three buckets with the
      expected row counts and `days_overdue` values.
- [x] Test uses its own DB name (e.g. `LazarOS_Test`) or a per-test schema reset — never the
      developer's working database.
- Commit: `chore(backend): add test runner and pin dashboard query test`

---

#### R02.2 — DevOps: Install the frontend test runner and pin one TaskCard test

Rules: Tech-Frontend §9
Not in scope: backfilling tests for other components, adding E2E, mocking `axios` globally
(the plan is to mock at the `api/` layer).
Docs to update: Tech-Frontend §9 (replace the "no tests yet" paragraphs); Tech.md §1 and §5.
Verify: `cd frontend && npm test` runs the TaskCard test and prints green.

- [x] A test runner (e.g. `vitest` + `@testing-library/react` + `jsdom`) added to
      `frontend/devDependencies` and wired into `npm test`.
- [x] One component test: `TaskCard` renders the priority pill with the right class, shows
      the overdue badge when `showDaysOverdue` is true and `days_overdue > 0`, and calls
      `onComplete` / `onEdit` / `onDelete` when their buttons are clicked.
- [x] Mocking convention documented: mock at `features/*/api/*`, not at `axios`; one helper
      for the router wrapper if needed.
- Commit: `chore(frontend): add test runner and pin TaskCard test`
