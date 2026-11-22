# Task template

Copy this file to `docs/tasks/active/task-NN-<slug>.md` when opening a new task. Fill every
placeholder; do not edit the shape.

## How to use this template

1. Pick the next unused task number (look at `active/index.md` and `done/YYYY-MM.md`).
2. Copy this file to `active/task-NN-<slug>.md`. Keep the same four-line body contract on
   every subtask.
3. Add one row to `active/index.md` with `Depends on:` / `Blocks:` filled in.
4. Run `node scripts/check-docs.mjs` — the row is now enforced.

Hard requirements the checker enforces:

- Every subtask heading matches `#### <id> — <sub-tag>: <title>`.
- Every subtask body has `Rules:`, `Not in scope:`, `Docs to update:`, `Verify:` lines in
  that order.
- `Rules:` names PRD/UI/DB/Tech sections or `none` — **never** another task file.
- Checkbox count in the file matches the progress cell in `index.md`.

## The skeleton

```markdown
### Task N — <Title>

#### Overview

<2–4 sentences on what this task delivers.>

**The rules for this task live in `PRD.md` §X** (and DB §Y, UI §Z). This file is only the
plan — read the rules from those sections, never from this Overview.

**Depends on:** <task ids or nothing> · **Blocks:** <task ids or nothing>

---

#### N.0 — Docs: Promote the rules into the source-of-truth documents

Rules: none (this subtask creates the rules' home)
Not in scope: any code change.
Docs to update: PRD §X, DB §Y, UI §Z, Decisions D-0NN
Verify: `node scripts/check-docs.mjs`

- [ ] Every rule this task needs is written into PRD / UI / DB / Tech.
- [ ] Any glossary or pointer entry references those sections, not this file.
- Commit: `docs: <what the rules are>`

---

#### N.1 — <sub-tag>: <subtask title>

Rules: <PRD §x (short label), UI §y, DB §z, or none>
Not in scope: <what this subtask must not touch>
Docs to update: <sections, or none>
Verify: <the exact command that must pass>

- [ ] <acceptance criterion — becomes a Red-step test case>
- [ ] <acceptance criterion>
- Commit: `<type>(<scope>): <message>`
```

## Why each line exists

| Line | Purpose |
|---|---|
| `Rules:` | Forces the agent to read the owning document before coding. |
| `Not in scope:` | The cheapest anti-scope-creep device available. |
| `Docs to update:` | Makes the cross-doc protocol fire per subtask. |
| `Verify:` | Removes the agent's freedom to invent its own definition of done. |

## Optional lines

- `Depends on:` on a **single subtask** — put directly under the heading, above `Rules:`.
  Task-level dependencies live in the Overview and `index.md` instead.
- A reconciliation blockquote in the Overview — when some subtasks turned out to be already
  done; give the date and what is actually outstanding.

## Sub-tag reminder

Sub-tag must be one from `AGENTS.md` §9. Bare `Backend` / `Frontend` / `DB` are **not valid**.
The valid set:

`Backend-service`, `Backend-endpoint`, `Backend-migration`,
`Frontend-service`, `Frontend-component`, `Frontend-page`,
`Seed`, `UI`, `Test`, `Refactor`, `Docs`, `DevOps`.

## Numbering

Number subtasks in the order they will be done. An agent resumes at the first unchecked
subtask, so the numbering is the plan, not an ordering hint. If priorities change later,
reorder in the file.

## Worked example

> The content below is **illustrative; the shape is normative.** The task is a plausible but
> fictitious one for this project — server-side title search on `GET /api/tasks`, currently
> filtered in memory by the client (PRD §4.10). Every rule cited is one this repo would
> actually hold if the feature existed. An agent copies an example far more faithfully than
> prose, so pay attention to shape: no two lines contradict, nothing is specified that the
> referenced section would not contain, and the `Rules:` lines never cite the task file
> itself.

````markdown
### Task 7 — Server-side title search on `GET /api/tasks`

#### Overview

The All Tasks page currently does search-by-title in memory after fetching every task
(PRD §4.10). This task moves the filter to the backend via a `q` query param, so the client
only pulls matching rows. No new table, no schema change.

**The rules for this feature live in `PRD.md` §4.10** (All Tasks flow) and
`Tech-Backend.md` §5 (validation). This file is only the plan — read the rules from those
sections, never from this Overview.

**Depends on:** nothing · **Blocks:** nothing

---

#### 7.0 — Docs: Promote the `q` param into PRD §4.10 and Tech-Backend §5

Rules: none (this subtask creates the rules' home)
Not in scope: any code change.
Docs to update: PRD §4.10 (describe the `q` param — type, length cap, case folding, what
empty means), Tech-Backend §5 (add the validator entry), Tech-Backend §3 (if the query
pipeline changes).
Verify: `node scripts/check-docs.mjs`

- [ ] PRD §4.10 says `q` is an optional `VARCHAR(255)` lowercased substring search.
- [ ] Tech-Backend §5 names the new Zod schema fragment and its placement.
- Commit: `docs: specify server-side title search for GET /api/tasks`

---

#### 7.1 — Backend-endpoint: Accept and apply `?q=<title>` on `GET /api/tasks`

Rules: PRD §4.10 (the `q` param rule), Tech-Backend §3 (pipeline), Tech-Backend §5
(validation)
Not in scope: changing the client. The frontend still runs its in-memory filter until 7.2.
Docs to update: Tech-Backend §5 if the validator file layout changes.
Verify: `curl --cookie "jwt=$JWT" "http://localhost:5000/api/tasks?q=spring"` returns only
        tasks whose lowercased title contains "spring".

- [ ] Zod schema validates `q` as an optional string up to 255 characters.
- [ ] Controller lowercases `q` and adds `AND LOWER(title) LIKE '%' + @q + '%'` to the
      query, parameterised — never string concatenation.
- [ ] Missing or empty `q` returns the full list unchanged (regression test against PRD
      §4.10's "no filters" case).
- Commit: `feat(backend): server-side title search on GET /api/tasks`

---

#### 7.2 — Frontend-page: Delegate the search box to the server

Rules: PRD §4.10 (search behaviour), Tech-Frontend §4 (data-fetching template)
Not in scope: status / priority / date filters — those stay client-side per PRD §4.10.
Docs to update: Tech-Frontend §1 if the layout block changes.
Verify: with dev tools open, typing in the search box fires one request per debounced input;
        no other request is made.

- [ ] `AllTasksPage` passes `q` into `apiGetAllTasks` and includes it in the `useAsync`
      fetcher's dependency array.
- [ ] Typing is debounced so one request fires per settle, not per keystroke.
- [ ] Empty `q` sends no param.
- Commit: `feat(frontend): delegate All Tasks search to the server`
````

Execution reminder: at 7.1 the agent loads PRD §4.10 and Tech-Backend §5, writes the
failing manual-verify call (per AGENTS §9 — no framework yet), implements the minimum,
runs the `curl`, confirms the expected rows, ticks the boxes, updates the `index.md`
progress cell, runs `check-docs.mjs`, and stops to show the diff per AGENTS §11. The task
file never restates that cycle — AGENTS §9 owns it.
