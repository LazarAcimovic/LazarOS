### Task 4 — Remove unused API_ROUTES constant

#### Overview

`frontend/src/config/constants.ts:11-26` exports `API_ROUTES` with paths prefixed by `/api/`.
Nothing imports it: every `features/*/api/*.ts` module calls `apiClient` with paths relative
to its `baseURL` (which already includes `/api`). Keeping the constant invites a future
mistake — someone will import it and double-prefix.

**The rules live in `Tech-Frontend.md` §3 (HTTP client)** — all API paths are relative to
`baseURL`.

**Depends on:** nothing · **Blocks:** nothing

---

#### 4.1 — Frontend-service: Delete `API_ROUTES`

Rules: Tech-Frontend §3
Not in scope: `APP_ROUTES` (actively used by the router); any other export from
`constants.ts`.
Docs to update: Tech-Frontend §1 (remove the `API_ROUTES (unused, see task-04)` note once
the constant is gone)
Verify: `grep -rn "API_ROUTES" frontend/src` prints nothing after the edit; `npm run build`
        in `frontend/` succeeds.

- [ ] `API_ROUTES` object removed from `frontend/src/config/constants.ts`.
- [ ] No orphan import added by the edit (should be none, since nothing imports it).
- Commit: `refactor(frontend): remove unused API_ROUTES constant`
