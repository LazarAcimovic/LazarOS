### Task 1 — Fix stale API paths in README

#### Overview

The README's §6 API tables list three endpoints that do not match what the code serves
(`/auth/signup` → is `/auth/register`; `PATCH /tasks/:id/complete` and `/uncomplete` → do not
exist, the UI toggles via `PUT /tasks/:id`; `PATCH /tasks/:id/restore` → is `PUT`). This task
reconciles the README with reality. The rules themselves are already written into PRD §4 and
Decisions D-001 through D-003; this is a pure README edit.

**The rules for this task live in `PRD.md` §4.1, §4.5, §4.6** and are recorded in
`Decisions.md` D-001, D-002, D-003. This file is only the plan — read the rules from those
sections, never from this Overview.

**Depends on:** nothing · **Blocks:** nothing

---

#### 1.1 — Docs: Align README §6.1 and §6.2 with the live routes

Rules: PRD §4.1 (register), PRD §4.5 (complete/uncomplete), PRD §4.6 (restore),
Decisions D-001, D-002, D-003
Not in scope: any code change in `backend/` or `frontend/`. Changing the endpoints to match
the README is explicitly NOT the direction — see D-001 through D-003: the code is the live
contract.
Docs to update: `README.md` §6.1 and §6.2 only
Verify: `grep -n "signup\|/complete\|/uncomplete\|PATCH.*restore" README.md` prints nothing
        after the edit, and `node scripts/check-docs.mjs` is clean.

- [ ] `/auth/signup` row removed or renamed to `/auth/register` in §6.1.
- [ ] `/tasks/:id/complete` and `/tasks/:id/uncomplete` rows removed from §6.2; the surrounding
      text explains completion goes through `PUT /tasks/:id` with `{ status }`.
- [ ] `PATCH /tasks/:id/restore` corrected to `PUT /tasks/:id/restore`.
- Commit: `docs(readme): align §6 API tables with live routes`
