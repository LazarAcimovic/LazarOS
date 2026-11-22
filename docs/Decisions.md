# Decision log

> Append-only. One numbered entry per resolved question. **Never edit or renumber an existing
> entry** — supersede it and mark the old one `Superseded by D-0NN`.
>
> Any `(per D-0NN)` reference in any document must resolve here.
> An entry is **not** a source of truth: it records *why* a rule is what it is. The rule itself
> lives in PRD / Tech / UI / DB.
>
> This log was seeded on 2026-11-05 by retrofitting the LazarOS documentation system onto a
> working codebase. Most of the reasoning below is **reconstructed from `file:line` evidence
> and marked as such** — see Appendix R2 of `prompt_existing_project.md`. Where a reason is
> not recorded, the entry says so instead of inventing one.

### D-001 — Auth signup endpoint name

**Decided:** 2026-11-05 · **Status:** Accepted
**Answer:** The path is `POST /api/auth/register`. The README's references to `/auth/signup`
are stale documentation and tracked as `task-01`.
**Lives in:** PRD §4.1, Tech-Backend §3
**Why:** Not recorded. The route is live in [backend/routes/authRoutes.js:7](../backend/routes/authRoutes.js)
and [backend/controllers/authController.js:10-11](../backend/controllers/authController.js);
confirmed on 2026-11-05 as the intended name by matching the client's call
([frontend/src/features/auth/api/index.ts:17](../frontend/src/features/auth/api/index.ts)).

### D-002 — Complete / uncomplete is not a dedicated endpoint

**Decided:** 2026-11-05 · **Status:** Accepted
**Answer:** Toggling `status` goes through `PUT /api/tasks/:id` with `{ status }` only. There
are no `PATCH /tasks/:id/complete` or `/uncomplete` endpoints. `completed_at` is derived by
the server from the `status` transition.
**Lives in:** PRD §4.5, Tech-Backend §3
**Why:** Not recorded. The toggle is implemented in
[frontend/src/features/tasks/hooks/useTaskMutations.ts:10-15](../frontend/src/features/tasks/hooks/useTaskMutations.ts)
as `apiUpdateTask(id, { status })`; the backend's `updateTask` derives `completed_at` from the
transition ([backend/controllers/taskController.js:184-190](../backend/controllers/taskController.js)).
Reconstructed from those lines and confirmed on 2026-11-05 as intended.

### D-003 — Restore uses PUT, not PATCH

**Decided:** 2026-11-05 · **Status:** Accepted
**Answer:** `PUT /api/tasks/:id/restore` clears `is_deleted`. The README's `PATCH` was a
documentation slip.
**Lives in:** PRD §4.6, Tech-Backend §3
**Why:** Not recorded. The route is live at
[backend/routes/taskRoutes.js:25](../backend/routes/taskRoutes.js); kept as PUT for
consistency with the `updateTask` write pattern. Tracked for README fix as `task-01`.

### D-004 — Cookie SameSite is Strict (not None)

**Decided:** 2026-11-05 · **Status:** Accepted
**Answer:** The JWT cookie ships with `SameSite=Strict`. The comment in the frontend's axios
client claiming `SameSite=None` is stale and is tracked for removal as `task-02`.
**Lives in:** Tech-Backend §4, PRD §7
**Why:** Not recorded. `generateToken.js:10` sets `sameSite: "strict"`. Dev runs
`localhost:5173 → localhost:5000`, same registrable site, so `Strict` permits the cookie. The
only caller of the auth endpoints from a non-localhost origin would be blocked — likely the
original author weighed CSRF protection over cross-site scenarios that LazarOS does not
support. Confirmed as intended on 2026-11-05.

### D-005 — Description API cap is 4000 chars; column is `VARCHAR(MAX)`

**Decided:** 2026-11-05 · **Status:** Accepted
**Answer:** Both the client and server Zod schemas reject descriptions longer than 4000
characters. The `tasks.description` column is `VARCHAR(MAX)` for migration headroom. The API
contract is **4000**.
**Lives in:** PRD §6, DB §2.2
**Why:** Not recorded. The column was likely sized to `MAX` to avoid committing to a bound
at schema-write time; the Zod cap landed later. 4000 was a round number that matched the
form's textarea use. Confirmed as intended on 2026-11-05.

### D-006 — Password hashing policy: bcrypt cost 10

**Decided:** 2026-11-05 · **Status:** Accepted · N/A to change
**Answer:** Passwords are bcrypt-hashed with cost 10 ([authController.js:30](../backend/controllers/authController.js)).
Password length is 8–20 with ≥1 of each character class (upper, lower, digit, non-alphanum).
**Lives in:** PRD §6, PRD §7
**Why:** Not recorded. bcrypt cost 10 is the library default and a conventional starting
point for a non-sensitive internal tool. The 20-character cap is unusual (most systems do not
cap, and an intentionally-long passphrase is a common choice) but is enforced on both sides,
so it must be respected by clients. Changing it is out of scope (PRD §10).

### D-007 — JWT lifetime is 30 days

**Decided:** 2026-11-05 · **Status:** Accepted · N/A to change
**Answer:** The JWT is valid for 30 days; the cookie `maxAge` matches
([generateToken.js:5, 11](../backend/utils/generateToken.js)).
**Lives in:** PRD §6, Tech-Backend §4
**Why:** Not recorded. A long session on a personal tool trades off re-login friction for the
risk of a long-lived token; the author took the friction win. Out of scope to change (PRD §10).

### D-008 — CSRF is mitigated by SameSite=Strict only

**Decided:** 2026-11-05 · **Status:** Accepted · N/A to change
**Answer:** There are no CSRF tokens. `SameSite=Strict` on the JWT cookie is the only
mitigation.
**Lives in:** PRD §7, Tech-Backend §4
**Why:** Not recorded. For a single-user local tool with no external integrations, the
`Strict` same-site constraint prevents the practical CSRF scenarios. Explicitly out of scope
(PRD §10).

### D-009 — Data isolation is per-user; no tenant layer

**Decided:** 2026-11-05 · **Status:** Accepted
**Answer:** Rows are scoped to the authenticated user via `user_id` taken from the session.
There is no organisation, team or tenant above the user.
**Lives in:** PRD §2, PRD §7, DB §1
**Why:** Not recorded. The product is personal (PRD §1); sharing and teams are explicitly
out of scope (PRD §10). Confirmed by inspection on 2026-11-05.

### D-010 — DB connection is hardcoded (Windows auth, specific machine)

**Decided:** 2026-11-05 · **Status:** OPEN
**Answer:** The connection string in [backend/config/db.js:3-10](../backend/config/db.js) is
hardcoded to server `DESKTOP-8R6Q0B4` with Windows authentication. This is a known blocker to
running on another machine; tracked as `task-03`. Marked **OPEN** because the long-term
intent (env vars, SQL auth, or Docker) is not recorded.
**Lives in:** Tech-Backend §7
**Why:** Not recorded.

### D-011 — Hard delete is never performed

**Decided:** 2026-11-05 · **Status:** Accepted
**Answer:** Nothing in the system issues `DELETE FROM`. `DELETE /api/tasks/:id` sets
`is_deleted = 1`. Profiles have no delete path at all.
**Lives in:** PRD §4.6, PRD §10, DB §3
**Why:** Not recorded. Soft-delete preserves the ability to restore and matches the
product's "tasks never silently disappear" principle (PRD §4.8).

### D-012 — No tests yet; test framework is a tracked refactor

**Decided:** 2026-11-05 · **Status:** Accepted
**Answer:** There is no test framework on either tier. Adding one is campaign `refactor-02`
in `docs/refactors/active/`. Until then, every subtask's `Verify:` line names manual steps
and documents are updated to say so.
**Lives in:** Tech-Backend §9, Tech-Frontend §9
**Why:** The project was built end-to-end by one developer with manual verification; adding
tests before the behaviour was settled would have been premature. The repo is at a state
where testing pays off, so the campaign exists.

### D-013 — `today` for classification is the client's local date

**Decided:** 2026-11-05 · **Status:** Accepted
**Answer:** The server never uses `GETDATE()` for classification. The client sends
`today=YYYY-MM-DD` built from the user's local date (`getLocalToday()`); the server validates
the shape and passes it into the query as `@today`.
**Lives in:** PRD §4.7, Tech-Backend §8
**Why:** Because `due_date` is a pure `DATE` with no timezone, "today" is a user-local
concept. Deriving it server-side would either require passing a timezone around or accept the
server's offset — both worse than trusting the local-date string. Confirmed as intended.

### D-014 — Out-of-scope rules this system does not have — the N/A entries

**Decided:** 2026-11-05 · **Status:** N/A
**Answer:** These categories from `prompt.md`'s Step 0 twelve-list genuinely do not apply:

- **Deadlines on external actors** — N/A: only one actor.
- **Immutable states** — N/A: every task is mutable until soft-deleted; soft-delete is
  reversible.
- **Hard-delete semantics** — N/A: never (see D-011).
- **Rounding / currency** — N/A: no money.
- **External systems** — N/A: no third-party API, email, SMS, storage or webhook. The system
  has only one external dependency, SQL Server, and does not model duplicate delivery or
  retries because there is no upstream that would trigger them.
- **Pagination server-side** — N/A: client paginates in memory because volumes are small and
  intentional (PRD §10).
- **Notifications / audit log** — N/A: no notifications and no audit table.

**Lives in:** —
**Why:** These are the "nobody asked, and there are none" answers that would otherwise read
as silences; recording them as N/A keeps a later agent from inventing work.

### D-015 — SQL Server → Postgres data cutover: native `.bak` as safety copy, portable export as the migration path, parity by counts + checksum

**Decided:** 2026-11-22 · **Status:** Accepted
**Answer:** The live SQL Server data is preserved across `refactor-04` by three deliberate
choices:

1. **Keep a native SQL Server `.bak`** of `LazarOS`, taken before the migration and stored
   outside the repo. It is the untouched rollback copy — if the cutover goes wrong, restore it.
2. **Migrate the rows via a portable, engine-neutral export** (per-table CSV of every
   `profiles`/`tasks` row, all columns, nulls and soft-deleted rows included), not by replaying
   the `.bak`. A `.bak` only restores into SQL Server, so it cannot carry data into Postgres; a
   human-readable export can, and it can be inspected and diffed.
3. **Prove nothing was lost** with per-table row counts **plus** a deterministic content
   checksum — an ordered SHA-256 over canonically-encoded, primary-key-ordered rows. Counts
   alone cannot catch a corrupted or truncated field; the checksum can. The canonical form is
   defined to be reproducible on both engines (DB §7.3) so reconcile recomputes it against the
   loaded Postgres data and compares to the manifest.

**Lives in:** DB §7, Tech §2
**Why:** The `.bak` is the strongest safety net but is engine-locked, so it cannot also be the
migration vehicle; the export is portable but needs a tamper-evident parity test to be trusted;
a checksum defined over an engine-neutral canonical form is the only way to assert byte-level
fidelity across two different database engines.
