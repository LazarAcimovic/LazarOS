### Task 6 — Remove CORS; route dev requests same-origin through a Vite proxy

#### Overview

The backend enables the `cors` middleware ([backend/app.js:10-19](../../../backend/app.js)) and
ships the `cors` dependency. It is needed today only because the dev frontend (`localhost:5173`)
calls the backend (`localhost:5000`) **cross-origin**. Routing API calls through a Vite dev-server
proxy makes the browser issue **same-origin** requests to the Vite port, which forwards `/api` to
the backend — so CORS becomes unnecessary. This task removes the `cors` middleware and dependency,
adds a `/api` proxy to `vite.config.ts`, and points the axios client at a **relative** `/api` base
URL. The cookie stays `SameSite=Strict` (Decisions D-004) and rides along on the now same-origin
requests. **No change to API contracts, routes, auth or the cookie** — only the request transport
origin and the redundant CORS layer change.

**The rules for this task live in `Tech-Backend.md` §2** (middleware pipeline) and §4 (cookie),
`Tech-Frontend.md` §1 (the Vite config) and §3 (the HTTP client), `Tech.md` §1 (packages) and its
dev-server section, and `PRD.md` §7 (security posture), with reasoning in a new `Decisions D-0NN`.
This file is only the plan — read the rules from those sections, never from this Overview.

> **Two caveats to respect when implementing.** (1) **Production.** The Vite `server.proxy` applies
> only to `vite dev`. Removing CORS entirely assumes production serves the frontend and backend
> same-origin (a reverse proxy, or the backend serving the built SPA). Record that assumption in
> the Decisions entry; do not add a production proxy here. (2) **E2E.** If `npm run test:e2e`
> serves the built app with `vite preview` rather than `vite dev`, the dev `server.proxy` does
> **not** apply — mirror it under `preview.proxy` (or keep the harness on `vite dev`). 6.3's
> `Verify` is what catches this.

**Depends on:** none (refactor-06 has landed; `vite.config.ts` and the axios client are in their new form) · **Blocks:** nothing

---

#### 6.0 — Docs: Promote the "no CORS, same-origin dev proxy" rule into the source-of-truth docs

Rules: none (this subtask creates the rules' home)
Not in scope: any code change.
Docs to update: Tech-Backend §2 (drop `cors` from the middleware pipeline), Tech.md §1 (remove the
`cors` package row) and its dev-server section (dev requests are same-origin via the Vite proxy, not
cross-origin to `:5000`), Tech-Frontend §1 (vite.config now has a `/api` proxy) and §3 (the axios
base URL is a relative `/api`), PRD §7 (security note: no CORS layer; dev is same-origin; the
`SameSite=Strict` CSRF posture is unchanged), Decisions D-0NN (why CORS is removed, the Vite-proxy
mechanism, and the production same-origin assumption).
Verify: `node scripts/check-docs.mjs`

- [ ] The middleware-pipeline, package-list and dev-server docs no longer describe a CORS layer or
      cross-origin dev; the `SameSite=Strict` rule is explicitly unchanged.
- [ ] A Decisions entry records the removal, the Vite-proxy mechanism and the production same-origin
      assumption; no §/path reference dangles (`node scripts/check-docs.mjs` clean).
- Commit: `docs: remove CORS in favour of a same-origin dev proxy`

---

#### 6.1 — Backend-endpoint: Remove the CORS middleware and dependency

Rules: Tech-Backend §2 (middleware pipeline)
Not in scope: any route, controller, validator or cookie-flag change; the Vite proxy (6.2). Keep the
rest of the pipeline (`express.json`, `cookieParser`, routers, error handlers) exactly as-is.
Docs to update: none (the rule lives in Tech-Backend §2 after 6.0).
Verify: `cd backend && npm test` is green and a normal response carries no `Access-Control-Allow-Origin` header.

- [ ] The `cors` import and `app.use(cors(...))` block are removed from `backend/app.js`; the
      middleware order is otherwise unchanged.
- [ ] `cors` is removed from `backend/package.json` dependencies and from the lockfile.
- [ ] A backend integration test asserts a normal API response has no `Access-Control-Allow-Origin`
      header.
- Commit: `refactor(backend): drop the CORS middleware and dependency`

---

#### 6.2 — DevOps: Proxy `/api` to the backend from the Vite dev server

Rules: Tech-Frontend §1 (vite.config)
Not in scope: the axios base URL (6.3); any backend change; production serving.
Docs to update: Tech-Frontend §1 if the committed config shape differs from 6.0's description.
Verify: `cd frontend && npm run build` succeeds and `vite.config.ts` defines `server.proxy["/api"]`
        targeting the backend with `changeOrigin: true`.

- [ ] `server.proxy` routes `/api` to `http://localhost:5000` with `changeOrigin: true`.
- [ ] The stale "no proxy needed / SameSite=None" comment is removed.
- [ ] If the e2e harness serves the built app via `vite preview`, `preview.proxy` mirrors it.
- Commit: `chore(frontend): proxy /api to the backend in dev`

---

#### 6.3 — Frontend-service: Point the axios client at the relative `/api` origin

Rules: Tech-Frontend §3 (HTTP client)
Not in scope: request payloads, interceptors or the 401 → `/login` behaviour (D-007); the proxy (6.2).
Docs to update: Tech-Frontend §3 if the base-URL wording differs from 6.0's.
Verify: `cd frontend && npm test` and `npm run test:e2e` stay green; the axios base URL is a relative
        `/api` (no absolute `http://localhost:5000`).

- [ ] The axios singleton's base URL is the relative `/api`, so requests hit the Vite origin and are
      proxied; `withCredentials` is kept.
- [ ] No module references `http://localhost:5000` (or an absolute `VITE_API_URL`) for API calls; any
      now-unused env wiring is cleaned up.
- [ ] The per-screen network behaviour (which endpoints fire, and when) is otherwise unchanged.
- Commit: `refactor(frontend): use a relative /api base URL behind the dev proxy`
