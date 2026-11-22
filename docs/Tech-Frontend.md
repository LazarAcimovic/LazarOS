# Tech — Frontend

## Section index

> Agents: do not Read this file whole. `grep -n "^## " docs/Tech-Frontend.md` for live line
> numbers, then Read with `offset`/`limit`.

| Section | Title |
|---|---|
| 1 | Project layout |
| 2 | Patterns in use, and not in use |
| 3 | HTTP client |
| 4 | Data-fetching template |
| 5 | Routing and auth gate |
| 6 | State |
| 7 | Forms and validation |
| 8 | Styling |
| 9 | Testing |

## 1. Project layout

> verified at 82e2378

```
frontend/
├── .env.development              # VITE_API_URL=http://localhost:5000/api
├── index.html
├── package.json
├── tsconfig.json                 # strict, "@/*" → "src/*"
├── vite.config.ts                # @ alias only (no server proxy)
└── src/
    ├── app/
    │   ├── App.tsx               # mounts RouterProvider + applies theme attribute
    │   └── styles/
    │       └── global.css        # all styling, 1006 lines (see refactor-01)
    ├── components/
    │   ├── layout/
    │   │   └── AppLayout.tsx     # NavBar + <Outlet/>
    │   ├── navigation/
    │   │   └── NavBar.tsx
    │   └── shared/
    │       ├── ConfirmDialog.tsx
    │       ├── Loader.tsx
    │       ├── Modal.tsx
    │       └── Pagination.tsx
    ├── config/
    │   └── constants.ts          # APP_ROUTES (used); API_ROUTES (unused, see task-05)
    ├── features/
    │   ├── auth/
    │   │   ├── api/index.ts
    │   │   ├── models/index.ts
    │   │   ├── pages/{LoginPage,RegisterPage}.tsx
    │   │   └── validation/index.ts
    │   └── tasks/
    │       ├── api/index.ts
    │       ├── components/{TaskCard,TaskEditDeleteModals,TaskForm}.tsx
    │       ├── hooks/useTaskMutations.ts
    │       ├── models/index.ts
    │       ├── pages/{TodayPage,UpcomingPage,AllTasksPage,ArchivePage}.tsx
    │       ├── utils/index.ts
    │       └── validation/index.ts
    ├── hooks/
    │   ├── useAsync.ts           # fetcher + AbortController + reload
    │   └── usePagination.ts
    ├── main.tsx
    ├── pages/
    │   └── SettingsPage.tsx      # (not under features/)
    ├── providers/
    │   ├── AuthGuard.tsx
    │   └── router.tsx
    ├── shared/
    │   ├── api/apiClient.ts      # the shared axios instance
    │   └── utils.ts              # getApiError
    ├── store/
    │   ├── authStore.ts
    │   └── themeStore.ts
    └── vite-env.d.ts
```

Note: `SettingsPage` lives under `src/pages/`, not under a feature slice. Settings is a
single-screen mix of auth + theme that does not warrant its own feature. If it grows, promote
it then.

## 2. Patterns in use, and not in use

**In use:**

- **Feature-Sliced Design** for `auth` and `tasks` — each feature owns `api/`, `models/`,
  `components/`, `pages/`, `validation/`, and optionally `hooks/` and `utils/`.
- **Barrel files.** Every feature folder exposes a `index.ts` barrel.
- **Custom hooks for async state** — `useAsync` wraps every fetch in an `AbortController` and
  gives back `{ data, isLoading, error, reload }`. `useTaskMutations` centralises the
  edit/delete/complete flow a page needs.
- **Form state via `useState`.** No form library.
- **Zod on the client**, mirroring the backend schemas.

**Not in use — do not introduce:**

- No **form library** (`react-hook-form`, `formik`, etc.).
- No **query cache** (`react-query`, `swr`). `useAsync` is the agreed shape.
- No **CSS framework or CSS-in-JS**. Vanilla CSS + BEM with CSS custom properties, one file
  (`src/app/styles/global.css`). Splitting that file is tracked as `refactor-01`.
- No **i18n layer.** English copy only.

## 3. HTTP client

[`src/shared/api/apiClient.ts`](../frontend/src/shared/api/apiClient.ts) is a single axios
instance:

- `baseURL = import.meta.env.VITE_API_URL ?? "/api"`.
- `withCredentials: true` — required for the `jwt` cookie.
- `Content-Type: application/json`.
- One response interceptor:
  - If the response is `401` **and** the request was not `GET /auth/me` **and** the current
    route is not `/login` or `/register`, hard-redirect to `/login`.
  - Otherwise the rejection propagates.

**All feature `api/` modules call `apiClient` with paths relative to `baseURL`** — never with
hardcoded absolute URLs.

## 4. Data-fetching template

Every page follows the same shape:

```ts
const fetcher = useCallback((signal: AbortSignal) => apiGetX(args, signal), [args]);
const { data, isLoading, error, reload } = useAsync(fetcher, "Failed to load X");
```

Then:

- `if (isLoading) return <Loader />;`
- `if (error) return <div className="page-error">{error}</div>;`
- Render.

Mutations call the `api/` function directly and then `reload()` (or go through
`useTaskMutations`, which wraps the common cases). See [TodayPage.tsx:13-29](../frontend/src/features/tasks/pages/TodayPage.tsx)
for a canonical example.

## 5. Routing and auth gate

[`providers/router.tsx`](../frontend/src/providers/router.tsx) creates the browser router:

- Public routes: `/login`, `/register`.
- A single `AuthGuard` route group wraps every authenticated page, nested under `AppLayout`.
- Routes come from `APP_ROUTES` in [config/constants.ts](../frontend/src/config/constants.ts);
  never hardcoded strings.

[`AuthGuard`](../frontend/src/providers/AuthGuard.tsx):

- On mount, calls `GET /auth/me`.
- 200 → sets `user` in `authStore`, renders `<Outlet />`.
- 401 → sets `user = null`, which triggers `<Navigate to="/login" replace />`.
- While loading, renders `<Loader />`.

## 6. State

Two Zustand stores, no persist middleware except `themeStore` writing to `localStorage` by
hand.

- [`authStore`](../frontend/src/store/authStore.ts): `user`, `isLoading`, `setUser`,
  `setLoading`. Populated by `AuthGuard` on startup and by login/register pages after submit.
- [`themeStore`](../frontend/src/store/themeStore.ts): `theme`, `toggleTheme`. Initial value is
  `localStorage.getItem("theme")` falling back to `prefers-color-scheme`. `toggleTheme` writes
  both to `localStorage` and the `data-theme` attribute on `<html>`. The initial attribute is
  applied via a `useEffect` in [App.tsx:9-11](../frontend/src/app/App.tsx).

Component state is `useState` + `useMemo` for derived values. There is no global task cache.

## 7. Forms and validation

- Each form owns its fields as `useState` strings.
- On submit the form calls `schema.safeParse(raw)`; errors are collected into a
  `Record<field, message>` using the first error per path (see
  [LoginPage.tsx:27-33](../frontend/src/features/auth/pages/LoginPage.tsx) and
  [TaskForm.tsx:60-66](../frontend/src/features/tasks/components/TaskForm.tsx)).
- Server errors from axios come back through `getApiError` in [shared/utils.ts](../frontend/src/shared/utils.ts),
  which returns `err.response.data.message ?? fallback`.

## 8. Styling

- One stylesheet: [`src/app/styles/global.css`](../frontend/src/app/styles/global.css).
- BEM class naming (`task-card__body`, `btn btn--primary`, `form-group__input--error`).
- Light and dark themes via CSS custom properties, switched by `[data-theme="dark"]` on
  `<html>`; see UI §1 for the token list.
- One breakpoint: `@media (max-width: 768px)` (mobile).

## 9. Testing

**Framework: Vitest + @testing-library/react + jsdom**, added in `refactor-02` R02.2.

Run with `cd frontend && npm test` (executes `vitest run`, non-interactive).

### Setup

- `vite.config.ts` carries the `test` block: `environment: "jsdom"`, `globals: true`,
  `setupFiles: ["./src/test-setup.ts"]`.
- `src/test-setup.ts` imports `@testing-library/jest-dom` to extend the global `expect` with
  DOM matchers (`toBeInTheDocument`, `toHaveClass`, etc.).
- `tsconfig.json` includes `"types": ["vitest/globals"]` so `describe`, `it`, `expect`, `vi`
  are typed without explicit imports in test files.

### Where tests live

Component tests sit beside their component: `TaskCard.test.tsx` next to `TaskCard.tsx`.
Page / integration tests follow the same co-location rule under their feature slice.

### Mocking convention

Mock at the `features/*/api/` layer, never at the `axios` level. This keeps each feature's
API calls replaceable without touching the shared HTTP client. Page tests put `vi.mock("../api")`
(automock) at the top, call `vi.resetAllMocks()` in `beforeEach`, and script each case with
`vi.mocked(apiX).mockResolvedValue(...)` / `.mockRejectedValue({ response: { data: { message } } })`.
Assertions check what the api function was called with (`apiUpdateTask("p1", { status: "completed" })`)
and what the page then renders. Cross-feature imports are mocked by their alias path
(`vi.mock("@/features/auth/api")` in the `AuthGuard` test).

Pages that call a router hook (`LoginPage`, `RegisterPage`) are wrapped in `<MemoryRouter>`;
`AuthGuard` is rendered inside a `MemoryRouter` with a `/login` route and a guarded `/` route,
and the zustand `authStore` is reset with `useAuthStore.setState(...)` in `beforeEach`. Pages
with no router hook (`TodayPage`, `AllTasksPage`, `UpcomingPage`, `ArchivePage`) render bare.
Shared task fixtures (`makeTask`, `makeDashboardTask`, `localDate`) live in
`features/tasks/test-utils.ts`.

### Suites in place

- Component: `TaskCard.test.tsx`.
- Auth pages: `LoginPage.test.tsx`, `RegisterPage.test.tsx` (inline Zod errors, `auth__error`
  strip, submitting state).
- Task pages: `TodayPage.test.tsx`, `AllTasksPage.test.tsx` (filters, `PAGE_SIZE` 10),
  `UpcomingPage.test.tsx` (grouping, "Tomorrow", `PAGE_SIZE` 5), `ArchivePage.test.tsx`
  (restore), `TaskWriteFlows.test.tsx` (create / toggle both ways / delete at the `api/` boundary).
- Provider: `providers/AuthGuard.test.tsx` (401 redirects to `/login`).
- Utils: `features/tasks/utils/index.test.ts` (unit, no render, no `api/`: `getLocalToday` returns the
  local date as `YYYY-MM-DD`, `formatDueDate` / `formatGroupDate` in `en-US` with "Tomorrow" and
  year-omitted-when-current, `priorityLabel`; the clock is faked with `vi.useFakeTimers()` +
  `vi.setSystemTime`, restored in `afterEach`).

### End-to-end (Playwright)

Run with `cd frontend && npm run test:e2e` (requires Docker; first run needs
`npx playwright install chromium`). `e2e/run-e2e.mjs` mirrors the backend runner: it starts a
throwaway SQL Server container (`e2e/docker-compose.e2e.yml`, host port 14334, database
`LazarOS_E2E`, no volume), creates the database, applies the tables and indexes of
`backend/db/schema.sql` (sections 3-5, no seed), runs `playwright test`, and always runs
`down -v` afterwards. Playwright's `webServer` array (`playwright.config.ts`) then starts the
backend on port 5001 (`TEST_DB_CONNECTION_STRING` pointing at the e2e container, `JWT_SECRET`)
and Vite on port 5174 with `VITE_API_URL` set to `http://localhost:5001/api` (process env beats
`.env.development`). Specs live in `frontend/e2e/` and are excluded from Vitest. Ports and
credentials are defined once in `e2e/e2eConfig.mjs`. The e2e stack never touches the dev database
or the backend test database (14333). Journeys: `smoke.spec.ts` (register, land on Today);
`journeys.spec.ts` (create today + yesterday task with overdue badge; complete then browser clock +1 day via `page.clock.install` drops it from the dashboard; delete, Archive, restore; logout and Back stay on `/login`).
