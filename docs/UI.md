# UI

## Section index

> Agents: do not Read this file whole. `grep -n "^## " docs/UI.md` for live line numbers,
> then Read with `offset`/`limit`.

| Section | Title |
|---|---|
| 1 | Visual foundation |
| 2 | Layout and navigation |
| 3 | Auth screens |
| 4 | Today |
| 5 | Upcoming |
| 6 | All Tasks |
| 7 | Archive |
| 8 | Settings |
| 9 | Shared primitives |
| 10 | Responsiveness |
| 11 | Copy conventions |
| 12 | Accessibility |

## 1. Visual foundation

- **Styling framework:** Tailwind CSS v4 (D-020). Tokens are declared once in the `@theme` block of
  `src/app/index.css`; components consume them as utilities (`bg-surface`, `text-muted-foreground`).
  There is no hand-written component stylesheet and no BEM.
- **Colour, radius, shadow, font:** defined as CSS variables on `:root` and redefined under
  `.dark`; `@theme inline` maps each variable to a Tailwind token so utilities follow the theme.
- **Theme switching:** a `dark` class on `<html>` (Tailwind `@custom-variant dark`), set by
  `ThemeProvider` from `themeStore`; with no stored choice it follows `prefers-color-scheme`.
- **Font stack:** `--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.

### Token reference (the `@theme` block, light theme)

Values are carried over unchanged from the former stylesheet so the palette does not shift. The
shadcn semantic names (`background`, `foreground`, `card`, `primary`, `destructive`, `muted`,
`border`, `ring`) are mapped onto these tokens: `background` = `--color-bg`, `card` = `--color-surface`,
`primary` = `--color-primary`, `destructive` = `--color-danger`, `muted-foreground` = `--color-text-muted`.

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#f5f5f7` | Page background |
| `--color-surface` | `#ffffff` | Cards, modals |
| `--color-surface-2` | `#f0f0f2` | Alternate surface |
| `--color-border` | `#e2e2e6` | Dividers |
| `--color-text` | `#1a1a2e` | Primary text |
| `--color-text-muted` | `#6b6b80` | Secondary text |
| `--color-primary` | `#4f46e5` | Primary buttons, active nav |
| `--color-primary-hover` | `#4338ca` | Primary hover |
| `--color-danger` | `#dc2626` | Delete / errors |
| `--color-danger-hover` | `#b91c1c` | Delete hover |
| `--color-success` | `#16a34a` | Completed check mark |
| `--color-overdue-{bg,text,border}` | `#fef2f2 / #991b1b / #fecaca` | Overdue section |
| `--color-today-{bg,text,border}` | `#eff6ff / #1d4ed8 / #bfdbfe` | Today section |
| `--color-completed-{bg,text}` | `#f0fdf4 / #15803d` | Completed section |
| `--color-priority-{high,medium,low}` | `#dc2626 / #d97706 / #059669` | Priority pill |
| `--radius-{sm,md,lg}` | `6px / 10px / 16px` | — |
| `--shadow-{sm,md,lg}` | three elevations | — |
| `--nav-width` | `220px` | Sidebar width (`w-55`) |

Dark variants are declared under `.dark` in the same file, one value per token above.

## 2. Layout and navigation

Authenticated screens are wrapped in [`AppLayout`](../frontend/src/components/layout/AppLayout.tsx):

```
┌────────────┬─────────────────────────────────┐
│ NavBar     │   <Outlet />                    │
│ (220px)    │                                 │
└────────────┴─────────────────────────────────┘
```

Nav links come from [`NavBar.tsx:4-10`](../frontend/src/components/navigation/NavBar.tsx):
`Today`, `Upcoming`, `All Tasks`, `Archive`, `Settings`. The active link is styled through
`NavLink`'s active state (Tailwind utilities merged with `cn()`).

On mobile (§10) the nav collapses — see the `@media (max-width: 768px)` block in the
stylesheet.

## 3. Auth screens

Visual rules — [`LoginPage.tsx`](../frontend/src/features/auth/pages/LoginPage.tsx),
[`RegisterPage.tsx`](../frontend/src/features/auth/pages/RegisterPage.tsx):

- Centred card on `--color-bg`.
- Title: `LazarOS`. Subtitle: `Sign in to your workspace` / `Create your account`.
- Server errors render in a top error strip (marked `data-auth-error`). Field errors render as inline
  `form-group__error` under each field.
- **Register has a password visibility toggle** (eye icon) on both password and confirmation
  fields ([RegisterPage.tsx:9-25, 143-163](../frontend/src/features/auth/pages/RegisterPage.tsx)).
  Login does not — the toggle exists only during account creation.
- The footer offers a link to switch between register and login.
- Submit disables the button and changes copy to `Signing in...` / `Creating account...`.

Rules for fields, validation and what submit does are owned by PRD §4.1, §4.2, §6.

## 4. Today

[`TodayPage.tsx`](../frontend/src/features/tasks/pages/TodayPage.tsx):

- Header: `h1` "Today" + today's date formatted by [`formatDueDate`](../frontend/src/features/tasks/utils/index.ts)
  (`"Jan 5, 2026"`), plus a right-aligned primary "**+ Add Task**" button opening the modal.
- Three **summary cards** in a row: Overdue / Today / Completed. Counts, not totals.
- Three sections, each conditional on having at least one row:
  - **Overdue** — tasks sorted by date ascending then priority descending; each shows a
    "N day(s) overdue" badge inside the task card, right of the date
    ([TaskCard.tsx:60-64](../frontend/src/features/tasks/components/TaskCard.tsx)).
  - **Today** — same card, no badge.
  - **Completed** — tasks completed today.
- Empty state (nothing in any bucket): "Nothing due today. Enjoy your day!"

The modal titled "New Task" renders the shared `TaskForm` in `create` mode.

## 5. Upcoming

[`UpcomingPage.tsx`](../frontend/src/features/tasks/pages/UpcomingPage.tsx):

- Header: `h1` "Upcoming".
- Tasks are grouped by `due_date`. The first future date is labelled "Tomorrow"; other dates
  use "Month D, Year" (year omitted when same as current) — see
  [`formatGroupDate`](../frontend/src/features/tasks/utils/index.ts).
- Paginated at PRD §6's page size.
- Empty state: "No upcoming tasks. Add one from the Today page!"

## 6. All Tasks

[`AllTasksPage.tsx`](../frontend/src/features/tasks/pages/AllTasksPage.tsx):

- Header: `h1` "All Tasks" + "**+ Add Task**".
- A filter row: search input, status select, priority select, date input, "Reset" button
  (only visible when any filter is active).
- Counter line: "N of M tasks".
- Task list paginated at PRD §6's page size.
- Empty state when filters match nothing: "No tasks match your filters."

## 7. Archive

[`ArchivePage.tsx`](../frontend/src/features/tasks/pages/ArchivePage.tsx):

- Header: `h1` "Archive".
- Task list of soft-deleted tasks.
- Each card exposes only **Restore** — no edit, no complete, no delete. See the `archived`
  prop in [`TaskCard.tsx:11, 32, 78, 86`](../frontend/src/features/tasks/components/TaskCard.tsx).
- Empty state: "No archived tasks."

## 8. Settings

[`SettingsPage.tsx`](../frontend/src/pages/SettingsPage.tsx):

- Three sections: **Profile**, **Appearance**, **Account**.
- Profile shows name and email as read-only fields (no edit).
- Appearance holds the dark-mode toggle (a `role="switch"` button).
- Account holds the Log Out button (`btn btn--danger`).

## 9. Shared primitives

**shadcn/radix primitives** (generated into `components/ui/`, styled by the §1 tokens; Tech-Frontend §8):
`button` (variants: default, destructive, outline, ghost), `input`, `label`, `textarea`, `select`,
`checkbox`, `form`, `dialog`, `alert-dialog`, `badge`, `card`, `alert`,
`skeleton`, `separator`. Keyboard, focus-trap and ARIA behaviour come from radix (UI §12). Icons are
`lucide-react`. Add a primitive only when a screen needs it.

**App composites** (`components/shared/`, built from the primitives):

- **`Modal`** — a `dialog` wrapper: title + close button, Escape closes, click-outside closes.
- **`Loader`** — a plain spinner, used while `useAsync` is loading.
- **`ConfirmDialog`** — a `dialog` wrapper used for deletion (`role="dialog"`, not `alert-dialog`,
  per D-021); accepts `message`, `onConfirm`, `onCancel`, `isLoading`.
- **`Pagination`** — Prev / `page / total` / Next, returns `null` when `totalPages <= 1`.
- **`TaskCard`** (`features/tasks/components`) — one `card`-based component drives Today, Upcoming,
  All Tasks, Archive. Shows priority `badge` (coloured), date, optional overdue badge, and
  context-dependent action buttons (Complete toggle, Edit, Delete, Restore).

Copy, states and behaviour of these components are unchanged by the migration; only the look
comes from the shadcn defaults themed with the §1 tokens.

## 10. Responsiveness

One breakpoint at 768px — Tailwind's `md` — applied with `md:` / `max-md:` utilities in
[`AppLayout`](../frontend/src/components/layout/AppLayout.tsx). Below it:

- The sidebar nav collapses and the content fills the width.
- Summary cards and filter rows wrap.

Above 768px the sidebar is always visible at `--nav-width` and the content takes the
remaining width with a max content width per screen.

## 11. Copy conventions

- **Primary buttons use title case:** "Create Task", "Save Changes", "Sign In", "Create
  Account", "Log Out".
- **Empty states end with a period** and often a cheerful fragment — "Enjoy your day!",
  "Add one from the Today page!".
- **Error strings are terse.** Server errors are surfaced verbatim from
  `response.data.message` via `getApiError` (PRD §4).
- **Priority labels are lowercase in the pill** (as rendered in [TaskCard.tsx:56](../frontend/src/features/tasks/components/TaskCard.tsx):
  `{task.priority}`). The [`priorityLabel`](../frontend/src/features/tasks/utils/index.ts)
  helper exists for places that need title case, but is not currently called by any
  component.
- **Dates format with `en-US`** — see PRD §6.
- **Nothing is translated.** English only.

## 12. Accessibility baseline

- Every input has a `<label htmlFor>` pairing (search `form-group__label` in the stylesheet
  and the auth forms).
- The Modal sets `role="dialog"`, `aria-modal="true"` and `aria-labelledby="modal-title"`.
- The dark-mode toggle uses `role="switch"` and `aria-checked`.
- The password-visibility buttons set `aria-label="Show password" / "Hide password"`.
- The task complete button has `aria-label="Toggle complete"` and a `title` describing the
  action.

There is no formal audit; no tooling runs axe or similar.
