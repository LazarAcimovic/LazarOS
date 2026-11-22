### Task 2 — Remove stale SameSite comment in apiClient

#### Overview

The comment in [frontend/src/shared/api/apiClient.ts:6](../../../frontend/src/shared/api/apiClient.ts)
claims `withCredentials: true` is "required: sends the SameSite=None jwt cookie cross-origin".
The cookie is actually `SameSite=Strict` ([backend/utils/generateToken.js:10](../../../backend/utils/generateToken.js))
and the dev frontend/backend are on the same registrable site (`localhost:*`), so `Strict`
works. The comment is misleading and tracked in Decisions D-004.

**The rule lives in `Tech-Backend.md` §4** (and `PRD.md` §7, with reasoning in Decisions D-004).

**Depends on:** nothing · **Blocks:** nothing

---

#### 2.1 — Frontend-service: Replace the stale comment

Rules: Tech-Backend §4 (cookie flags), Decisions D-004
Not in scope: changing the cookie flags; moving the comment to a different file; any other
edit in the module.
Docs to update: none (the rule is already in Tech-Backend §4 and Decisions D-004)
Verify: `grep -n "SameSite" frontend/src/shared/api/apiClient.ts` prints only accurate text
        (or nothing).

- [ ] The comment accurately describes why `withCredentials: true` is needed — the browser
      only sends cookies on cross-origin XHRs when this flag is set. No claim about SameSite
      value.
- Commit: `docs(frontend): correct the apiClient cookie comment`
