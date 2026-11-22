# LazarOS — Project Overview

> One-stop orientation for every agent. Always load this first. Deliberately short.

## 1. What this is

LazarOS is a personal task tracker that resurfaces missed deadlines every day instead of
letting them silently fall off the list. One user per account, two tables, no sharing, no
notifications, no reminders. Built as a React + Vite frontend and an Express + MSSQL backend
with a cookie-stored JWT for auth.

## 2. Actors

- **User** — the only actor. Creates their own account, manages their own tasks, cannot see
  or touch anyone else's data.

## 3. Where to find what — pointer map

| Concern | Primary document | Secondary |
|---|---|---|
| Project orientation, glossary | `docs/Overview.md` (this file) | — |
| Product rules, flows, states | `docs/PRD.md` | — |
| Why a rule is what it is | `docs/Decisions.md` | — |
| Backend architecture | `docs/Tech-Backend.md` | `docs/PRD.md` §7 (security) |
| Frontend architecture | `docs/Tech-Frontend.md` | — |
| Libraries, DB tooling, deployment | `docs/Tech.md` | — |
| UI screens, copy, responsiveness | `docs/UI.md` | `docs/PRD.md` §5 (screen inventory) |
| Schema, indexes, seed | `docs/DB.md` | `docs/PRD.md` §8 (seeding) |
| Open tasks | `docs/tasks/active/index.md` | — |
| Archived tasks | `docs/tasks/done/YYYY-MM.md` | — |
| Refactor campaigns | `docs/refactors/active/index.md` | — |

Concept → where its rules live:

- Task lifecycle → PRD §4
- Overdue behaviour → PRD §4.8
- "Today" classification → PRD §4.7, Tech-Backend §8
- Soft delete / Archive → PRD §4.6, DB §3
- Auth (register, login, logout, session) → PRD §4.1, §4.2, §4.12, Tech-Backend §3, §4
- Data isolation → PRD §7, Tech-Backend §3
- Limits and formats → PRD §6

## 4. Glossary

- **Task** — a titled item with a due date, priority and status. Rules: PRD §3, DB §2.2.
- **Profile** — a user account. Rules: PRD §2, DB §2.1.
- **Overdue** — a `pending` task whose `due_date` is strictly before today. Rules: PRD §4.7–4.8.
- **Today's date (for classification)** — the user's *local* calendar date, passed from the
  client as `today=YYYY-MM-DD`. Rules: PRD §4.7, Tech-Backend §8.
- **Archive** — the collection of `is_deleted = 1` tasks for a user. Rules: PRD §4.11, DB §3.
- **Soft delete** — setting `is_deleted = 1`; nothing is ever removed from the database.
  Rules: PRD §4.6, Decisions D-011.
- **Dashboard** — the Today screen composed of three sections: Overdue / Today / Completed
  Today. Rules: PRD §4.7.
- **Session** — a 30-day JWT in an httpOnly, SameSite=Strict cookie. Rules: PRD §6, §7,
  Tech-Backend §4.
- **Feature slice** — a self-contained folder under `frontend/src/features/*` exposing
  `api/`, `models/`, `components/`, `pages/`, etc. Rules: Tech-Frontend §1, §2.

## 5. Hard rules

- **Precedence.** PRD owns behaviour; UI owns visuals where PRD is silent; DB owns schema;
  Tech owns code structure. A value is defined in exactly one document.
- **Never resolve a contradiction by choosing.** Stop, open a Decisions entry, report it.
- **A task file is a plan, never a source of truth.**
- `docs/old/**` is never authoritative and is never read unless named.
- Load documents by section, grepping `^## ` for live line numbers.
- Changing behaviour, schema or a screen updates the owning siblings in the same commit.
- `node scripts/check-docs.mjs` must pass before a documentation commit.
