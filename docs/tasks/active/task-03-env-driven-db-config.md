### Task 3 — Move DB connection to environment variables

#### Overview

The connection string in [backend/config/db.js:3-10](../../../backend/config/db.js) is
hardcoded to server name `DESKTOP-8R6Q0B4` with Windows authentication. Anyone else cloning
the repo cannot run the backend without editing source. Separately, there is no
`.env.example` documenting `JWT_SECRET` or the new DB variables.

The long-term direction (SQL auth vs Windows auth, Docker, connection pool size) is **not
recorded** — Decisions D-010 is `OPEN`. This task does the minimum reversible step:
parameterise the connection string via env vars while keeping Windows auth as the default
for the current developer.

**The rules for this task live in `Tech-Backend.md` §7 and `Tech.md` §3**, with the open
question captured as `Decisions.md` D-010.

**Depends on:** nothing · **Blocks:** nothing

---

#### 3.1 — Docs: Resolve or re-confirm Decisions D-010

Rules: none (this subtask records the decision)
Not in scope: writing code.
Docs to update: `Decisions.md` D-010 (change Status from `OPEN` to `Accepted` with the chosen
approach, OR add a superseding entry).
Verify: `grep -n "D-010" docs/Decisions.md` shows a non-`OPEN` status.

- [ ] Decide: env-driven ODBC connection string, OR env-driven individual fields
      (`SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD`, `SQL_TRUSTED`), OR something
      else.
- [ ] D-010 updated to Accepted with the choice and the reasoning.
- Commit: `docs: close D-010 on DB connection configuration`

---

#### 3.2 — Backend-service: Read connection fields from env, with a .env.example

Depends on: 3.1
Rules: Tech-Backend §7, Decisions D-010
Not in scope: changing the driver (still `msnodesqlv8`), the pool lifecycle, or any call
site of `getPool()`.
Docs to update: Tech.md §3 (add the new env vars to the table), Tech-Backend §7
Verify: with the env configured, `cd backend && npm run dev` connects and prints
        `✓ Connected to SQL Server (LazarOS)`; with the env unset, startup fails with a
        clear message.

- [ ] `backend/config/db.js` builds the connection string / config object from `process.env`
      per 3.1.
- [ ] `backend/.env.example` committed with `JWT_SECRET=`, the DB variables, and
      `NODE_ENV=development` (values empty or placeholder).
- [ ] Missing required variables fail fast with a readable error at startup, not at first
      request.
- Commit: `feat(backend): env-driven DB connection + .env.example`
