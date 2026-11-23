### Refactor 01 — Split global.css by concern

> **Superseded by refactor-06 (D-020).** Tailwind v4 replaced `global.css` entirely — R06.7
> deleted the stylesheet — so splitting it by concern is moot. This campaign will not be
> executed; it is kept for history.

#### Overview

`frontend/src/app/styles/global.css` is a single 1006-line file holding the design tokens,
reset, auth screens, nav, app layout, modals, task cards, forms, filters, pagination,
settings, loader and the dark theme. The file is readable only end-to-end; a per-screen edit
loads most of it. This campaign splits the file by concern without changing a single
rendered pixel.

**The target structure is defined in `Tech-Frontend.md` §8.** This file is only the plan.
**No behaviour or visual changes in this campaign** — any visual bug found during the move
is left alone and gets a box on a feature task.

**Depends on:** nothing · **Blocks:** nothing

#### Baseline — captured before step one

| Measure | Before | After (fill in at the end) |
|---|---|---|
| `global.css` line count | 1006 lines | |
| frontend typecheck | `cd frontend && npx tsc --noEmit` clean | |
| frontend build | `cd frontend && npm run build` succeeds | |
| rendered pages | Login / Register / Today / Upcoming / All Tasks / Archive / Settings each render identically in light and dark (verified in dev browser) | |

#### Out of scope

- **No new breakpoints**, no change to the 768px boundary — that is PRD §6 / UI §10.
- **No token renames.** `--color-primary` stays `--color-primary`.
- **No BEM class renames** — all existing class names must still work.
- **No CSS-in-JS**, no CSS modules, no preprocessor. Plain CSS files with `@import`.
- **No dark mode changes.** The `[data-theme="dark"]` selector and the `prefers-color-scheme`
  block stay byte-identical.

#### Rollback

Each subtask is one commit extracting one concern into its own file. If a visual regression
appears and the cause is not obvious within a few minutes, `git revert` and record what
broke in the box.

---

#### R01.1 — Refactor: Plan the file split and set up the entry point

Rules: Tech-Frontend §8
Not in scope: moving any actual rules in this subtask — that is what R01.2+ do (not yet
written; the concrete per-file subtasks are added once the split plan lands here).
Docs to update: Tech-Frontend §1 (update the layout block and its `verified at <sha>`
marker once the new folder exists)
Verify: `cd frontend && npm run build` succeeds; every page renders identically in dev
        (manual walk-through — see Baseline).

- [ ] Decide the split: by concern (tokens / reset / layout / auth / tasks / forms / modals
      / etc.), one file per concern under `frontend/src/app/styles/`.
- [ ] Record the split as `R01.2` ... `R01.N` subtasks appended to this file (one per
      concern).
- [ ] Create `frontend/src/app/styles/index.css` that re-exports each file via `@import`;
      update [`main.tsx`](../../../frontend/src/main.tsx) to import `index.css`.
- [ ] `global.css` renamed to `_legacy.css` and emptied; kept temporarily so the layout
      block has a clear "legacy" marker until R01.N removes it.
- Commit: `refactor(frontend): plan css split and set up the index`
