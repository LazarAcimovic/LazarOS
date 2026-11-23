### Refactor 06 — Transform the frontend to the feature-sliced React 19 stack

#### Overview

The frontend is React 18.3 + react-router v6 + Zustand 4 + Vite 5, styled by one 1006-line
vanilla-CSS/BEM file, with no component library and no test runner. This campaign rebuilds it onto
the reference stack the project has standardised on (`frontend_skills.md`): **React 19.2 + React
Compiler, Vite 8, react-router-dom v7 (data router), Zustand 5, Tailwind v4 + shadcn/radix,
lucide-react, Zod, and Vitest + jsdom + Testing Library + MSW**, in the feature-sliced layout
(`features/<f>/{api,components,hooks,models,pages,utils,index.ts}`, plus `components/{ui,layout,
navigation,shared}`, `providers/`, `services/`, `shared/`, `store/`, `test/`).

**Product behaviour is frozen** — every flow, route, validation rule and API call is pinned by the
`refactor-03` frontend and e2e suites, which must stay green through each step. The **visual layer
does change** (shadcn components replace the BEM stylesheet), so `UI.md` is updated in lockstep;
what stays constant is behaviour and copy, not pixels.

> **Two caveats from the reference doc that do not transfer.** (1) `frontend_skills.md` describes a
> silent **refresh-token** retry on 401. LazarOS has **no refresh token** (single 30-day JWT,
> Decisions D-007); do **not** introduce one — keep the existing "401 → redirect to `/login`"
> behaviour (Tech-Frontend §3). (2) Adopting Tailwind removes `global.css`, which **supersedes
> `refactor-01`** (split global.css); close or re-point `refactor-01` when R06.7 lands.

**The target structure is defined in `Tech-Frontend.md` (rewritten in R06.1) and `UI.md`.** This
file is only the plan.

**Depends on:** refactor-02, refactor-03 · **Blocks:** nothing (task-05's screens should follow
the new patterns once this lands)

#### Baseline — captured before step one

| Measure | Before | After |
|---|---|---|
| React / router | 18.3 / react-router v6 | 19.2 / react-router v7 (data router) |
| Vite / compiler | Vite 5 / no React Compiler | Vite 8 / React Compiler on |
| state | Zustand 4 | Zustand 5 |
| styling | vanilla CSS/BEM, `global.css` 1006 lines | Tailwind v4 + shadcn/radix; `global.css` deleted |
| component library | none | shadcn/ui (radix) + lucide-react |
| `cd frontend && npm test` | component/page suite from refactor-03 green | 56 tests green (10 files) |
| `npm run test:e2e` | green | pending the final consolidated run (closes R06.6) |
| typecheck / build | clean / succeeds | clean / succeeds |

#### Out of scope

- **No backend change.** API contracts, routes and cookies are untouched.
- **No product-behaviour change.** Flows, routes, validation and copy are frozen by the suite.
- **No refresh-token / silent-retry auth.** LazarOS has no refresh token (D-007); the 401 →
  `/login` behaviour is preserved.
- **No new screens or features.** The forgot-password screens are `task-05`.
- **No i18n.** English copy only, as today.

#### Rollback

Each subtask is one commit. The stack upgrade (R06.2) is the riskiest; if the suite or build goes
red and the cause is not obvious within a few minutes, `git revert` and record the failing case in
the box before retrying. Per-feature rebuilds (R06.5–R06.6) revert independently.

---

#### R06.1 — Docs: Define the target frontend architecture

Rules: none (this subtask creates the rules' home)
Not in scope: any code change — this rewrites the documents to describe the target stack.
Docs to update: Tech-Frontend §1 (target layout), §2 (patterns in use — React Compiler on,
feature slices, barrels; what stays "not in use"), §3 (axios client, **no** refresh token), §4
(the canonical data-fetching hook shapes), §5 (react-router v7 data router + `AuthGuard`), §6
(Zustand 5 slice-selector convention), §7 (`useForm` + Zod), §8 (Tailwind v4 + shadcn + `cn()`),
§9 (Vitest + Testing Library + MSW); UI §1 (token system under Tailwind) and §9 (shadcn
primitives); Tech.md §1 (the new frontend packages); Decisions D-020 (adopt the reference pattern
set; the refresh-token exclusion).
Verify: `node scripts/check-docs.mjs`

- [x] Tech-Frontend §1–§9 describe the target stack and conventions; the refresh-token exclusion
      is explicit in §3.
- [x] UI §1/§9 describe the Tailwind token system and the shadcn primitive set replacing BEM.
- [x] A Decisions entry records the adoption and the two caveats; no §/path reference dangles.
- Commit: `docs(frontend): define the feature-sliced React 19 architecture`

---

#### R06.2 — DevOps: Upgrade the stack and wire the toolchain

Rules: Tech-Frontend §1, Tech-Frontend §8, Tech-Frontend §9, Tech.md §1
Not in scope: restructuring folders (R06.3) or rebuilding components (R06.5–R06.6) beyond what the
upgrade forces. Any behaviour change.
Docs to update: Tech.md §1 (installed table), Tech-Frontend §8/§9 if tool specifics change.
Verify: `cd frontend && npm test` (the refactor-03 suite), typecheck and build are all green after
the upgrade.

- [x] React 19.2 + react-dom 19.2; `@vitejs/plugin-react` with `babel-plugin-react-compiler`
      (React Compiler on); Vite 8.
- [x] react-router-dom v7, Zustand 5, Tailwind v4 (`@tailwindcss/vite`) + `tailwind.config`,
      shadcn (`components.json` + `components/ui/*`) on radix, lucide-react, geist font.
- [x] Vitest + jsdom + Testing Library + MSW wired into `npm test`; the `cn()` helper added.
- [x] The refactor-03 suite, typecheck and build pass unchanged (behaviour preserved).
- Commit: `chore(frontend): upgrade to the React 19 + Tailwind + Vitest stack`

---

#### R06.3 — Refactor: Restructure folders to the feature-sliced layout

Rules: Tech-Frontend §1
Not in scope: rewriting component internals (R06.5–R06.6). Behaviour, props or copy changes.
Docs to update: Tech-Frontend §1 (deferred to R06.8's layout-block refresh).
Verify: `cd frontend && npm test`, typecheck and build stay green; every import resolves through a
barrel, not a deep path.

- [x] `grep` the tree for current import paths and record the counts in the commit message.
- [x] Folders moved to `features/<f>/{api,components,hooks,models,pages,utils,index.ts}`,
      `components/{ui,layout,navigation,shared}`, `providers/`, `services/`, `shared/`, `store/`,
      `test/`; `SettingsPage` placed per the Tech-Frontend §1 note.
- [x] Every folder exposes `index.ts`; no deep imports remain; the suite stays green.
- Commit: `refactor(frontend): feature-sliced folder layout`

---

#### R06.4 — Frontend-service: Re-shape the HTTP client and data-fetching hooks

Rules: Tech-Frontend §3, Tech-Frontend §4
Not in scope: introducing a refresh-token retry (excluded — D-007). Changing which requests fire
or their payloads.
Docs to update: Tech-Frontend §3/§4 if the hook names settle differently than R06.1 stated.
Verify: `cd frontend && npm test` and `npm run test:e2e` stay green; the network trace per screen
is unchanged.

- [x] The axios singleton keeps `withCredentials` and the **existing** 401 → `/login` interceptor
      (no refresh token).
- [x] Data fetching follows the canonical hook shape(s) from Tech-Frontend §4 with `AbortSignal`
      plumbed hook → service → axios; services map rows via `utils/map*`.
- [x] No screen changes which endpoints it calls or when.
- Commit: `refactor(frontend): axios singleton and canonical fetch hooks`

---

#### R06.5 — Frontend-component: Rebuild the shared and task components on shadcn + Tailwind

Rules: UI §1, UI §2, UI §9, Tech-Frontend §2, Tech-Frontend §8
Not in scope: page-level state and data flow (R06.6). Changing behaviour or copy.
Docs to update: UI §9 (shared primitives), UI §2 if layout tokens change.
Verify: `cd frontend && npm test` stays green; each listed component renders per UI.md; manual
check of the screens the components appear on.

- [x] `TaskCard`, `TaskForm`, the edit/delete modals, `Pagination`, `Loader`, `ConfirmDialog`,
      `NavBar` rebuilt with radix primitives + Tailwind + `cn()`; lucide icons.
- [x] The priority pill, the "N days overdue" badge, and the complete/edit/delete affordances
      behave exactly as the suite asserts (PRD §4.7 / §4.8).
- [x] UI.md updated for any visual rule the shadcn versions change.
- Commit: `refactor(frontend): rebuild shared and task components on shadcn`

---

#### R06.6 — Frontend-page: Rebuild the pages on the new patterns

Rules: PRD §4.1, PRD §4.2, PRD §4.7, PRD §4.9, PRD §4.10, PRD §4.11, Tech-Frontend §4, Tech-Frontend §5, Tech-Frontend §7
Not in scope: adding screens (task-05). Changing flows, routes or validation.
Docs to update: UI §2–§8 for any screen whose markup changes shape.
Verify: `cd frontend && npm test` and `npm run test:e2e` stay green; manual walk of every route in
PRD §5.
- [x] Today, Upcoming, All Tasks, Archive, Settings, Login, Register rebuilt on the canonical
      hooks, react-router v7 and `AuthGuard`; forms use `useForm` + Zod.
- [x] Routes come from `APP_ROUTES`; the auth gate behaviour (401 → `/login`) is unchanged.
- [ ] The e2e journeys from refactor-03 pass against the rebuilt pages.
- Commit: `refactor(frontend): rebuild pages on the feature-sliced patterns`

---

#### R06.7 — Refactor: Remove the dead vanilla CSS once Tailwind covers every screen

Rules: Tech-Frontend §8
Not in scope: any visual change beyond deleting now-unused rules — the screens already look right
after R06.5–R06.6.
Docs to update: Tech-Frontend §8 (styling is Tailwind), and note `refactor-01` is superseded.
Verify: build is green and no BEM class name is referenced anywhere; the suite stays green.

- [x] `grep` confirms no component references a `global.css` BEM class.
- [x] `global.css` deleted (or reduced to the token layer Tailwind consumes); `refactor-01` closed
      or re-pointed with a note that Tailwind superseded the split.
- Commit: `refactor(frontend): drop the vanilla-CSS stylesheet`

---

#### R06.8 — Docs: Refresh the layout block and close the baseline

Rules: Tech-Frontend §1
Not in scope: code.
Docs to update: Tech-Frontend §1 (layout block + `verified at <sha>`), Tech.md §1.
Verify: `node scripts/check-docs.mjs` passes; the suite and build stay green.

- [ ] Layout block regenerated from a real directory listing; `verified at <sha>` updated.
- [x] The baseline "After" column is filled in (React 19 / Tailwind / Vitest, suites green).
- [x] No "not in use" claim contradicts the new stack; the refresh-token exclusion still reads
      correctly in §3.
- Commit: `docs(frontend): refresh the layout block after the transformation`
